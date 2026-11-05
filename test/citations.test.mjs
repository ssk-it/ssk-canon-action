// Tests de la citation d'un autre référentiel — RG-regle-du-socle-citee,
// RG-citation-signalee-chez-le-citant, RG-prefixe-projet.
//
// Ce qu'ils protègent : une règle ou une décision d'architecture cite, par son
// champ `applique`, une cible d'un autre référentiel que le citant déclare dans
// `referentiels_cites`. La vérification avertit quand la cible a changé depuis
// le cadrage noté, qu'elle est abrogée ou absente, ou qu'elle n'a pas pu être
// lue — et n'en fait jamais une erreur : le changement vient d'un autre dépôt,
// et bloquer ferait échouer des demandes de fusion qui n'y sont pour rien.
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
  verifierCitations,
} from '../src/citations.mjs';
import { checkRepo } from '../src/verifier.mjs';
import * as bibliotheque from '../src/verifier.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';
import { check, chargerReferentielsCites } from '../src/check.mjs';

let reussis = 0;
const echecs = [];

async function test(nom, fn) {
  try {
    await fn();
    reussis += 1;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  }
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

const egal = (obtenu, attendu, message = '') =>
  vrai(
    JSON.stringify(obtenu) === JSON.stringify(attendu),
    `${message}\n    obtenu  ${JSON.stringify(obtenu)}\n    attendu ${JSON.stringify(attendu)}`,
  );

// --- la forme d'une citation ---

await test('une citation se lit en préfixe, identifiant et cadrage noté', () => {
  egal(lireCitation('socle:RG-nommage-des-roles@2026-012'), {
    prefixe: 'socle',
    id: 'RG-nommage-des-roles',
    cadrage: '2026-012',
  });
  egal(lireCitation('socle:ADR-runners@2026-003').id, 'ADR-runners');
});

await test('une citation sans préfixe, sans cadrage ou mal formée ne se lit pas', () => {
  for (const t of ['RG-x@2026-001', 'socle:RG-x', 'socle:RG-x@demain', '2026:RG-x@2026-001', ':RG-x@2026-001', 42, null])
    egal(lireCitation(t), null, `« ${t} »`);
});

await test('deux cadrages se comparent par année puis par numéro, non par texte', () => {
  vrai(comparerCadrages('2026-012', '2026-003') > 0, '012 après 003');
  vrai(comparerCadrages('2026-999', '2026-1000') < 0, '999 avant 1000');
  vrai(comparerCadrages('2025-900', '2026-001') < 0, '2025 avant 2026');
  egal(comparerCadrages('2026-012', '2026-012'), 0);
});

// --- la déclaration des référentiels cités ---

const config = (extra = {}) => ({ projet: { nom: 'App', prefixe: 'APP' }, ...extra });

await test('referentiels_cites associe chaque préfixe à son dépôt', () => {
  const { cites, anomalies } = referentielsCites(
    config({ referentiels_cites: [{ prefixe: 'socle', repo: 'Vanex/prime-infra-cadrage' }] }),
  );
  egal([...cites], [['socle', 'Vanex/prime-infra-cadrage']]);
  egal(anomalies, []);
});

await test('sans referentiels_cites, aucun référentiel n’est cité, et rien ne se signale', () => {
  const { cites, anomalies } = referentielsCites(config());
  egal(cites.size, 0);
  egal(anomalies, []);
  egal(referentielsCites(null).cites.size, 0);
});

await test('une déclaration fautive s’avertit et s’écarte, sans bloquer', () => {
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
  egal([...cites], [['socle', 'o/a']]);
  egal(
    anomalies.map((a) => [a.code, a.gravite, a.params]),
    [
      ['referentiel-cite-en-double', 'avertissement', { prefixe: 'socle' }],
      ['referentiel-cite-prefixe-du-projet', 'avertissement', { prefixe: 'APP' }],
      ['referentiel-cite-mal-forme', 'avertissement', { position: 4 }],
      ['referentiel-cite-mal-forme', 'avertissement', { position: 5 }],
      ['referentiel-cite-mal-forme', 'avertissement', { position: 6 }],
    ],
  );
  egal(referentielsCites(config({ referentiels_cites: 'socle' })).anomalies[0].code, 'referentiels-cites-mal-forme');
});

await test('un préfixe désigne le projet, un référentiel cité, ou une adresse inconnue', () => {
  const c = config({ referentiels_cites: [{ prefixe: 'socle', repo: 'o/socle' }] });
  egal(resoudrePrefixe('APP', c), { nature: 'projet' });
  egal(resoudrePrefixe('socle', c), { nature: 'cite', repo: 'o/socle' });
  egal(resoudrePrefixe('autre', c), { nature: 'inconnue' });
  // un identifiant bien formé ne suffit pas à rendre l'adresse connue
  egal(resoudrePrefixe('APP', config({ projet: {} })), { nature: 'inconnue' });
});

// --- l'état des citations ---

function referentiel({ rules = [], decisions = [], cfg = config() } = {}) {
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

const AVEC_SOCLE = config({ referentiels_cites: [{ prefixe: 'socle', repo: 'o/socle' }] });

const socle = referentiel({
  rules: [
    { id: 'RG-nommage', cree_par: '2026-003', modifie_par: [] },
    { id: 'RG-modifiee', cree_par: '2026-003', modifie_par: ['2026-010', '2026-014'] },
    { id: 'RG-abrogee', statut: 'abroge', cree_par: '2026-003', modifie_par: ['2026-011'] },
  ],
  decisions: [{ id: 'ADR-runners', cree_par: '2026-004', modifie_par: [] }],
});

function citant(applique, { surAdr = false, cfg = AVEC_SOCLE } = {}) {
  return surAdr
    ? referentiel({ cfg, decisions: [{ id: 'ADR-moi', applique }] })
    : referentiel({ cfg, rules: [{ id: 'RG-moi', applique }] });
}

await test('une citation à jour est dite à jour, et ne s’avertit pas', () => {
  const repo = citant(['socle:RG-nommage@2026-003', 'socle:RG-modifiee@2026-014']);
  const cites = new Map([['socle', socle]]);
  egal(
    etatDesCitations(repo, { cites }).map((c) => [c.source, c.nature, c.texte, c.etat, c.repo]),
    [
      ['RG-moi', 'regle', 'socle:RG-nommage@2026-003', 'a-jour', 'o/socle'],
      ['RG-moi', 'regle', 'socle:RG-modifiee@2026-014', 'a-jour', 'o/socle'],
    ],
  );
  egal(verifierCitations(repo, { cites }), []);
});

await test('une cible modifiée par un cadrage plus récent que celui noté s’avertit', () => {
  const repo = citant(['socle:RG-modifiee@2026-003']);
  const [a] = verifierCitations(repo, { cites: new Map([['socle', socle]]) });
  egal(a, {
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
  egal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique socle:RG-modifiee@2026-003 : modifiée depuis par 2026-010, 2026-014 dans o/socle — un cadrage doit en prendre acte',
  );
  egal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applies socle:RG-modifiee@2026-003: modified since by 2026-010, 2026-014 in o/socle — a scoping must take note of it',
  );
});

await test('une cible abrogée s’avertit comme abrogée, non comme modifiée', () => {
  const repo = citant(['socle:RG-abrogee@2026-003']);
  const anomalies = verifierCitations(repo, { cites: new Map([['socle', socle]]) });
  egal(anomalies.map((a) => a.code), ['citation-abrogee']);
  egal(anomalies[0].params.cadrage, '2026-011');
  egal(
    formaterAnomalie(anomalies[0], 'fr'),
    'règle RG-moi → applique socle:RG-abrogee@2026-003 : abrogée par 2026-011 dans o/socle',
  );
  egal(
    formaterAnomalie(anomalies[0], 'en'),
    'rule RG-moi → applies socle:RG-abrogee@2026-003: repealed by 2026-011 in o/socle',
  );
});

await test('une cible absente s’avertit', () => {
  const repo = citant(['socle:RG-disparue@2026-003'], { surAdr: true });
  const [a] = verifierCitations(repo, { cites: new Map([['socle', socle]]) });
  egal([a.code, a.gravite, a.params.nature, a.params.source], ['citation-absente', 'avertissement', 'adr', 'ADR-moi']);
  egal(
    formaterAnomalie(a, 'fr'),
    "décision d'architecture ADR-moi → applique socle:RG-disparue@2026-003 : introuvable dans o/socle",
  );
  egal(
    formaterAnomalie(a, 'en'),
    'architecture decision ADR-moi → applies socle:RG-disparue@2026-003: not found in o/socle',
  );
});

await test('une décision d’architecture citée se trouve parmi les décisions', () => {
  egal(verifierCitations(citant(['socle:ADR-runners@2026-004']), { cites: new Map([['socle', socle]]) }), []);
});

await test('un référentiel cité qui n’a pas pu être lu rend la citation non vérifiée, ce qui ne veut pas dire valide', () => {
  const repo = citant(['socle:RG-nommage@2026-003']);
  for (const cites of [new Map([['socle', null]]), new Map(), undefined]) {
    const [a] = verifierCitations(repo, cites ? { cites } : {});
    egal([a.code, a.gravite, a.params.repo], ['citation-non-verifiee', 'avertissement', 'o/socle']);
    egal(etatDesCitations(repo, cites ? { cites } : {})[0].etat, 'non-verifiee');
  }
  const [a] = verifierCitations(repo, {});
  egal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique socle:RG-nommage@2026-003 : non vérifiée, o/socle n’a pas pu être lu — ce qui ne veut pas dire valide',
  );
  egal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applies socle:RG-nommage@2026-003: not verified, o/socle could not be read — which does not mean valid',
  );
});

