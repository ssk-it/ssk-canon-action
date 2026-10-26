// Tests des skills sur un référentiel qui nomme ses dossiers — RG-noms-declares.
//
// Ce qu'ils protègent : les scripts des skills tournent sans rien d'installé,
// copiés seuls dans le dossier des skills. Ils ne peuvent pas importer la
// bibliothèque : ils en portent une copie de la résolution des noms, et une
// lecture de `ssk-canon.yml` sans dépendance. Une copie qui diverge, ou une
// lecture qui comprend autre chose que YAML, ferait préparer un cadrage dans
// un dossier que la vérification ne lit pas.
//
//   node test/skills-noms.test.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { resoudreNoms } from '../src/noms.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SKILLS_AVEC_NOMS = ['cadrage-canon', 'consulter-referentiel'];
const PREPARER = join(RACINE, 'skills/cadrage-canon/scripts/preparer.mjs');
const CONSULTER = join(RACINE, 'skills/consulter-referentiel/scripts/consulter.mjs');
const ANNEE = new Date().getFullYear();
const id = (n) => `${ANNEE}-${String(n).padStart(3, '0')}`;

let reussis = 0;
const echecs = [];
const temporaires = [];

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

// --- les copies ---

for (const skill of SKILLS_AVEC_NOMS) {
  await test(`${skill} porte la résolution de la bibliothèque, à l’identique`, () => {
    const copie = join(RACINE, 'skills', skill, 'scripts/noms.mjs');
    vrai(existsSync(copie), `${copie} absent`);
    vrai(
      readFileSync(copie, 'utf8') === readFileSync(join(RACINE, 'src/noms.mjs'), 'utf8'),
      'la copie diverge de src/noms.mjs — la recopier',
    );
  });
}

await test('les deux skills portent la même lecture de la configuration', () => {
  const [a, b] = SKILLS_AVEC_NOMS.map((s) =>
    readFileSync(join(RACINE, 'skills', s, 'scripts/config-noms.mjs'), 'utf8'),
  );
  vrai(a === b, 'config-noms.mjs diffère d’un skill à l’autre');
});

// --- la lecture sans dépendance comprend ce que YAML comprend ---

const { lireNoms } = await import(join(RACINE, 'skills/cadrage-canon/scripts/config-noms.mjs'));

for (const [cas, texte] of [
  ['rien de déclaré', 'schema_version: 1\nprojet:\n  nom: Test\n'],
  ['un bloc indenté', 'dossiers:\n  regles: exigences\n  cadrages: evolutions\nfichiers:\n  cadrage: evolution.md\n'],
  ['des guillemets et un commentaire', "dossiers:\n  regles: 'exigences'  # le lexique du client\n  domaines: \"domaines\"\n"],
  ['un bloc en ligne', 'dossiers: { regles: exigences, cadrages: evolutions }\n'],
  ['un bloc suivi d’autres clés', 'dossiers:\n    regles: exigences\n\ntags_liens:\n  - carte_trello\nfichiers:\n    pieces_jointes: pj.md\n'],
  ['une entrée fautive', "dossiers:\n  regles: ''\n  cadrages: features\n"],
  ['des fins de ligne Windows', 'dossiers:\r\n  regles: exigences\r\n'],
]) {
  await test(`lit comme YAML : ${cas}`, () => {
    const attendu = resoudreNoms(load(texte));
    const obtenu = lireNoms(texte);
    vrai(
      JSON.stringify({ d: obtenu.dossiers, f: obtenu.fichiers }) ===
        JSON.stringify({ d: attendu.dossiers, f: attendu.fichiers }),
      `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`,
    );
  });
}

// --- un référentiel sous les noms d'un client ---

const CONFIG =
  'projet:\n  nom: Test\n' +
  'dossiers:\n  domaines: domaines\n  fonctionnalites: fonctionnalites\n  regles: exigences\n' +
  '  cadrages: evolutions\n  decisions_cadrage: arbitrages\n' +
  'fichiers:\n  cadrage: evolution.md\n';

const git = (dossier, ...a) =>
  execFileSync('git', ['-C', dossier, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();

function ecrire(racine, chemin, contenu) {
  mkdirSync(join(racine, chemin, '..'), { recursive: true });
  writeFileSync(join(racine, chemin), contenu);
}

/** Une origine portant un cadrage livré et un cadrage en cours, et son clone. */
function referentielClient() {
  const tmp = mkdtempSync(join(tmpdir(), 'skills-noms-'));
  temporaires.push(tmp);
  const origine = join(tmp, 'origine.git');
  const travail = join(tmp, 'travail');
  const clone = join(tmp, 'referentiel');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origine]);
  execFileSync('git', ['clone', '-q', origine, travail], { stdio: 'ignore' });

  ecrire(travail, 'ssk-canon.yml', CONFIG);
  ecrire(travail, 'domaines/d.md', '---\nid: d\nnom: Le domaine\n---\n\nUn domaine.\n');
  ecrire(travail, 'fonctionnalites/f.md', '---\nid: f\nnom: La fonctionnalité\ndomaines: [d]\n---\n\nF.\n');
  ecrire(
    travail,
    'exigences/RG-a.md',
    '---\nid: RG-a\nfonctionnalites: [f]\nstatut: actif\ncree_par: ' + id(1) + '\nmodifie_par: []\n---\n\nUne exigence de lexique.\n',
  );
  ecrire(
    travail,
    `evolutions/${id(1)}/evolution.md`,
    `---\nid: ${id(1)}\ntitre: Une évolution livrée\ndomaines: [d]\nliens:\n  - { tag: issue_github, url: 'https://github.com/org/code/issues/7' }\nimpacts:\n  - { regle: RG-a, operation: cree }\n---\n\n## Objectif\n\nUn objectif.\n`,
  );
  ecrire(
    travail,
    `evolutions/${id(1)}/arbitrages/01-x.md`,
    '---\nid: 01-x\ntitre: Une question tranchée\nstatut: retenue\noption_retenue: a\n---\n\n## Description\n\nCe qui était ouvert.\n',
  );
  git(travail, 'add', '.');
  git(travail, 'commit', '-q', '-m', 'livraison');
  git(travail, 'push', '-q', 'origin', 'HEAD:main');

  git(travail, 'checkout', '-q', '-b', `cadrage-${id(2)}`);
  ecrire(
    travail,
    `evolutions/${id(2)}/evolution.md`,
    `---\nid: ${id(2)}\ntitre: Une évolution en cours\ndomaines: [d]\nimpacts:\n  - { regle: RG-a, operation: modifie }\n---\n\n## Objectif\n\nEn cours.\n`,
  );
  git(travail, 'add', '.');
  git(travail, 'commit', '-q', '-m', 'en cours');
  git(travail, 'push', '-q', 'origin', `cadrage-${id(2)}`);

  execFileSync('git', ['clone', '-q', origine, clone], { stdio: 'ignore' });
  return clone;
}

