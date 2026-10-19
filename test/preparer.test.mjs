// Tests du script qui prépare l'espace d'un cadrage.
//
// Ce qu'ils protègent : l'identifiant proposé n'est jamais déjà pris. Le clone
// du rédacteur est souvent en retard sur l'origine — un cadrage y a été livré
// depuis, sa branche distante supprimée à la fusion — et il garde des branches
// locales que rien ne pousse. Juger sur la seule copie de travail proposait un
// numéro livré, et `git worktree add` échouait sur la branche locale restante.
//
// Chaque cas construit son référentiel : une origine nue, et un clone qu'on
// laisse en retard.
//
//   node test/preparer.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../skills/cadrage-canon/scripts/preparer.mjs', import.meta.url));
const ANNEE = new Date().getFullYear();
const id = (n) => `${ANNEE}-${String(n).padStart(3, '0')}`;

let reussis = 0;
const echecs = [];
const dossiers = [];

function test(nom, fn) {
  try {
    fn();
    reussis += 1;
  } catch (erreur) {
    echecs.push(`${nom} : ${erreur.message}`);
  }
}

function egal(obtenu, attendu, quoi = '') {
  if (obtenu !== attendu) throw new Error(`${quoi} attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

const git = (dossier, ...a) =>
  execFileSync('git', ['-C', dossier, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();

function livrer(dossier, numero) {
  mkdirSync(join(dossier, 'cadrages', id(numero)), { recursive: true });
  writeFileSync(join(dossier, 'cadrages', id(numero), 'cadrage.md'), `---\nid: ${id(numero)}\n---\n`);
  git(dossier, 'add', '.');
  git(dossier, 'commit', '-q', '-m', `Cadrage ${id(numero)}`);
}

/**
 * Une origine portant les cadrages 1 et 2, et le clone du rédacteur resté au
 * cadrage 1. Le cadrage 2 a été livré par une autre copie, et sa branche
 * distante supprimée à la fusion ; le clone garde sa branche locale.
 */
function referentielEnRetard() {
  const tmp = mkdtempSync(join(tmpdir(), 'preparer-'));
  dossiers.push(tmp);
  const origine = join(tmp, 'origine.git');
  const autre = join(tmp, 'autre');
  const clone = join(tmp, 'referentiel');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origine]);

  execFileSync('git', ['clone', '-q', origine, autre], { stdio: 'ignore' });
  writeFileSync(join(autre, 'ssk-canon.yml'), 'projet:\n  nom: Test\n');
  livrer(autre, 1);
  git(autre, 'push', '-q', 'origin', 'HEAD:main');

  execFileSync('git', ['clone', '-q', origine, clone], { stdio: 'ignore' });
  git(clone, 'branch', `cadrage-${id(2)}`);

  livrer(autre, 2);
  git(autre, 'push', '-q', 'origin', 'HEAD:main');
  return clone;
}

function preparer(racine, ...args) {
  try {
    return execFileSync('node', [SCRIPT, racine, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return e.stdout;
  }
}

const ligne = (sortie, cle) => sortie.split('\n').find((l) => l.startsWith(`${cle} `))?.slice(cle.length + 1);

test('un cadrage livré sur l’origine depuis le dernier fetch est pris', () => {
  const sortie = preparer(referentielEnRetard());
  egal(ligne(sortie, 'ECHEC'), undefined, 'échec');
  egal(ligne(sortie, 'CADRAGE'), id(3), 'identifiant');
});

test('une branche locale sans distante rend son identifiant pris', () => {
  const clone = referentielEnRetard();
  git(clone, 'branch', `cadrage-${id(5)}`);
  egal(ligne(preparer(clone), 'CADRAGE'), id(6), 'identifiant');
});

test('un identifiant imposé mais livré sur l’origine est refusé', () => {
  egal(ligne(preparer(referentielEnRetard(), id(2)), 'IDENTIFIANT_PRIS'), id(2), 'refus');
});

for (const d of dossiers) rmSync(d, { recursive: true, force: true });

if (echecs.length) {
  console.error(`✗ preparer : ${echecs.length} échec(s), ${reussis} réussi(s)`);
  for (const e of echecs) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ preparer : ${reussis} test(s)`);
