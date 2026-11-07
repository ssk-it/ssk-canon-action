// Integrity check of a project repo, from the file system.
//
// The rules themselves live in `verifier.mjs`, which depends on no file system
// and also runs in a browser. This module only loads the repo and hands it
// over.
//
//   node src/check.mjs [chemin-du-depot] [--base <ref>] [--sans-immuabilite] [--livraison] [--cites <dossier>]

import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { loadRepo } from './parse.mjs';
import { checkRepo } from './verifier.mjs';
import { createError, createWarning, enTexte, formaterAnomalie, langueDuDepot } from './anomalies.mjs';
import { resoudreNoms } from './noms.mjs';
import { referentielsCites } from './citations.mjs';
import {
  readFileAt,
  folderExistsAt,
  listDeliveredScopings,
  listCarriedScopings,
  listChangedFiles,
  findModifiedDeliveredScopings,
  mergeBase,
} from './delivery.mjs';

export { checkRepo };

/**
 * @param {string} root
 * @param {{ ignorerIndexDerives?: boolean, livres?: Set<string>, base?: string, immuabilite?: boolean, livraison?: boolean, dossierCites?: string, cloner?: boolean }} [options]
 */
export function check(root, options = {}) {
  const {
    base,
    livres: givenDelivered,
    immuabilite: immutability = true,
    livraison: delivery = false,
    dossierCites: citedFolder,
    cloner: clone = true,
    ...rest
  } = options;

  // A scoping's status is not declared: it is deduced from the repo, and the
  // main branch is what establishes delivery. Outside a Git repo — a
  // specification checked from an archive — no scoping is held to be
  // delivered, which `checkRepo` treats as a normal case.
  const reference = base ?? 'origin/main';
  const repo = loadRepo(root);
  const folder = repo.noms.dossiers.cadrages;
  const delivered = givenDelivered ?? listDeliveredScopings(root, reference, folder) ?? new Set();

  // A branch the reference has already merged finds its own scoping delivered
  // there, without the propagation that follows the merge: its derived indexes
  // are pending, not wrong. Demanding them from the author would make them hunt
  // for an error that does not exist — the propagation answers for it,
  // RG-propagation-verifiee. The merge is reported, without blocking anything —
  // RG-branches-survivantes-signalees.
  const merge = givenDelivered ? null : mergeBase(root, reference);

  // The cited specifications, read on their main branch: what could not be read
  // is reported as unchecked — RG-citation-signalee-chez-le-citant.
  const clones = [];
  let cited;
  try {
    cited = loadCitedSpecifications(repo.config, {
      obtenir: getCitedSpecification({ citedFolder, clone, clones }),
    });
  } finally {
    for (const c of clones) rmSync(c, { recursive: true, force: true });
  }

  const result = checkRepo(repo, {
    ...rest,
    livres: delivered,
    cites: cited,
    ...(merge ? { ignorerIndexDerives: true } : {}),
  });
  const mergeWarning = merge
    ? [createWarning('branche-deja-fusionnee', { reference, fusion: merge })]
    : [];

  // Immutability is only checked against an explicit base, that is on a pull
  // request. The propagation, for its part, runs after the merge: its
  // difference with the main branch is the scoping just delivered, and checking
  // it there would refuse every delivery.
  //
  // A specification may have to suspend it for the duration of a format
  // migration: the scoping that institutes immutability must itself touch the
  // delivered scopings, otherwise it cannot be delivered. The suspension is
  // declared, re-read in the workflow, and does not have to be removed from the
  // code and then put back.
  const immutabilityErrors =
    base && immutability ? checkImmutability(root, base, delivered, folder) : [];

  // What the merge will require, demanded while there is still time to write it
  // — RG-controle-de-livraison.
  const deliveryErrors =
    delivery && base ? checkDelivery(root, base, delivered, result, folder) : [];

  const nameErrors = base ? checkNamesUnchanged(root, base, repo.noms) : [];

  // The texts are derived from the anomalies, in French: yesterday's textual
  // form, read by consumers that do not know the codes yet.
  const anomalies = [
    ...mergeWarning,
    ...result.anomalies,
    ...nameErrors,
    ...immutabilityErrors,
    ...deliveryErrors,
  ];
  return { ...result, anomalies, ...enTexte(anomalies) };
}