await test('un préfixe inconnu est une adresse inconnue', () => {
  const [a] = verifierCitations(citant(['ailleurs:RG-x@2026-001']), {});
  egal([a.code, a.gravite, a.params.prefixe], ['citation-prefixe-inconnu', 'avertissement', 'ailleurs']);
  egal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique ailleurs:RG-x@2026-001 : préfixe « ailleurs » inconnu — ni celui du projet, ni un référentiel déclaré dans referentiels_cites',
  );
  egal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applies ailleurs:RG-x@2026-001: unknown prefix “ailleurs” — neither the project’s nor a repo declared in referentiels_cites',
  );
});

await test('une citation mal formée, ou un applique qui n’est pas une liste, s’avertit', () => {
  const [a] = verifierCitations(citant(['RG-x']), {});
  egal([a.code, a.gravite, a.params.texte], ['citation-mal-formee', 'avertissement', 'RG-x']);
  egal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique « RG-x » : attendu <préfixe>:<identifiant>@<cadrage>, par exemple socle:RG-nommage-des-roles@2026-012',
  );
  egal(
    formaterAnomalie(a, 'en'),
    'rule RG-moi → applique “RG-x”: expected <prefix>:<id>@<scoping>, for example socle:RG-nommage-des-roles@2026-012',
  );
  egal(verifierCitations(citant('socle:RG-nommage@2026-003'), {}).map((x) => x.code), ['citation-mal-formee']);
});

