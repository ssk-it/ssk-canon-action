// Tests des noms déclarés — RG-noms-declares.
//
// Ce qu'ils protègent : un référentiel peut nommer ses dossiers et ses fichiers
// convenus dans `ssk-canon.yml`. La résolution vit ici, une fois, pour la
// vérification, la propagation et l'application : deux résolutions finiraient
// par lire deux référentiels différents. Un référentiel qui ne déclare rien doit
// se lire exactement comme avant, et une déclaration fautive ne doit jamais le
// rendre illisible.
//
//   node test/noms.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { resoudreNoms, verifierDossiersDeclares, NOMS_PAR_DEFAUT } from '../src/noms.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';
import { checkRepo } from '../src/verifier.mjs';
import { loadRepo } from '../src/parse.mjs';
import { check } from '../src/check.mjs';
import { propager } from '../src/propagate.mjs';

let reussis = 0;
const echecs = [];

async function test(nom, fn) {
  try {
    await fn();
    reussis += 1;
  } catch (erreur) {
    echecs.push(`${nom} : ${erreur.message}`);
  }
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

// Le YAML est écrit tel qu'un rédacteur l'écrirait, puis lu comme le chargement
// le lit : c'est la forme qui arrive à la résolution.
//
// Les fautes sont des anomalies codées ; la plupart des cas en lisent le
// message français, tel que la vérification le rend, et les codes restent à
// portée dans `anomalies`.
const fr = (anomalies) => anomalies.map((a) => formaterAnomalie(a, 'fr'));
const declare = (yaml) => {
  const r = resoudreNoms(loadYaml(yaml));
  return { ...r, anomalies: r.erreurs, erreurs: fr(r.erreurs) };
};

// --- la résolution ---

await test('sans déclaration, les noms du format', () => {
  for (const config of [null, undefined, {}, { schema_version: 1 }]) {
    const { dossiers, fichiers, erreurs } = resoudreNoms(config);
    vrai(!erreurs.length, erreurs.join(' | '));
    vrai(JSON.stringify(dossiers) === JSON.stringify(NOMS_PAR_DEFAUT.dossiers), JSON.stringify(dossiers));
    vrai(JSON.stringify(fichiers) === JSON.stringify(NOMS_PAR_DEFAUT.fichiers), JSON.stringify(fichiers));
  }
});

await test('les noms du format sont ceux d’aujourd’hui', () => {
  const { dossiers, fichiers } = NOMS_PAR_DEFAUT;
  vrai(dossiers.domaines === 'domains' && dossiers.fonctionnalites === 'features', 'domaines');
  vrai(dossiers.regles === 'rules' && dossiers.cadrages === 'cadrages', 'règles');
  vrai(dossiers.decisions === 'decisions' && dossiers.architecture === 'architecture', 'architecture');
  vrai(dossiers.identite === 'identite' && dossiers.decisions_cadrage === 'decisions', 'identité');
  vrai(fichiers.cadrage === 'cadrage.md' && fichiers.pieces_jointes === 'attachments.md', 'fichiers');
});

await test('une déclaration partielle garde le format pour le reste', () => {
  const { dossiers, fichiers, erreurs } = declare(
    'dossiers:\n  regles: exigences\n  cadrages: evolutions\n  decisions_cadrage: arbitrages\n' +
      'fichiers:\n  cadrage: evolution.md\n',
  );
  vrai(!erreurs.length, erreurs.join(' | '));
  vrai(dossiers.regles === 'exigences', dossiers.regles);
  vrai(dossiers.cadrages === 'evolutions', dossiers.cadrages);
  vrai(dossiers.decisions_cadrage === 'arbitrages', dossiers.decisions_cadrage);
  vrai(dossiers.features === undefined && dossiers.fonctionnalites === 'features', dossiers.fonctionnalites);
  vrai(fichiers.cadrage === 'evolution.md', fichiers.cadrage);
  vrai(fichiers.pieces_jointes === 'attachments.md', fichiers.pieces_jointes);
});

await test('le dossier des décisions d’un cadrage peut porter le nom du dossier des ADR', () => {
  // Ils ne vivent pas au même endroit : l'un à la racine, l'autre dans un cadrage.
  const { erreurs } = declare('dossiers:\n  decisions: adr\n  decisions_cadrage: adr\n');
  vrai(!erreurs.length, erreurs.join(' | '));
});

for (const [cas, yaml, attendu] of [
  ['un nom vide', "dossiers:\n  regles: ''\n", /dossiers\.regles.*vide/],
  ['un nom absent', 'dossiers:\n  regles:\n', /dossiers\.regles.*vide/],
  ['un nombre', 'dossiers:\n  regles: 12\n', /dossiers\.regles.*chaîne/],
  ['un chemin', 'dossiers:\n  regles: docs/regles\n', /dossiers\.regles.*«\s?\/\s?»/],
  ['un nom caché', 'dossiers:\n  regles: .regles\n', /dossiers\.regles.*«\s?\.\s?»/],
  ['un parent', 'dossiers:\n  regles: ..\n', /dossiers\.regles/],
  ['une clé inconnue', 'dossiers:\n  regle: exigences\n', /dossiers\.regle.*inconnue/],
  ['un fichier sans .md', 'fichiers:\n  cadrage: evolution.txt\n', /fichiers\.cadrage.*\.md/],
]) {
  await test(`${cas} est écarté et signalé`, () => {
    const { dossiers, fichiers, erreurs } = declare(yaml);
    vrai(erreurs.length === 1, `${erreurs.length} erreur(s) : ${erreurs.join(' | ')}`);
    vrai(attendu.test(erreurs[0]), `message : ${erreurs[0]}`);
    vrai(erreurs[0].startsWith('ssk-canon.yml'), `le fichier n’est pas nommé : ${erreurs[0]}`);
    vrai(dossiers.regles === 'rules', `règles : ${dossiers.regles}`);
    vrai(fichiers.cadrage === 'cadrage.md', `cadrage : ${fichiers.cadrage}`);
  });
}

await test('un bloc qui n’est pas une table est écarté en entier', () => {
  const { dossiers, erreurs } = declare('dossiers: [regles, exigences]\n');
  vrai(erreurs.length === 1 && /dossiers/.test(erreurs[0]), erreurs.join(' | '));
  vrai(dossiers.regles === 'rules', dossiers.regles);
});

await test('deux dossiers déclarés sous le même nom sont écartés tous les deux', () => {
  const { dossiers, erreurs } = declare('dossiers:\n  regles: contenu\n  domaines: contenu\n');
  vrai(dossiers.regles === 'rules' && dossiers.domaines === 'domains', JSON.stringify(dossiers));
  vrai(erreurs.length === 2, erreurs.join(' | '));
  vrai(erreurs.every((e) => e.includes('« contenu »')), erreurs.join(' | '));
});

await test('un dossier déclaré sous le nom par défaut d’un autre est écarté', () => {
  const { dossiers, erreurs } = declare('dossiers:\n  cadrages: features\n');
  vrai(dossiers.cadrages === 'cadrages' && dossiers.fonctionnalites === 'features', JSON.stringify(dossiers));
  vrai(erreurs.length === 1 && /dossiers\.cadrages/.test(erreurs[0]), erreurs.join(' | '));
});

await test('un dossier déclaré sous le nom de l’identité est écarté', () => {
  const { dossiers, erreurs } = declare('dossiers:\n  regles: identite\n');
  vrai(dossiers.regles === 'rules', dossiers.regles);
  vrai(erreurs.length === 1, erreurs.join(' | '));
});

await test('les deux fichiers d’un cadrage sous le même nom sont écartés', () => {
  const { fichiers, erreurs } = declare('fichiers:\n  cadrage: fiche.md\n  pieces_jointes: fiche.md\n');
  vrai(fichiers.cadrage === 'cadrage.md' && fichiers.pieces_jointes === 'attachments.md', JSON.stringify(fichiers));
  vrai(erreurs.length === 2, erreurs.join(' | '));
});

await test('une entrée fautive n’emporte pas les autres', () => {
  const { dossiers, erreurs } = declare("dossiers:\n  regles: exigences\n  identite: ''\n");
  vrai(dossiers.regles === 'exigences', dossiers.regles);
  vrai(dossiers.identite === 'identite', dossiers.identite);
  vrai(erreurs.length === 1, erreurs.join(' | '));
});

// --- un dossier qui change de nom ---

await test('un dossier déclaré introuvable alors que l’ancien existe est une erreur', () => {
  const noms = declare('dossiers:\n  regles: besoins\n');
  const erreurs = fr(verifierDossiersDeclares(noms, ['rules/RG-a.md', 'domains/d.md']));
  vrai(erreurs.length === 1, erreurs.join(' | '));
  vrai(erreurs[0].includes('besoins/') && erreurs[0].includes('rules/'), erreurs[0]);
});

await test('un dossier déclaré qui existe ne dit rien, même si l’ancien existe aussi', () => {
  const noms = declare('dossiers:\n  regles: besoins\n');
  vrai(!verifierDossiersDeclares(noms, ['besoins/RG-a.md']).length, 'besoins seul');
  vrai(!verifierDossiersDeclares(noms, []).length, 'référentiel vide');
});

await test('un fichier de cadrage resté sous l’ancien nom est une erreur', () => {
  const noms = declare('dossiers:\n  decisions_cadrage: arbitrages\nfichiers:\n  cadrage: evolution.md\n');
  const erreurs = fr(
    verifierDossiersDeclares(noms, [
      'cadrages/2026-001/cadrage.md',
      'cadrages/2026-001/decisions/01-x.md',
      'cadrages/2026-002/evolution.md',
      'cadrages/2026-002/arbitrages/01-x.md',
    ]),
  );
  vrai(erreurs.length === 2, erreurs.join(' | '));
  vrai(erreurs.some((e) => e.includes('cadrages/2026-001/evolution.md')), erreurs.join(' | '));
  vrai(erreurs.some((e) => e.includes('cadrages/2026-001/arbitrages/')), erreurs.join(' | '));
});

await test('la vérification signale la déclaration fautive', () => {
  const repo = {
    config: loadYaml("dossiers:\n  regles: ''\n"),
    domains: new Map(),
    features: new Map(),
    rules: new Map(),
    cadrages: new Map(),
  };
  const { errors } = checkRepo(repo);
  vrai(errors.some((e) => /dossiers\.regles/.test(e)), errors.join(' | '));
});

await test('la vérification signale un dossier renommé, quand on lui passe les chemins', () => {
  const repo = {
    config: loadYaml('dossiers:\n  regles: besoins\n'),
    domains: new Map(),
    features: new Map(),
    rules: new Map(),
    cadrages: new Map(),
    chemins: ['rules/RG-a.md'],
  };
  const { errors } = checkRepo(repo);
  vrai(errors.some((e) => e.includes('besoins/')), errors.join(' | '));
});

// --- les anomalies codées — RG-anomalies-codees ---

// Ce qu'une résolution signale, par code, et son message dans une langue.
const codes = (anomalies) => anomalies.map((a) => a.code);
const en = (anomalies) => anomalies.map((a) => formaterAnomalie(a, 'en'));

await test('chaque faute d’un nom a son code', () => {
  const r = declare(
    "dossiers:\n  regles: ''\n  cadrages: 3\n  domaines: ' d '\n  fonctionnalites: a/b\n  decisions: .adr\n" +
      'fichiers:\n  cadrage: evolution.txt\n',
  );
  vrai(
    JSON.stringify(codes(r.anomalies)) ===
      JSON.stringify(['nom-vide', 'nom-non-chaine', 'nom-borde-d-espaces', 'nom-chemin', 'nom-commence-par-point', 'nom-fichier-non-markdown']),
    codes(r.anomalies).join(' | '),
  );
  vrai(r.anomalies.every((a) => a.gravite === 'erreur'), 'gravité');
  vrai(r.erreurs[0] === 'ssk-canon.yml → dossiers.regles : nom vide — « rules » est retenu', r.erreurs[0]);
  vrai(
    JSON.stringify(en(r.anomalies)) ===
      JSON.stringify([
        'ssk-canon.yml → dossiers.regles: empty name — “rules” is kept',
        'ssk-canon.yml → dossiers.cadrages: expected a string — “cadrages” is kept',
        'ssk-canon.yml → dossiers.domaines: name with leading or trailing spaces — “domains” is kept',
        'ssk-canon.yml → dossiers.fonctionnalites: a name, not a path: no “/” — “features” is kept',
        'ssk-canon.yml → dossiers.decisions: must not start with “.” — “decisions” is kept',
        'ssk-canon.yml → fichiers.cadrage: a Markdown file, ending in “.md” — “cadrage.md” is kept',
      ]),
    en(r.anomalies).join(' | '),
  );
});

await test('une table attendue, une clé inconnue, un nom en double : un code chacun, en anglais aussi', () => {
  const table = declare('dossiers: rules\n');
  vrai(codes(table.anomalies).join() === 'noms-bloc-non-table', codes(table.anomalies).join());
  vrai(
    en(table.anomalies)[0] === 'ssk-canon.yml → dossiers: expected a table of names — the format’s names are kept',
    en(table.anomalies)[0],
  );
  const cle = declare('fichiers:\n  piece: a.md\n');
  vrai(codes(cle.anomalies).join() === 'nom-cle-inconnue', codes(cle.anomalies).join());
  vrai(
    en(cle.anomalies)[0] === 'ssk-canon.yml → fichiers.piece: unknown key — expected one of cadrage, pieces_jointes',
    en(cle.anomalies)[0],
  );
  const double = declare('dossiers:\n  regles: exigences\n  domaines: exigences\n');
  vrai(codes(double.anomalies).join() === 'nom-en-double,nom-en-double', codes(double.anomalies).join());
  vrai(
    en(double.anomalies)[0] ===
      'ssk-canon.yml → dossiers.domaines: “exigences” is also the name of dossiers.regles — “domains” is kept',
    en(double.anomalies).join(' | '),
  );
});

await test('un dossier ou un fichier resté sous l’ancien nom : un code chacun, en anglais aussi', () => {
  const noms = declare('dossiers:\n  regles: besoins\nfichiers:\n  cadrage: evolution.md\n');
  const chemins = ['rules/RG-a.md', 'cadrages/2026-001/cadrage.md'];
  const anomalies = verifierDossiersDeclares(noms, chemins);
  vrai(codes(anomalies).join() === 'dossier-declare-introuvable,nom-de-cadrage-introuvable', codes(anomalies).join());
  vrai(anomalies.every((a) => a.gravite === 'erreur'), 'gravité');
  vrai(
    JSON.stringify(en(anomalies)) ===
      JSON.stringify([
        'ssk-canon.yml → dossiers.regles: “besoins/” not found, while “rules/” exists — ' +
          'a folder is not renamed, its name is chosen at creation',
        'cadrages/2026-001/evolution.md: not found, while “cadrages/2026-001/cadrage.md” exists ' +
          '(ssk-canon.yml → fichiers.cadrage) — a name is chosen at creation',
      ]),
    en(anomalies).join(' | '),
  );
});

// --- la lecture, la vérification et la propagation sous les noms déclarés ---

function git(racine, args) {
  execFileSync('git', ['-C', racine, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
}

const CONFIG_CLIENT =
  'schema_version: 1\n' +
  'dossiers:\n  domaines: domaines\n  fonctionnalites: fonctionnalites\n  regles: exigences\n' +
  '  cadrages: evolutions\n  decisions_cadrage: arbitrages\n  identite: marque\n' +
  'fichiers:\n  cadrage: evolution.md\n  pieces_jointes: pieces-jointes.md\n';

/** Un référentiel sous les noms d'un client, avec un cadrage livré. */
function referentielClient(fn) {
  const racine = mkdtempSync(join(tmpdir(), 'pc-noms-'));
  try {
    writeFileSync(join(racine, 'ssk-canon.yml'), CONFIG_CLIENT);
    for (const d of ['domaines', 'fonctionnalites', 'exigences', 'evolutions/2026-001/arbitrages', 'marque'])
      mkdirSync(join(racine, d), { recursive: true });
    writeFileSync(join(racine, 'domaines/d.md'), '---\nid: d\nnom: D\n---\n\nUn domaine.\n');
    writeFileSync(join(racine, 'fonctionnalites/f.md'), '---\nid: f\nnom: F\ndomaines: [d]\n---\n\nF.\n');
    writeFileSync(
      join(racine, 'exigences/RG-a.md'),
      '---\nid: RG-a\nfonctionnalites: [f]\nstatut: actif\ncree_par: null\nmodifie_par: []\n---\n\nÀ propager.\n',
    );
    writeFileSync(
      join(racine, 'evolutions/2026-001/evolution.md'),
      '---\nid: 2026-001\ntitre: Une évolution\ndomaines: [d]\nimpacts:\n  - { regle: RG-a, operation: cree }\n---\n\n' +
        '## Objectif\n\nUn objectif.\n\n## Énoncés\n\n### RG-a\n\nLe texte livré.\n',
    );
    writeFileSync(
      join(racine, 'evolutions/2026-001/arbitrages/01-x.md'),
      '---\nid: 01-x\ntitre: Une question\nstatut: retenue\noption_retenue: a\n---\n\nTexte.\n',
    );
    writeFileSync(
      join(racine, 'evolutions/2026-001/pieces-jointes.md'),
      `---\nattachments:\n  - { nom: plan.pdf, sha256: ${'a'.repeat(64)} }\n---\n`,
    );
    writeFileSync(join(racine, 'marque/symbole.svg'), '<svg/>');
    git(racine, ['init', '-q', '-b', 'main']);
    git(racine, ['config', 'user.email', 'test@exemple.fr']);
    git(racine, ['config', 'user.name', 'Test']);
    git(racine, ['add', '-A']);
    git(racine, ['commit', '-q', '-m', 'livraison']);
    return fn(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

await test('le chargement lit les entités sous les noms déclarés', () =>
  referentielClient((racine) => {
    const repo = loadRepo(racine);
    vrai(!repo.errors.length, repo.errors.join(' | '));
    vrai(repo.domains.has('d') && repo.features.has('f') && repo.rules.has('RG-a'), 'entités');
    const c = repo.cadrages.get('2026-001');
    vrai(c, 'cadrage introuvable');
    vrai(c.path === join('evolutions', '2026-001', 'evolution.md'), c.path);
    vrai(c.decisions.length === 1 && c.decisions[0].id === '01-x', JSON.stringify(c.decisions));
    vrai(c.attachments.length === 1, JSON.stringify(c.attachments));
    vrai(repo.identite.length === 1 && repo.identite[0].chemin === 'symbole.svg', JSON.stringify(repo.identite));
  }));

await test('les dossiers sous les noms du format ne sont plus lus, une fois renommés', () =>
  referentielClient((racine) => {
    mkdirSync(join(racine, 'rules'));
    writeFileSync(join(racine, 'rules/RG-z.md'), '---\nid: RG-z\n---\n\nVestige.\n');
    const repo = loadRepo(racine);
    vrai(!repo.rules.has('RG-z'), 'rules/ lu');
  }));

await test('la vérification passe, livraison comprise', () =>
  referentielClient((racine) => {
    const { errors } = check(racine, { base: 'HEAD', livraison: true, ignorerIndexDerives: true });
    vrai(!errors.length, errors.join(' | '));
  }));

await test('un cadrage livré sous le nom déclaré est vu comme livré', () =>
  referentielClient((racine) => {
    // livré, il doit trouver sa règle créée : sans elle, l'erreur le prouve
    rmSync(join(racine, 'exigences/RG-a.md'));
    const { errors } = check(racine, { base: 'HEAD' });
    vrai(errors.some((e) => /règle inconnue : RG-a/.test(e)), errors.join(' | '));
  }));

await test('la modification d’un cadrage livré sous le nom déclaré est refusée', () =>
  referentielClient((racine) => {
    writeFileSync(join(racine, 'evolutions/2026-001/arbitrages/02-y.md'), '---\nid: 02-y\n---\n\nAjout.\n');
    git(racine, ['checkout', '-q', '-b', 'suite']);
    git(racine, ['add', '-A']);
    git(racine, ['commit', '-q', '-m', 'suite']);
    const { errors } = check(racine, { base: 'main' });
    vrai(errors.some((e) => /2026-001 : livré, donc figé/.test(e)), errors.join(' | '));
  }));

await test('un nom changé par rapport à la base est refusé', () =>
  referentielClient((racine) => {
    writeFileSync(join(racine, 'ssk-canon.yml'), CONFIG_CLIENT.replace('regles: exigences', 'regles: besoins'));
    const { errors } = check(racine, { base: 'HEAD' });
    vrai(errors.some((e) => /dossiers\.regles.*« exigences ».*« besoins »/.test(e)), errors.join(' | '));
  }));

await test('un nom interne changé par rapport à la base est refusé', () =>
  referentielClient((racine) => {
    writeFileSync(join(racine, 'ssk-canon.yml'), CONFIG_CLIENT.replace('cadrage: evolution.md', 'cadrage: fiche.md'));
    const { errors } = check(racine, { base: 'HEAD' });
    vrai(errors.some((e) => /fichiers\.cadrage.*« evolution\.md »/.test(e)), errors.join(' | '));
  }));

await test('nommer un dossier qui n’existe pas encore est admis', () =>
  referentielClient((racine) => {
    const config = CONFIG_CLIENT.replace('  identite: marque\n', '  identite: marque\n  architecture: conception\n');
    writeFileSync(join(racine, 'ssk-canon.yml'), config);
    const { errors } = check(racine, { base: 'HEAD', ignorerIndexDerives: true });
    vrai(!errors.length, errors.join(' | '));
  }));

await test('le chargement signale un dossier renommé loin du nom du format', () =>
  referentielClient((racine) => {
    git(racine, ['mv', 'exigences', 'rules']);
    const { errors } = check(racine, { livres: new Set() });
    vrai(errors.some((e) => e.includes('exigences/') && e.includes('rules/')), errors.join(' | '));
  }));

await test('la propagation écrit dans le dossier déclaré', () =>
  referentielClient((racine) => {
    const r = propager(racine);
    vrai(r.ok, r.problemes.join(' | '));
    vrai(readFileSync(join(racine, 'exigences/RG-a.md'), 'utf8').includes('Le texte livré.'), 'non propagé');
    vrai(!existsSync(join(racine, 'rules')), 'rules/ créé');
  }));

await test('l’identité se contrôle sous son nom déclaré', () =>
  referentielClient((racine) => {
    writeFileSync(join(racine, 'marque/symbol.svg'), '<svg/>');
    const { errors } = check(racine, { livres: new Set() });
    vrai(errors.some((e) => e.includes('marque/symbol.svg')), errors.join(' | '));
  }));

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
