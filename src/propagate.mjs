// Application of the impacts to the specification.
//
// Triggered when a scoping is merged into the main branch. The principle: the
// Action does not replay a history, it **compares the state declared by the
// delivered scopings with the actual state of the specification**, and writes
// only the difference.
//
// Two properties follow:
//
// - **Idempotence**: running the propagation again on an up-to-date
//   specification produces no write. It can therefore be replayed safely after
//   a failure, or to catch up on a missed propagation.
// - **All or nothing**: the writes are computed first, applied afterwards.
//   An inconsistency stops before any write, leaving the specification in its
//   previous state, which is consistent.
//
//   node src/propagate.mjs [chemin-du-depot] [--dry-run]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { loadRepo, readNames, splitFrontmatter, extractEnonces } from './parse.mjs';
import { DOSSIER_DE_COLLECTION } from './noms.mjs';
import { check, languageOf } from './check.mjs';
import { createError, enTexte, formaterAnomalie } from './anomalies.mjs';
import { cibleDe as kindOf } from './verifier.mjs';
import { listDeliveredScopings, deliveryOrder } from './delivery.mjs';

/** Order of the keys in a rule's frontmatter, for a readable diff. */
const KEY_ORDER = [
  'id',
  'fonctionnalites',
  'nature',
  'composants',
  'applique',
  'statut',
  'cree_par',
  'modifie_par',
];

/**
 * Computes the state the specification should have, according to the
 * delivered scopings.
 *
 * The scopings are walked in the order of their delivery: it decides which
 * statement prevails when two scopings touch the same rule — the last
 * delivered, written knowing the other. The identifier does not tell it:
 * assigned at preparation, it follows the order of preparations, and two
 * scopings carried out in parallel are often delivered the other way round. It
 * only breaks the tie between two scopings delivered together, or whose
 * delivery could not be read.
 *
 * @param {Map<string, number>} [order] delivery rank per scoping — see
 *   `deliveryOrder`
 */
export function expectedState(repo, delivered, order = new Map()) {
  const expected = new Map();

  const rank = (id) => order.get(String(id)) ?? Number.POSITIVE_INFINITY;
  const deliveredScopings = [...repo.cadrages.values()]
    .filter((c) => delivered.has(c.id))
    .sort((a, b) => rank(a.id) - rank(b.id) || String(a.id).localeCompare(String(b.id)));

  for (const scoping of deliveredScopings) {
    const statements = extractEnonces(scoping.body);

    for (const impact of scoping.impacts ?? []) {
      const { operation } = impact;
      if (operation === 'touche') continue; // produces no write

      // The kind is kept with the target: it will tell which directory to
      // write to. Deducing it later would mean guessing from the identifier,
      // and nothing requires a prefix to give it away.
      const kind = kindOf(impact);
      if (!kind) continue; // impact without a target: the check has already said so
      const { id: name, collection } = kind;

      if (!expected.has(name)) {
        expected.set(name, {
          id: name,
          collection,
          statut: 'actif',
          cree_par: null,
          modifie_par: [],
          enonce: null,
        });
      }
      const target = expected.get(name);

      switch (operation) {
        case 'cree':
          target.cree_par = scoping.id;
          target.enonce = statements.get(name) ?? target.enonce;
          break;
        case 'modifie':
          target.modifie_par.push(scoping.id);
          target.enonce = statements.get(name) ?? target.enonce;
          break;
        case 'abroge':
          target.modifie_par.push(scoping.id);
          target.statut = 'abroge';
          // a repeal may rewrite the statement to explain why
          if (statements.has(name)) target.enonce = statements.get(name);
          break;
      }
    }
  }
  // The delivery order decides which statement prevails, not the index:
  // `modifie_par` is the list of scopings that touched the target, sorted by
  // identifier, as the check recomputes it.
  for (const target of expected.values()) {
    target.modifie_par.sort((a, b) => String(a).localeCompare(String(b)));
  }
  return expected;
}

/**
 * Serialises a target in the specification's format.
 *
 * `own` carries what the specification decides and the scoping does not
 * dictate: the link to features for a rule, the kind and the linked components
 * for an architecture document. The propagation preserves them without ever
 * choosing them — it is the same reason in both cases.
 */