await test('le préfixe du projet cite le référentiel lui-même', () => {
  const repo = referentiel({
    rules: [
      { id: 'RG-moi', applique: ['APP:RG-voisine@2026-001'] },
      { id: 'RG-voisine', modifie_par: ['2026-002'] },
    ],
  });
  const [a] = verifierCitations(repo, {});
  egal([a.code, a.params.repo, a.params.recents], ['citation-perimee', null, ['2026-002']]);
  egal(
    formaterAnomalie(a, 'fr'),
    'règle RG-moi → applique APP:RG-voisine@2026-001 : modifiée depuis par 2026-002 dans ce référentiel — un cadrage doit en prendre acte',
  );
  egal(formaterAnomalie(a, 'en').includes('in this repo'), true);
});

// --- dans la vérification ---

await test('la vérification porte les citations en avertissements, et jamais en erreurs', () => {
  const repo = citant(['socle:RG-abrogee@2026-003', 'socle:RG-modifiee@2026-003', 'x', 'nul:RG-x@2026-001'], {
    cfg: config({ referentiels_cites: [...AVEC_SOCLE.referentiels_cites, { prefixe: 'socle', repo: 'o/autre' }] }),
  });
  const r = checkRepo(repo, { ignorerIndexDerives: true, cites: new Map([['socle', socle]]) });
  egal(r.errors, []);
  egal(
    r.anomalies.map((a) => a.code),
    ['referentiel-cite-en-double', 'citation-abrogee', 'citation-perimee', 'citation-mal-formee', 'citation-prefixe-inconnu'],
  );
});

