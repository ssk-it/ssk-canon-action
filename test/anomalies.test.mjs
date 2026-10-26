// Tests des anomalies codées — RG-anomalies-codees, RG-langue-du-depot.
//
// Ce qu'ils protègent : une anomalie est un code et ses paramètres, et son
// message s'en déduit dans chaque langue, ici et nulle part ailleurs. Un code
// sans message dans l'une des langues, ou employé sans être au catalogue, ne
// se découvrirait sinon qu'au moment où un rédacteur le rencontre. La forme
// textuelle d'hier doit rester mot pour mot celle qu'elle était.
//
//   node test/anomalies.test.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import {
  LANGUES,
  erreur,
  avertissement,
  formaterAnomalie,
  enTexte,
  langueDuDepot,
} from '../src/anomalies.mjs';
import { MESSAGES } from '../src/messages.mjs';
import { checkRepo } from '../src/verifier.mjs';

let reussis = 0;
const echecs = [];

function test(nom, fn) {
  try {
    fn();
    reussis += 1;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  }
}

function egal(obtenu, attendu, message = '') {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${message}\n    obtenu  ${a}\n    attendu ${b}`);
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

// --- le catalogue ---

test('chaque code a son message dans chaque langue', () => {
  const codes = new Set(LANGUES.flatMap((l) => Object.keys(MESSAGES[l])));
  for (const l of LANGUES)
    for (const code of codes)
      vrai(typeof MESSAGES[l][code] === 'function', `« ${code} » sans message en ${l}`);
});

test('chaque code employé par les sources est au catalogue', () => {
  const dossier = new URL('../src/', import.meta.url).pathname;
  const employes = new Set();
  for (const f of readdirSync(dossier).filter((f) => f.endsWith('.mjs'))) {
    const source = readFileSync(join(dossier, f), 'utf8');
    for (const m of source.matchAll(/\b(?:erreur|avertissement)\(\s*'([a-z][a-z0-9-]*)'/g))
      employes.add(m[1]);
  }
  vrai(employes.size > 20, `trop peu de codes trouvés (${employes.size}) : la recherche est-elle juste ?`);
  for (const code of employes) vrai(code in MESSAGES.fr, `« ${code} » employé mais absent du catalogue`);
});

// --- la forme ---

test("une anomalie porte son code, sa gravité et ses paramètres", () => {
  egal(erreur('domaine-inconnu', { source: 'fonctionnalite', id: 'f', domaine: 'd' }), {
    code: 'domaine-inconnu',
    gravite: 'erreur',
    params: { source: 'fonctionnalite', id: 'f', domaine: 'd' },
  });
  egal(avertissement('enonce-sans-impact', { cadrage: '2026-001', cible: 'RG-x' }).gravite, 'avertissement');
});

test('le message se déduit du code, dans chaque langue, sans traduire les valeurs', () => {
  const a = erreur('operation-invalide', { cadrage: '2026-001', operation: 'cree!', cible: 'RG-x' });
  egal(formaterAnomalie(a, 'fr'), 'cadrage 2026-001 → opération invalide « cree! » sur RG-x');
  egal(formaterAnomalie(a, 'en'), 'scoping 2026-001 → invalid operation “cree!” on RG-x');
});

test('le français est la langue par défaut, et une langue inconnue se lit en français', () => {
  const a = erreur('identifiant-manquant', { chemin: 'domains/x.md' });
  egal(formaterAnomalie(a), 'domains/x.md : identifiant manquant');
  egal(formaterAnomalie(a, 'de'), 'domains/x.md : identifiant manquant');
});

test('une anomalie qui en enveloppe une autre la dit dans la même langue', () => {
  const a = erreur('a-la-livraison', {
    anomalie: erreur('cible-inconnue', { cadrage: '2026-001', nature: 'regle', cible: 'RG-x' }),
  });
  egal(formaterAnomalie(a, 'fr'), 'à la livraison : cadrage 2026-001 → règle inconnue : RG-x');
  egal(formaterAnomalie(a, 'en'), 'at delivery: scoping 2026-001 → unknown rule: RG-x');
});

test("un message déjà rédigé par l'appelant se rend tel quel, dans toute langue", () => {
  const a = erreur('message', { texte: 'Le dépôt ne répond pas.' });
  egal(formaterAnomalie(a, 'en'), 'Le dépôt ne répond pas.');
});

test('les anomalies se rendent en textes, erreurs et avertissements séparés', () => {
  const anomalies = [
    erreur('identifiant-manquant', { chemin: 'a.md' }),
    avertissement('enonce-sans-impact', { cadrage: '2026-001', cible: 'RG-x' }),
  ];
  egal(enTexte(anomalies, 'en'), {
    errors: ['a.md: missing identifier'],
    warnings: ['scoping 2026-001: statement for RG-x without a declared impact'],
  });
});

// --- la vérification ---

function repoVide(extra = {}) {
  return {
    domains: new Map(),
    features: new Map(),
    rules: new Map(),
    cadrages: new Map(),
    ...extra,
  };
}

test("checkRepo rend ses anomalies codées, et leur forme textuelle d'hier, mot pour mot", () => {
  const repo = repoVide({
    features: new Map([['f', { id: 'f', domaines: ['inconnu'] }]]),
    cadrages: new Map([
      ['2026-001', { id: '2026-001', statut: 'brouillon', impacts: [{ regle: 'RG-x', operation: 'cree' }], body: '' }],
    ]),
  });
  const r = checkRepo(repo);
  egal(r.errors, [
    'fonctionnalité f → domaine inconnu : inconnu',
    "cadrage 2026-001 : le statut ne se déclare pas, il se déduit de l'état du dépôt",
    'cadrage 2026-001 → impact « cree » sur RG-x sans énoncé correspondant dans « ## Énoncés »',
  ]);
  egal(
    r.anomalies.map((a) => a.code),
    ['domaine-inconnu', 'statut-declare', 'enonce-manquant'],
  );
  egal(enTexte(r.anomalies, 'en').errors, [
    'feature f → unknown domain: inconnu',
    'scoping 2026-001: the status is not declared, it derives from the repo state',
    'scoping 2026-001 → “cree” impact on RG-x without a matching statement in “## Énoncés”',
  ]);
});

test("une erreur de chargement passée en texte reste une anomalie, rendue telle quelle", () => {
  const r = checkRepo(repoVide({ errors: ['x.md : frontmatter illisible'] }));
  egal(r.errors, ['x.md : frontmatter illisible']);
  egal(r.anomalies[0].code, 'message');
});

// --- la langue du dépôt ---

test('un dépôt sans langue déclarée est en français', () => {
  egal(langueDuDepot(null), { langue: 'fr', anomalies: [] });
  egal(langueDuDepot(loadYaml('projet: { nom: X }')), { langue: 'fr', anomalies: [] });
});

test('un dépôt déclare sa langue dans ssk-canon.yml', () => {
  egal(langueDuDepot(loadYaml('langue: en')).langue, 'en');
  egal(langueDuDepot(loadYaml('langue: fr')).langue, 'fr');
});

test('une langue inconnue est signalée, et le dépôt se lit en français', () => {
  const { langue, anomalies } = langueDuDepot(loadYaml('langue: de'));
  egal(langue, 'fr');
  egal(anomalies.map((a) => [a.code, a.gravite]), [['langue-inconnue', 'avertissement']]);
  egal(formaterAnomalie(anomalies[0], 'fr'), 'ssk-canon.yml → langue « de » : attendu fr ou en — le dépôt se lit en français');
});

test('checkRepo signale une langue inconnue', () => {
  const r = checkRepo(repoVide({ config: { langue: 'de' } }));
  vrai(r.anomalies.some((a) => a.code === 'langue-inconnue'), 'langue inconnue non signalée');
});

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const e of echecs) console.log(`  ✗ ${e}`);
if (echecs.length) process.exit(1);