function formatRule(rule, own, statement) {
  const data = {
    id: rule.id,
    ...own,
    statut: rule.statut,
    cree_par: rule.cree_par,
    modifie_par: rule.modifie_par,
  };
  const ordered = {};
  for (const key of KEY_ORDER) {
    if (data[key] !== undefined) ordered[key] = data[key];
  }
  const frontmatter = dump(ordered, { lineWidth: -1, flowLevel: 1 }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${statement.trim()}\n`;
}

/**
 * The delivered scopings, as the repo establishes them.
 *
 * The propagation runs after the merge, on the main branch: what is delivered
 * is therefore what `HEAD` carries, and not what a remote reference says about
 * it — that one may lag behind the merge that just triggered the run.
 *
 * An unreachable repo fails rather than returning an empty set: without a
 * delivered scoping, the propagation would conclude that the whole
 * specification is superfluous.
 */
function deliveredInRepo(root, folder) {
  const delivered = listDeliveredScopings(root, 'HEAD', folder);
  if (delivered === null)
    throw new Error(
      "impossible de lire les cadrages livrés depuis Git — la propagation a besoin d'un dépôt",
    );
  return delivered;
}

/**
 * Compares the expected with the actual and returns the necessary writes.
 * Modifies nothing: this is the computation phase of the "all or nothing".
 */
export function computeWrites(root, delivered) {
  const repo = loadRepo(root);
  const { dossiers, fichiers } = repo.noms;
  const expected = expectedState(
    repo,
    delivered ?? deliveredInRepo(root, dossiers.cadrages),
    deliveryOrder(root, 'HEAD', { folder: dossiers.cadrages, file: fichiers.cadrage }) ??
      new Map(),
  );
  const writes = [];
  const anomalies = [];

  for (const [id, target] of expected) {
    if (target.enonce === null) {
      anomalies.push(createError('enonce-non-fourni', { cible: id }));
      continue;
    }

    const collection = target.collection ?? 'rules';
    const existing = repo[collection]?.get(id);

    // What the specification decides and the scoping does not dictate. For a
    // rule, the link to features; for an architecture document, its kind and
    // the components it links; for a rule or a decision, what it applies from
    // another specification — RG-regle-du-socle-citee. The propagation
    // preserves them, it never chooses them.
    const own = {
      ...(collection === 'rules'
        ? { fonctionnalites: existing?.fonctionnalites ?? [] }
        : {
            ...(existing?.nature !== undefined ? { nature: existing.nature } : {}),
            ...(existing?.composants !== undefined ? { composants: existing.composants } : {}),
          }),
      ...(existing?.applique !== undefined ? { applique: existing.applique } : {}),
    };

    // A rule must be findable through the specification's navigation, which
    // goes through the features. Architecture targets are consulted by their
    // directory: nothing to require on that side.
    if (collection === 'rules' && !existing && !own.fonctionnalites.length) {
      anomalies.push(createError('regle-creee-sans-rattachement', { regle: id }));
      continue;
    }

    const content = formatRule(target, own, target.enonce);
    const path = join(root, dossiers[DOSSIER_DE_COLLECTION[collection]], `${id}.md`);
    const current = existing ? readFileSync(path, 'utf8') : null;

    if (current !== content) {
      writes.push({
        chemin: path,
        id,
        contenu: content,
        operation: existing ? 'mise à jour' : 'création',
      });
    }
  }

  // `problemes` keeps yesterday's textual form, in French; `anomalies` says
  // the same thing through codes, for whoever renders it in their language.
  return { ecritures: writes, problemes: enTexte(anomalies).errors, anomalies, repo };
}

/** Applies the computed writes. */
export function propagate(root, { dryRun = false } = {}) {
  // The integrity check comes first: propagating onto an inconsistent
  // specification would produce an even more inconsistent one.
  //
  // But the checks on derived indexes are omitted, since the propagation
  // writes them: requiring them correct here would make any desynchronisation
  // impossible to fix, the propagation being blocked by what it repairs.
  // Read only once and passed to both steps: two reads could differ, and the
  // check would then bear on another specification than the one being
  // propagated.
  const delivered = deliveredInRepo(root, readNames(root).dossiers.cadrages);

  const integrity = check(root, { ignorerIndexDerives: true, livres: delivered });
  if (integrity.errors.length) {
    const anomalies = integrity.anomalies
      .filter((a) => a.gravite === 'erreur')
      .map((anomalie) => createError('integrite-avant-propagation', { anomalie }));
    return { ok: false, ecritures: [], problemes: enTexte(anomalies).errors, anomalies };
  }

  const { ecritures: writes, problemes: problems, anomalies } = computeWrites(root, delivered);
  if (problems.length) {
    return { ok: false, ecritures: [], problemes: problems, anomalies };
  }

  if (!dryRun) {
    for (const w of writes) writeFileSync(w.chemin, w.contenu, 'utf8');
  }
  return { ok: true, ecritures: writes, problemes: [], anomalies: [] };
}

// direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const root = args.find((a) => !a.startsWith('--')) ?? '.';

  const { ok, ecritures: writes, anomalies } = propagate(root, { dryRun });

  // The report is given in the repo's language — RG-langue-du-depot. The
  // Action reads the number of writes from it, at the start of the line: it
  // stays the first word.
  const language = languageOf(root);
  const say = (code, params = {}) => formaterAnomalie({ code, params }, language);

  if (!ok) {
    const { errors } = enTexte(anomalies, language);
    console.log(`\n${say('rapport-propagation-problemes', { nombre: errors.length })}`);
    for (const p of errors) console.log(`  ✗ ${p}`);
    process.exit(1);
  }

  if (!writes.length) {
    console.log(say('rapport-propagation-a-jour'));
    process.exit(0);
  }

  console.log(say('rapport-propagation-ecritures', { nombre: writes.length, simulation: dryRun }));
  for (const w of writes) console.log(`  ${w.operation === 'création' ? '+' : '~'} ${w.id}`);
  if (dryRun) console.log(`\n${say('rapport-propagation-simulation')}`);
}
