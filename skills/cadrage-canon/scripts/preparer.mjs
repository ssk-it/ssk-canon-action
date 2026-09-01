#!/usr/bin/env node
/**
 * Prépare un espace de travail isolé pour rédiger un cadrage.
 *
 * Deux sessions ouvertes sur le même projet se disputeraient sinon la même copie
 * de travail : celle qui change de branche la change pour l'autre, et un `git
 * add` ramasse ce que la voisine était en train d'écrire. Une copie liée — un
 * « worktree » — donne à chacune son répertoire et sa branche, sur le même dépôt.
 *
 * Usage : preparer.mjs <racine-du-depot-de-cadrage> [identifiant]
 * Sans identifiant, le prochain libre est calculé.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const racine = resolve(process.argv[2] ?? '.');
const demande = process.argv[3];

function git(args, cwd = racine) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

if (!existsSync(join(racine, 'ssk-canon.yml'))) {
  console.log(`PAS_UN_DEPOT_CADRE ${racine}`);
  process.exit(1);
}

/**
 * Les identifiants déjà pris, de toutes provenances.
 *
 * Le dépôt seul ne suffit pas : un cadrage préparé ailleurs n'y est pas encore,
 * et deux sessions choisiraient le même numéro. Les branches distantes et les
 * copies liées locales disent ce qui est en cours.
 */
function identifiantsPris() {
  const pris = new Set();
  const ajouter = (texte) => {
    for (const m of texte.matchAll(/(\d{4})-(\d{3})/g)) pris.add(m[0]);
  };

  try {
    ajouter(git('ls-tree --name-only HEAD cadrages/'));
  } catch {
    /* dépôt sans cadrages encore */
  }
  try {
    // Le distant fait autorité sur ce que les autres préparent.
    ajouter(git('ls-remote --heads origin'));
  } catch {
    console.log('AVERTISSEMENT distant injoignable — les cadrages en cours ailleurs sont ignorés');
  }
  try {
    ajouter(git('worktree list --porcelain'));
  } catch {
    /* rien */
  }
  return pris;
}

const pris = identifiantsPris();
const annee = new Date().getFullYear();

// Un espace déjà préparé pour cet identifiant est le cas normal d'une session
// qu'on reprend : le rendre plutôt que de refuser, avant même de vérifier si
// l'identifiant est pris — il l'est forcément, par cet espace-là.
if (demande) {
  const dejaLa = join(racine, '..', `${basename(racine)}-${demande}`);
  if (existsSync(dejaLa)) {
    console.log(`CADRAGE ${demande}`);
    console.log(`ESPACE ${resolve(dejaLa)}`);
    console.log(`BRANCHE cadrage-${demande}`);
    console.log(`FICHIER ${resolve(join(dejaLa, 'cadrages', demande, 'cadrage.md'))}`);
    console.log('REPRIS un espace existant');
    process.exit(0);
  }
}

let id = demande;
if (!id) {
  // La séquence ne comble jamais un trou : un identifiant abandonné reste brûlé,
  // et le réutiliser ferait pointer d'anciennes références vers un autre cadrage.
  const max = [...pris]
    .filter((p) => p.startsWith(`${annee}-`))
    .map((p) => Number(p.slice(5)))
    .reduce((a, b) => Math.max(a, b), 0);
  id = `${annee}-${String(max + 1).padStart(3, '0')}`;
} else if (pris.has(id)) {
  console.log(`IDENTIFIANT_PRIS ${id}`);
  process.exit(1);
}

const branche = `cadrage-${id}`;
const chemin = join(racine, '..', `${basename(racine)}-${id}`);

try {
  // Depuis la branche principale distante : partir de la copie locale ferait
  // hériter de ce qu'elle a de retard, ou pire, du travail d'une autre session.
  git('fetch --quiet origin');
  const principale = git('symbolic-ref --short refs/remotes/origin/HEAD').replace(/^origin\//, '');
  git(`worktree add --quiet -b ${branche} "${chemin}" origin/${principale}`);
} catch (e) {
  console.log(`ECHEC ${String(e.stderr ?? e.message).split('\n')[0]}`);
  process.exit(1);
}

mkdirSync(join(chemin, 'cadrages', id, 'decisions'), { recursive: true });

console.log(`CADRAGE ${id}`);
console.log(`ESPACE ${resolve(chemin)}`);
console.log(`BRANCHE ${branche}`);
console.log(`FICHIER ${resolve(join(chemin, 'cadrages', id, 'cadrage.md'))}`);