/**
 * Loads the specifications that `config` declares in `referentiels_cites`.
 *
 * `obtenir(repo)` returns the directory where the cited repo can be read, or
 * `null` if it could not be obtained — for lack of access, most often. The
 * result maps each prefix to the loaded specification, or `null`.
 *
 * @param {object | null} config
 * @param {{ obtenir: (repo: string) => string | null }} options
 * @returns {Map<string, object | null>}
 */
export function loadCitedSpecifications(config, { obtenir }) {
  const cited = new Map();
  for (const [prefix, repo] of referentielsCites(config).cites) {
    const path = obtenir(repo);
    cited.set(prefix, path ? loadRepo(path) : null);
  }
  return cited;
}

/**
 * Where to read a cited repo: under `citedFolder/<owner>/<name>` if it is there
 * — a workflow that fetched it itself, a test —, otherwise through a shallow
 * clone of its default branch.
 *
 * The clone uses the token from `SSK_CANON_JETON_CITES` when it is provided: a
 * workflow's token only reads its own repo, and a private cited specification
 * requires another one, read-only. Without a token, only a public repo can be
 * read. A failure, whatever it is, returns `null` without printing anything:
 * Git's output could carry the URL, and the URL the token.
 */
function getCitedSpecification({ citedFolder, clone, clones }) {
  return (repo) => {
    if (citedFolder) {
      const path = join(citedFolder, ...repo.split('/'));
      if (existsSync(path)) return path;
    }
    if (!clone) return null;
    const token = process.env.SSK_CANON_JETON_CITES;
    const server = new URL(process.env.GITHUB_SERVER_URL ?? 'https://github.com');
    if (token) {
      server.username = 'x-access-token';
      server.password = token;
    }
    const destination = mkdtempSync(join(tmpdir(), 'canon-cite-'));
    clones.push(destination);
    try {
      execFileSync('git', ['clone', '--quiet', '--depth', '1', new URL(`${repo}.git`, server).href, destination], {
        stdio: 'ignore',
        timeout: 120_000,
        // never a prompt: without access, the check must say so, not wait
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      return destination;
    } catch {
      return null;
    }
  };
}

/**
 * A repo's language, read from its `ssk-canon.yml` — RG-langue-du-depot.
 * An unreadable configuration is read as French: the check reports it.
 */
export function languageOf(root) {
  let config = null;
  try {
    config = load(readFileSync(join(root, 'ssk-canon.yml'), 'utf8'));
  } catch {
    // unreadable or missing: the default language
  }
  return langueDuDepot(config).langue;
}

/**
 * Refuses that a declared name changes once its folder exists —
 * RG-noms-declares, RG-chemins-immuables.
 *
 * The name is chosen at creation. Changing it would leave the files under a
 * name nothing reads any more, or would move them and lose their history. The
 * comparison is made with the base's configuration: it is what tells the
 * previous name, which the current state has forgotten.
 */
function checkNamesUnchanged(root, base, names) {
  let baseConfig = null;
  try {
    baseConfig = load(readFileAt(root, base, 'ssk-canon.yml') ?? '');
  } catch {
    // an unreadable base configuration tells no previous name
    return [];
  }
  const before = resoudreNoms(baseConfig);
  const scopingsBefore = folderExistsAt(root, base, before.dossiers.cadrages);
  const errors = [];

  for (const bloc of ['dossiers', 'fichiers'])
    for (const [cle, nom] of Object.entries(names[bloc])) {
      const ancien = before[bloc][cle];
      if (nom === ancien) continue;
      // A root name counts as soon as its folder exists; a name internal to a
      // scoping, as soon as a scoping exists.
      const internal = bloc === 'fichiers' || cle === 'decisions_cadrage';
      const exists = internal ? scopingsBefore : folderExistsAt(root, base, ancien);
      if (exists)
        errors.push(createError('nom-change', { bloc, cle, ancien, nom }));
    }
  return errors;
}

/**
 * Checks the state the specification will have once the pull request is
 * merged — RG-controle-de-livraison.
 *
 * The specification is re-read holding as delivered the scopings the pull
 * request carries, and only the errors this assumption brings out are
 * reported: the others have already been reported by the ordinary check, and
 * repeating them would cast doubt on their number.
 *
 * Derived indexes are excluded: `cree_par` and `modifie_par` are written by the
 * propagation, after the merge. Requiring them before would amount to asking
 * the author for what the machine must produce.
 */
function checkDelivery(root, base, delivered, alreadySeen, folder) {
  const carried = listCarriedScopings(root, base, folder);

  // Not knowing what the pull request carries is not a pull request without a
  // scoping: the check did not take place, and keeping quiet would make it
  // silently inapplicable — the same trap as immutability without history.
  if (carried === null) return [createError('livraison-hors-d-atteinte', { base })];

  const newOnes = [...carried].filter((id) => !delivered.has(id));
  if (!newOnes.length) return [];

  const afterMerge = checkRepo(loadRepo(root), {
    livres: new Set([...delivered, ...newOnes]),
    ignorerIndexDerives: true,
  });

  // An anomaly is recognised by its code and its parameters, not by its text.
  const key = (a) => JSON.stringify([a.code, a.params]);
  const known = new Set(alreadySeen.anomalies.filter((a) => a.gravite === 'erreur').map(key));
  return afterMerge.anomalies
    .filter((a) => a.gravite === 'erreur' && !known.has(key(a)))
    .map((anomalie) => createError('a-la-livraison', { anomalie }));
}

/**
 * Refuses the modification of an already delivered scoping —
 * RG-cadrage-livre-immuable.
 *
 * The specification is the projection of the delivered scopings: modifying one
 * of them changes what the specification should contain, without anything
 * propagating it again.
 *
 * The check bears on a difference between two states, where the others settle
 * for the latest: it only makes sense on a pull request, and keeps quiet on the
 * main branch itself, where the difference is empty by construction. An
 * unreachable base, on the other hand, is reported: the check did not take
 * place, which is not to be confused with a compliant specification.
 */
function checkImmutability(root, base, delivered, folder) {
  const files = listChangedFiles(root, base);

  // An unreachable base is not a compliant specification: it is a check that
  // did not take place. Keeping quiet here made the rule silently inapplicable
  // — a repo whose workflow omits `fetch-depth: 0` believed it protected its
  // delivered scopings while nothing checked them.
  if (files === null) return [createError('immuabilite-hors-d-atteinte', { base })];

  if (!files.length) return [];

  const errors = [];
  for (const [id, chemins] of findModifiedDeliveredScopings(files, delivered, folder)) {
    errors.push(createError('cadrage-livre-modifie', { cadrage: id, chemins }));
  }
  return errors;
}

// direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  // the options that take a value, and the index of that value, to skip in
  // order to find the path
  const values = new Map();
  for (const option of ['--base', '--cites']) {
    const i = args.indexOf(option);
    if (i !== -1) values.set(i + 1, option);
  }
  const valueOf = (option) => args[[...values].find(([, o]) => o === option)?.[0]];
  const base = valueOf('--base');
  const citedFolder = valueOf('--cites');
  const root = args.find((a, i) => !a.startsWith('--') && !values.has(i)) ?? '.';

  const { anomalies, counts } = check(root, {
    ...(base ? { base } : {}),
    ...(citedFolder ? { dossierCites: citedFolder } : {}),
    immuabilite: !args.includes('--sans-immuabilite'),
    livraison: args.includes('--livraison'),
  });

  // The report is given in the repo's language — RG-langue-du-depot.
  const language = languageOf(root);
  const say = (code, params = {}) => formaterAnomalie({ code, params }, language);
  const { errors, warnings } = enTexte(anomalies, language);

  console.log(say('rapport-comptes', counts));

  if (warnings.length) {
    console.log(`\n${say('rapport-avertissements', { nombre: warnings.length })}`);
    for (const w of warnings) console.log(`  ~ ${w}`);
  }

  if (errors.length) {
    console.log(`\n${say('rapport-erreurs', { nombre: errors.length })}`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    process.exit(1);
  }

  console.log(`\n${say('rapport-integrite-verifiee')}`);
}
