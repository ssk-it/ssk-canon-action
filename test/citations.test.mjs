// Tests of citing another specification — RG-regle-du-socle-citee,
// RG-citation-signalee-chez-le-citant, RG-prefixe-projet.
//
// What they protect: a rule or an architecture decision cites, through its
// `applique` field, a target of another specification that the citing one
// declares in `referentiels_cites`. The check warns when the target has changed
// since the noted scoping, is repealed or missing, or could not be read — and
// never makes it an error: the change comes from another repo, and blocking
// would fail pull requests that have nothing to do with it.
//
//   node test/citations.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lireCitation,
  referentielsCites,
  resoudrePrefixe,
  comparerCadrages,
  etatDesCitations,
  etatDeCible,
  verifierCitations,
} from '../src/citations.mjs';
import { checkRepo } from '../src/verifier.mjs';
import * as library from '../src/verifier.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';
import { check, loadCitedSpecifications } from '../src/check.mjs';

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const equal = (actual, expected, message = '') =>
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}\n    actual   ${JSON.stringify(actual)}\n    expected ${JSON.stringify(expected)}`,
  );

// --- the form of a citation ---

await test('a citation is read as prefix, identifier and noted scoping', () => {
  equal(lireCitation('socle:RG-nommage-des-roles@2026-012'), {
    prefixe: 'socle',
    id: 'RG-nommage-des-roles',
    cadrage: '2026-012',
  });
  equal(lireCitation('socle:ADR-runners@2026-003').id, 'ADR-runners');
});

await test('a citation without prefix, without scoping or malformed is not read', () => {
  for (const t of ['RG-x@2026-001', 'socle:RG-x', 'socle:RG-x@demain', '2026:RG-x@2026-001', ':RG-x@2026-001', 42, null])
    equal(lireCitation(t), null, `“${t}”`);
});

await test('two scopings compare by year then by number, not by text', () => {
  assert(comparerCadrages('2026-012', '2026-003') > 0, '012 after 003');
  assert(comparerCadrages('2026-999', '2026-1000') < 0, '999 before 1000');
  assert(comparerCadrages('2025-900', '2026-001') < 0, '2025 before 2026');
  equal(comparerCadrages('2026-012', '2026-012'), 0);
});

// --- the declaration of the cited specifications ---

const config = (extra = {}) => ({ projet: { nom: 'App', prefixe: 'APP' }, ...extra });

await test('referentiels_cites maps each prefix to its repo', () => {
  const { cites, anomalies } = referentielsCites(
    config({ referentiels_cites: [{ prefixe: 'socle', repo: 'Vanex/prime-infra-cadrage' }] }),
  );
  equal([...cites], [['socle', 'Vanex/prime-infra-cadrage']]);
  equal(anomalies, []);
});

await test('without referentiels_cites, no specification is cited, and nothing is reported', () => {
  const { cites, anomalies } = referentielsCites(config());
  equal(cites.size, 0);
  equal(anomalies, []);
  equal(referentielsCites(null).cites.size, 0);
});

await test('a faulty declaration warns and is discarded, without blocking', () => {
  const { cites, anomalies } = referentielsCites(
    config({
      referentiels_cites: [
        { prefixe: 'socle', repo: 'o/a' },
        { prefixe: 'socle', repo: 'o/b' },
        { prefixe: 'APP', repo: 'o/c' },
        { prefixe: '2x', repo: 'o/d' },
        { prefixe: 'ok', repo: 'pas-un-depot' },
        'socle',
      ],
    }),
  );
  equal([...cites], [['socle', 'o/a']]);
  equal(
    anomalies.map((a) => [a.code, a.gravite, a.params]),
    [
      ['referentiel-cite-en-double', 'avertissement', { prefixe: 'socle' }],
      ['referentiel-cite-prefixe-du-projet', 'avertissement', { prefixe: 'APP' }],
      ['referentiel-cite-mal-forme', 'avertissement', { position: 4 }],
      ['referentiel-cite-mal-forme', 'avertissement', { position: 5 }],
      ['referentiel-cite-mal-forme', 'avertissement', { position: 6 }],
    ],
  );
  equal(referentielsCites(config({ referentiels_cites: 'socle' })).anomalies[0].code, 'referentiels-cites-mal-forme');
});

await test('a prefix designates the project, a cited specification, or an unknown address', () => {
  const c = config({ referentiels_cites: [{ prefixe: 'socle', repo: 'o/socle' }] });
  equal(resoudrePrefixe('APP', c), { nature: 'projet' });
  equal(resoudrePrefixe('socle', c), { nature: 'cite', repo: 'o/socle' });
  equal(resoudrePrefixe('autre', c), { nature: 'inconnue' });
  // a well-formed identifier is not enough to make the address known
  equal(resoudrePrefixe('APP', config({ projet: {} })), { nature: 'inconnue' });
});

// --- the state of the citations ---

function specification({ rules = [], decisions = [], cfg = config() } = {}) {
  return {
    config: cfg,
    domains: new Map([['d', { id: 'd' }]]),
    features: new Map([['f', { id: 'f', domaines: ['d'] }]]),
    rules: new Map(rules.map((r) => [r.id, { statut: 'actif', fonctionnalites: ['f'], ...r }])),
    decisions: new Map(decisions.map((d) => [d.id, { statut: 'actif', ...d }])),
    architecture: new Map(),
    cadrages: new Map(),
  };
}

const WITH_SOCLE = config({ referentiels_cites: [{ prefixe: 'socle', repo: 'o/socle' }] });

const socle = specification({
  rules: [
    { id: 'RG-nommage', cree_par: '2026-003', modifie_par: [] },
    { id: 'RG-modifiee', cree_par: '2026-003', modifie_par: ['2026-010', '2026-014'] },
    { id: 'RG-abrogee', statut: 'abroge', cree_par: '2026-003', modifie_par: ['2026-011'] },
  ],
  decisions: [{ id: 'ADR-runners', cree_par: '2026-004', modifie_par: [] }],
});

function citing(applique, { onAdr = false, cfg = WITH_SOCLE } = {}) {
  return onAdr
    ? specification({ cfg, decisions: [{ id: 'ADR-moi', applique }] })
    : specification({ cfg, rules: [{ id: 'RG-moi', applique }] });
}

await test('an up-to-date citation is said to be up to date, and does not warn', () => {
  const repo = citing(['socle:RG-nommage@2026-003', 'socle:RG-modifiee@2026-014']);
  const cites = new Map([['socle', socle]]);
  equal(
    etatDesCitations(repo, { cites }).map((c) => [c.source, c.nature, c.texte, c.etat, c.repo]),
    [
      ['RG-moi', 'regle', 'socle:RG-nommage@2026-003', 'a-jour', 'o/socle'],
      ['RG-moi', 'regle', 'socle:RG-modifiee@2026-014', 'a-jour', 'o/socle'],
    ],
  );
  equal(verifierCitations(repo, { cites }), []);
});

await test('a target modified by a scoping more recent than the noted one warns', () => {
  const repo = citing(['socle:RG-modifiee@2026-003']);
  const [a] = verifierCitations(repo, { cites: new Map([['socle', socle]]) });
  equal(a, {
    code: 'citation-perimee',
    gravite: 'avertissement',
    params: {
      nature: 'regle',
      source: 'RG-moi',
      citation: 'socle:RG-modifiee@2026-003',
      repo: 'o/socle',
      notee: '2026-003',
      recents: ['2026-010', '2026-014'],
    },
  });
  equal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique socle:RG-modifiee@2026-003 : modifiée depuis par 2026-010, 2026-014 dans o/socle — un cadrage doit en prendre acte',
  );
  equal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applies socle:RG-modifiee@2026-003: modified since by 2026-010, 2026-014 in o/socle — a scoping must take note of it',
  );
});

await test('a repealed target warns as repealed, not as modified', () => {
  const repo = citing(['socle:RG-abrogee@2026-003']);
  const anomalies = verifierCitations(repo, { cites: new Map([['socle', socle]]) });
  equal(anomalies.map((a) => a.code), ['citation-abrogee']);
  equal(anomalies[0].params.cadrage, '2026-011');
  equal(
    formaterAnomalie(anomalies[0], 'fr'),
    'règle RG-moi → applique socle:RG-abrogee@2026-003 : abrogée par 2026-011 dans o/socle',
  );
  equal(
    formaterAnomalie(anomalies[0], 'en'),
    'rule RG-moi → applies socle:RG-abrogee@2026-003: repealed by 2026-011 in o/socle',
  );
});

await test('a missing target warns', () => {
  const repo = citing(['socle:RG-disparue@2026-003'], { onAdr: true });
  const [a] = verifierCitations(repo, { cites: new Map([['socle', socle]]) });
  equal([a.code, a.gravite, a.params.nature, a.params.source], ['citation-absente', 'avertissement', 'adr', 'ADR-moi']);
  equal(
    formaterAnomalie(a, 'fr'),
    "décision d'architecture ADR-moi → applique socle:RG-disparue@2026-003 : introuvable dans o/socle",
  );
  equal(
    formaterAnomalie(a, 'en'),
    'architecture decision ADR-moi → applies socle:RG-disparue@2026-003: not found in o/socle',
  );
});

await test('a cited architecture decision is found among the decisions', () => {
  equal(verifierCitations(citing(['socle:ADR-runners@2026-004']), { cites: new Map([['socle', socle]]) }), []);
});

await test('a cited specification that could not be read leaves the citation not verified, which does not mean valid', () => {
  const repo = citing(['socle:RG-nommage@2026-003']);
  for (const cites of [new Map([['socle', null]]), new Map(), undefined]) {
    const [a] = verifierCitations(repo, cites ? { cites } : {});
    equal([a.code, a.gravite, a.params.repo], ['citation-non-verifiee', 'avertissement', 'o/socle']);
    equal(etatDesCitations(repo, cites ? { cites } : {})[0].etat, 'non-verifiee');
  }
  const [a] = verifierCitations(repo, {});
  equal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique socle:RG-nommage@2026-003 : non vérifiée, o/socle n’a pas pu être lu — ce qui ne veut pas dire valide',
  );
  equal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applies socle:RG-nommage@2026-003: not verified, o/socle could not be read — which does not mean valid',
  );
});

await test('an unknown prefix is an unknown address', () => {
  const [a] = verifierCitations(citing(['ailleurs:RG-x@2026-001']), {});
  equal([a.code, a.gravite, a.params.prefixe], ['citation-prefixe-inconnu', 'avertissement', 'ailleurs']);
  equal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique ailleurs:RG-x@2026-001 : préfixe « ailleurs » inconnu — ni celui du projet, ni un référentiel déclaré dans referentiels_cites',
  );
  equal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applies ailleurs:RG-x@2026-001: unknown prefix “ailleurs” — neither the project’s nor a repo declared in referentiels_cites',
  );
});

await test('a malformed citation, or an applique that is not a list, warns', () => {
  const [a] = verifierCitations(citing(['RG-x']), {});
  equal([a.code, a.gravite, a.params.texte], ['citation-mal-formee', 'avertissement', 'RG-x']);
  equal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique « RG-x » : attendu <préfixe>:<identifiant>@<cadrage>, par exemple socle:RG-nommage-des-roles@2026-012',
  );
  equal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applique “RG-x”: expected <prefix>:<id>@<scoping>, for example socle:RG-nommage-des-roles@2026-012',
  );
  equal(verifierCitations(citing('socle:RG-nommage@2026-003'), {}).map((x) => x.code), ['citation-mal-formee']);
});

await test('the project’s prefix cites the specification itself', () => {
  const repo = specification({
    rules: [
      { id: 'RG-moi', applique: ['APP:RG-voisine@2026-001'] },
      { id: 'RG-voisine', modifie_par: ['2026-002'] },
    ],
  });
  const [a] = verifierCitations(repo, {});
  equal([a.code, a.params.repo, a.params.recents], ['citation-perimee', null, ['2026-002']]);
  equal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique APP:RG-voisine@2026-001 : modifiée depuis par 2026-002 dans ce référentiel — un cadrage doit en prendre acte',
  );
  equal(formaterAnomalie(a, 'en').includes('in this repo'), true);
});

await test('the state of a citation is also computed against its target alone, for whoever read it elsewhere', () => {
  const c = lireCitation('socle:RG-x@2026-003');
  equal(etatDeCible(c, { statut: 'actif', modifie_par: [] }), { etat: 'a-jour' });
  equal(etatDeCible(c, { statut: 'actif', modifie_par: ['2026-002', '2026-010'] }), { etat: 'perimee', recents: ['2026-010'] });
  equal(etatDeCible(c, { statut: 'abroge', modifie_par: ['2026-011'] }), { etat: 'abrogee', cadrage: '2026-011' });
  equal(etatDeCible(c, null), { etat: 'absente' });
  equal(etatDeCible(c, undefined, { lu: false }), { etat: 'non-verifiee' });
});

// --- in the check ---

await test('the check carries the citations as warnings, and never as errors', () => {
  const repo = citing(['socle:RG-abrogee@2026-003', 'socle:RG-modifiee@2026-003', 'x', 'nul:RG-x@2026-001'], {
    cfg: config({ referentiels_cites: [...WITH_SOCLE.referentiels_cites, { prefixe: 'socle', repo: 'o/autre' }] }),
  });
  const r = checkRepo(repo, { ignorerIndexDerives: true, cites: new Map([['socle', socle]]) });
  equal(r.errors, []);
  equal(
    r.anomalies.map((a) => a.code),
    ['referentiel-cite-en-double', 'citation-abrogee', 'citation-perimee', 'citation-mal-formee', 'citation-prefixe-inconnu'],
  );
});

await test('without cited specifications provided, the check says its citations are not verified', () => {
  const r = checkRepo(citing(['socle:RG-nommage@2026-003']), { ignorerIndexDerives: true });
  equal(r.anomalies.map((a) => a.code), ['citation-non-verifiee']);
  equal(r.errors, []);
});

await test('the library exposes the citation to whoever reads it, like the rest of the format', () => {
  for (const name of ['lireCitation', 'referentielsCites', 'resoudrePrefixe', 'comparerCadrages', 'etatDesCitations', 'etatDeCible', 'verifierCitations'])
    assert(typeof library[name] === 'function', `${name} is not exported by verifier.mjs`);
});

// --- from the file system ---

function write(root, path, content) {
  const full = join(root, ...path.split('/'));
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}

function citedRepo(root) {
  write(root, 'ssk-canon.yml', 'schema_version: 1\nprojet:\n  nom: Socle\n');
  write(root, 'domains/d.md', '---\nid: d\nnom: D\n---\n');
  write(root, 'features/f.md', '---\nid: f\nnom: F\ndomaines: [d]\n---\n');
  write(
    root,
    'rules/RG-nommage.md',
    "---\nid: RG-nommage\nstatut: actif\nfonctionnalites: [f]\ncree_par: '2026-003'\nmodifie_par: ['2026-009']\n---\n",
  );
}

function citingRepo(root) {
  write(
    root,
    'ssk-canon.yml',
    'schema_version: 1\nprojet:\n  nom: App\nreferentiels_cites:\n  - { prefixe: socle, repo: o/socle }\n  - { prefixe: prive, repo: o/prive }\n',
  );
  write(root, 'domains/d.md', '---\nid: d\nnom: D\n---\n');
  write(root, 'features/f.md', '---\nid: f\nnom: F\ndomaines: [d]\n---\n');
  write(
    root,
    'rules/RG-moi.md',
    "---\nid: RG-moi\nstatut: actif\nfonctionnalites: [f]\napplique: ['socle:RG-nommage@2026-003', 'prive:RG-y@2026-001']\n---\n",
  );
}

await test('the cited specifications are loaded through the repo that obtains them, and an unreachable repo stays unread', () => {
  const root = mkdtempSync(join(tmpdir(), 'canon-cites-'));
  try {
    citedRepo(join(root, 'socle'));
    const requests = [];
    const cites = loadCitedSpecifications(
      { referentiels_cites: [{ prefixe: 'socle', repo: 'o/socle' }, { prefixe: 'prive', repo: 'o/prive' }] },
      { obtenir: (repo) => (requests.push(repo), repo === 'o/socle' ? join(root, 'socle') : null) },
    );
    equal(requests, ['o/socle', 'o/prive']);
    equal([...cites.get('socle').rules.keys()], ['RG-nommage']);
    equal(cites.get('prive'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('check reads the cited specifications under the given folder, and warns without failing', () => {
  const root = mkdtempSync(join(tmpdir(), 'canon-cites-'));
  try {
    citingRepo(join(root, 'app'));
    citedRepo(join(root, 'cites', 'o', 'socle'));
    const r = check(join(root, 'app'), {
      livres: new Set(),
      ignorerIndexDerives: true,
      dossierCites: join(root, 'cites'),
      cloner: false,
    });
    equal(r.errors, []);
    equal(
      r.anomalies.map((a) => [a.code, a.params.citation]),
      [
        ['citation-perimee', 'socle:RG-nommage@2026-003'],
        ['citation-non-verifiee', 'prive:RG-y@2026-001'],
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const e of failures) console.error(`✗ ${e}`);
console.log(`${passed} passed, ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