await test('sans référentiels cités fournis, la vérification dit ses citations non vérifiées', () => {
  const r = checkRepo(citant(['socle:RG-nommage@2026-003']), { ignorerIndexDerives: true });
  egal(r.anomalies.map((a) => a.code), ['citation-non-verifiee']);
  egal(r.errors, []);
});

await test('la bibliothèque expose la citation à qui la lit, comme le reste du format', () => {
  for (const nom of ['lireCitation', 'referentielsCites', 'resoudrePrefixe', 'comparerCadrages', 'etatDesCitations', 'verifierCitations'])
    vrai(typeof bibliotheque[nom] === 'function', `${nom} n'est pas exporté par verifier.mjs`);
});

// --- depuis le système de fichiers ---

function ecrire(racine, chemin, contenu) {
  const complet = join(racine, ...chemin.split('/'));
  mkdirSync(join(complet, '..'), { recursive: true });
  writeFileSync(complet, contenu);
}

function depotCite(racine) {
  ecrire(racine, 'ssk-canon.yml', 'schema_version: 1\nprojet:\n  nom: Socle\n');
  ecrire(racine, 'domains/d.md', '---\nid: d\nnom: D\n---\n');
  ecrire(racine, 'features/f.md', '---\nid: f\nnom: F\ndomaines: [d]\n---\n');
  ecrire(
    racine,
    'rules/RG-nommage.md',
    "---\nid: RG-nommage\nstatut: actif\nfonctionnalites: [f]\ncree_par: '2026-003'\nmodifie_par: ['2026-009']\n---\n",
  );
}

function depotCitant(racine) {
  ecrire(
    racine,
    'ssk-canon.yml',
    'schema_version: 1\nprojet:\n  nom: App\nreferentiels_cites:\n  - { prefixe: socle, repo: o/socle }\n  - { prefixe: prive, repo: o/prive }\n',
  );
  ecrire(racine, 'domains/d.md', '---\nid: d\nnom: D\n---\n');
  ecrire(racine, 'features/f.md', '---\nid: f\nnom: F\ndomaines: [d]\n---\n');
  ecrire(
    racine,
    'rules/RG-moi.md',
    "---\nid: RG-moi\nstatut: actif\nfonctionnalites: [f]\napplique: ['socle:RG-nommage@2026-003', 'prive:RG-y@2026-001']\n---\n",
  );
}

await test('les référentiels cités se chargent par le dépôt qui les obtient, et un dépôt inaccessible reste non lu', () => {
  const racine = mkdtempSync(join(tmpdir(), 'canon-cites-'));
  try {
    depotCite(join(racine, 'socle'));
    const demandes = [];
    const cites = chargerReferentielsCites(
      { referentiels_cites: [{ prefixe: 'socle', repo: 'o/socle' }, { prefixe: 'prive', repo: 'o/prive' }] },
      { obtenir: (repo) => (demandes.push(repo), repo === 'o/socle' ? join(racine, 'socle') : null) },
    );
    egal(demandes, ['o/socle', 'o/prive']);
    egal([...cites.get('socle').rules.keys()], ['RG-nommage']);
    egal(cites.get('prive'), null);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

await test('check lit les référentiels cités sous le dossier donné, et avertit sans échouer', () => {
  const racine = mkdtempSync(join(tmpdir(), 'canon-cites-'));
  try {
    depotCitant(join(racine, 'app'));
    depotCite(join(racine, 'cites', 'o', 'socle'));
    const r = check(join(racine, 'app'), {
      livres: new Set(),
      ignorerIndexDerives: true,
      dossierCites: join(racine, 'cites'),
      cloner: false,
    });
    egal(r.errors, []);
    egal(
      r.anomalies.map((a) => [a.code, a.params.citation]),
      [
        ['citation-perimee', 'socle:RG-nommage@2026-003'],
        ['citation-non-verifiee', 'prive:RG-y@2026-001'],
      ],
    );
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

for (const e of echecs) console.error(`✗ ${e}`);
console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
if (echecs.length) process.exit(1);