const lancer = (script, ...args) => {
  try {
    return execFileSync('node', [script, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CONSULTER_MAX_CARACTERES: '10000000' },
    });
  } catch (e) {
    return `${e.stdout}${e.stderr}`;
  }
};
const ligne = (sortie, cle) => sortie.split('\n').find((l) => l.startsWith(`${cle} `))?.slice(cle.length + 1);

await test('preparer compte les cadrages et prépare le fichier sous les noms déclarés', () => {
  const clone = referentielClient();
  const sortie = lancer(PREPARER, clone);
  vrai(ligne(sortie, 'CADRAGE') === id(3), `identifiant : ${sortie}`);
  const espace = ligne(sortie, 'ESPACE');
  vrai(ligne(sortie, 'FICHIER') === join(espace, 'evolutions', id(3), 'evolution.md'), `fichier : ${sortie}`);
  vrai(existsSync(join(espace, 'evolutions', id(3), 'arbitrages')), 'dossier des décisions absent');
  vrai(!existsSync(join(espace, 'cadrages')), 'cadrages/ créé');
  // les noms à employer, pour le rédacteur qui suit le skill
  vrai(/^NOMS .*dossiers\.regles=exigences/m.test(sortie), `noms non dits : ${sortie}`);
});

await test('preparer reprend un espace sous les noms déclarés', () => {
  const clone = referentielClient();
  const premier = lancer(PREPARER, clone);
  const repris = lancer(PREPARER, clone, ligne(premier, 'CADRAGE'));
  vrai(ligne(repris, 'FICHIER') === ligne(premier, 'FICHIER'), `reprise : ${repris}`);
});

await test('preparer ne dit aucun nom pour un référentiel qui n’en déclare pas', () => {
  const clone = referentielClient();
  writeFileSync(join(clone, 'ssk-canon.yml'), 'projet:\n  nom: Test\n');
  git(clone, 'commit', '-qam', 'sans noms');
  git(clone, 'push', '-q', 'origin', 'HEAD:main');
  const sortie = lancer(PREPARER, clone);
  vrai(!/^NOMS /m.test(sortie), `noms dits : ${sortie}`);
});

await test('consulter lit le référentiel, livré et en cours, sous les noms déclarés', () => {
  const clone = referentielClient();
  const index = lancer(CONSULTER, '--referentiel', clone);
  vrai(/TOTAUX fonctionnalites=1 regles=1 decisions=0 cadrages_livres=1/.test(index), `index : ${index}`);
  vrai(index.includes(`EN_COURS ${id(2)}`), `en cours : ${index}`);
  vrai(/^NOMS .*dossiers\.cadrages=evolutions/m.test(index), `noms non dits : ${index}`);

  const domaine = lancer(CONSULTER, '--referentiel', clone, '--domaine', 'd');
  vrai(domaine.includes('REGLE RG-a'), `règle : ${domaine}`);
  vrai(domaine.includes(`CADRAGE_LIVRE ${id(1)}`), `livré : ${domaine}`);
  vrai(domaine.includes(`origin/main:evolutions/${id(1)}/arbitrages/01-x.md`), `décision : ${domaine}`);
});

await test('consulter donne, pour une issue, le chemin déclaré du cadrage', () => {
  const clone = referentielClient();
  const sortie = lancer(CONSULTER, '--referentiel', clone, '--issue', 'code#7');
  vrai(sortie.includes(`--lire origin/main:evolutions/${id(1)}/evolution.md`), sortie);
});

await test('consulter cherche un terme dans les dossiers déclarés', () => {
  const clone = referentielClient();
  const sortie = lancer(CONSULTER, '--referentiel', clone, '--motif', 'lexique');
  vrai(sortie.includes('exigences/RG-a.md'), sortie);
});

await test('consulter condense un cadrage livré sous son nom déclaré', () => {
  const clone = referentielClient();
  const sortie = lancer(CONSULTER, '--referentiel', clone, '--lire', `origin/main:evolutions/${id(1)}/evolution.md`);
  vrai(sortie.includes('Une évolution livrée'), sortie);
});

for (const t of temporaires) rmSync(t, { recursive: true, force: true });

if (echecs.length) {
  console.error(`✗ skills-noms : ${echecs.length} échec(s), ${reussis} réussi(s)`);
  for (const e of echecs) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ skills-noms : ${reussis} test(s)`);
