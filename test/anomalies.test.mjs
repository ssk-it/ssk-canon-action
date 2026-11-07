// Tests of coded anomalies — RG-anomalies-codees, RG-langue-du-depot.
//
// What they protect: an anomaly is a code and its parameters, and its message
// derives from them in each language, here and nowhere else. A code without a
// message in one of the languages, or used without being in the catalogue,
// would otherwise only be discovered when an author runs into it. Yesterday's
// text form must stay word for word what it was.
//
//   node test/anomalies.test.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import {
  LANGUES,
  createError,
  createWarning,
  formaterAnomalie,
  enTexte,
  langueDuDepot,
} from '../src/anomalies.mjs';
import { MESSAGES } from '../src/messages.mjs';
import { checkRepo } from '../src/verifier.mjs';

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

function equal(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message}\n    actual   ${a}\n    expected ${b}`);
}

function isTrue(condition, message) {
  if (!condition) throw new Error(message);
}

// --- the catalogue ---

test('each code has its message in each language', () => {
  const codes = new Set(LANGUES.flatMap((l) => Object.keys(MESSAGES[l])));
  for (const l of LANGUES)
    for (const code of codes)
      isTrue(typeof MESSAGES[l][code] === 'function', `“${code}” without a message in ${l}`);
});

test('each code used by the sources is in the catalogue', () => {
  const folder = new URL('../src/', import.meta.url).pathname;
  const used = new Set();
  for (const f of readdirSync(folder).filter((f) => f.endsWith('.mjs'))) {
    const source = readFileSync(join(folder, f), 'utf8');
    for (const m of source.matchAll(/\b(?:createError|createWarning)\(\s*'([a-z][a-z0-9-]*)'/g))
      used.add(m[1]);
  }
  isTrue(used.size > 20, `too few codes found (${used.size}): is the search right?`);
  for (const code of used) isTrue(code in MESSAGES.fr, `“${code}” used but missing from the catalogue`);
});

// --- the shape ---

test('an anomaly carries its code, its severity and its parameters', () => {
  equal(createError('domaine-inconnu', { source: 'fonctionnalite', id: 'f', domaine: 'd' }), {
    code: 'domaine-inconnu',
    gravite: 'erreur',
    params: { source: 'fonctionnalite', id: 'f', domaine: 'd' },
  });
  equal(createWarning('enonce-sans-impact', { cadrage: '2026-001', cible: 'RG-x' }).gravite, 'avertissement');
});

test('the message derives from the code, in each language, without translating the values', () => {
  const a = createError('operation-invalide', { cadrage: '2026-001', operation: 'cree!', cible: 'RG-x' });
  equal(formaterAnomalie(a, 'fr'), 'cadrage 2026-001 → opération invalide « cree! » sur RG-x');
  equal(formaterAnomalie(a, 'en'), 'scoping 2026-001 → invalid operation “cree!” on RG-x');
});

test('French is the default language, and an unknown language reads as French', () => {
  const a = createError('identifiant-manquant', { chemin: 'domains/x.md' });
  equal(formaterAnomalie(a), 'domains/x.md : identifiant manquant');
  equal(formaterAnomalie(a, 'de'), 'domains/x.md : identifiant manquant');
});

test('an anomaly wrapping another states it in the same language', () => {
  const a = createError('a-la-livraison', {
    anomalie: createError('cible-inconnue', { cadrage: '2026-001', nature: 'regle', cible: 'RG-x' }),
  });
  equal(formaterAnomalie(a, 'fr'), 'à la livraison : cadrage 2026-001 → règle inconnue : RG-x');
  equal(formaterAnomalie(a, 'en'), 'at delivery: scoping 2026-001 → unknown rule: RG-x');
});

test('a message already written by the caller is rendered as is, in any language', () => {
  const a = createError('message', { texte: 'Le dépôt ne répond pas.' });
  equal(formaterAnomalie(a, 'en'), 'Le dépôt ne répond pas.');
});

test('anomalies are rendered as texts, errors and warnings apart', () => {
  const anomalies = [
    createError('identifiant-manquant', { chemin: 'a.md' }),
    createWarning('enonce-sans-impact', { cadrage: '2026-001', cible: 'RG-x' }),
  ];
  equal(enTexte(anomalies, 'en'), {
    errors: ['a.md: missing identifier'],
    warnings: ['scoping 2026-001: statement for RG-x without a declared impact'],
  });
});

// --- the check ---

function emptyRepo(extra = {}) {
  return {
    domains: new Map(),
    features: new Map(),
    rules: new Map(),
    cadrages: new Map(),
    ...extra,
  };
}

test("checkRepo returns its coded anomalies, and yesterday's text form, word for word", () => {
  const repo = emptyRepo({
    features: new Map([['f', { id: 'f', domaines: ['inconnu'] }]]),
    cadrages: new Map([
      ['2026-001', { id: '2026-001', statut: 'brouillon', impacts: [{ regle: 'RG-x', operation: 'cree' }], body: '' }],
    ]),
  });
  const r = checkRepo(repo);
  equal(r.errors, [
    'fonctionnalité f → domaine inconnu : inconnu',
    "cadrage 2026-001 : le statut ne se déclare pas, il se déduit de l'état du dépôt",
    'cadrage 2026-001 → impact « cree » sur RG-x sans énoncé correspondant dans « ## Énoncés »',
  ]);
  equal(
    r.anomalies.map((a) => a.code),
    ['domaine-inconnu', 'statut-declare', 'enonce-manquant'],
  );
  equal(enTexte(r.anomalies, 'en').errors, [
    'feature f → unknown domain: inconnu',
    'scoping 2026-001: the status is not declared, it derives from the repo state',
    'scoping 2026-001 → “cree” impact on RG-x without a matching statement in “## Énoncés”',
  ]);
});

test('a loading error passed as text stays an anomaly, rendered as is', () => {
  const r = checkRepo(emptyRepo({ errors: ['x.md : frontmatter illisible'] }));
  equal(r.errors, ['x.md : frontmatter illisible']);
  equal(r.anomalies[0].code, 'message');
});

// --- the repo language ---

test('a repo without a declared language is in French', () => {
  equal(langueDuDepot(null), { langue: 'fr', anomalies: [] });
  equal(langueDuDepot(loadYaml('projet: { nom: X }')), { langue: 'fr', anomalies: [] });
});

test('a repo declares its language in ssk-canon.yml', () => {
  equal(langueDuDepot(loadYaml('langue: en')).langue, 'en');
  equal(langueDuDepot(loadYaml('langue: fr')).langue, 'fr');
});

test('an unknown language is reported, and the repo reads as French', () => {
  const { langue, anomalies } = langueDuDepot(loadYaml('langue: de'));
  equal(langue, 'fr');
  equal(anomalies.map((a) => [a.code, a.gravite]), [['langue-inconnue', 'avertissement']]);
  equal(formaterAnomalie(anomalies[0], 'fr'), 'ssk-canon.yml → langue « de » : attendu fr ou en — le dépôt se lit en français');
});

test('checkRepo reports an unknown language', () => {
  const r = checkRepo(emptyRepo({ config: { langue: 'de' } }));
  isTrue(r.anomalies.some((a) => a.code === 'langue-inconnue'), 'unknown language not reported');
});

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const e of failures) console.log(`  ✗ ${e}`);
if (failures.length) process.exit(1);
