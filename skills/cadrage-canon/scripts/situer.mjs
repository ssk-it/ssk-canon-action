#!/usr/bin/env node
/**
 * Situe le dépôt courant dans l'un des projets cadrés déclarés.
 *
 * Rien n'est à configurer dans un dépôt de code : son `origin` dit déjà comment
 * la plateforme le nomme, et c'est le dépôt de cadrage qui déclare quels dépôts
 * de code composent le projet. Le lien est ainsi déclaré une seule fois, du
 * côté qui a autorité, au lieu d'une fois par dépôt de code.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const CONFIG = join(homedir(), '.claude', 'cadrage-canon.json');
const dire = (...m) => console.log(...m);

function developper(chemin) {
  return resolve(chemin.startsWith('~') ? join(homedir(), chemin.slice(1)) : chemin);
}

/** Le dépôt courant, tel que la plateforme le nomme. */
function depotCourant() {
  try {
    const url = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return url.replace(/^git@[^:]+:/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '');
  } catch {
    return null;
  }
}

/**
 * Les dépôts de code déclarés par un référentiel.
 *
 * Lecture ligne à ligne plutôt qu'un analyseur YAML complet : le skill ne doit
 * rien avoir à installer pour se situer. Les deux formes admises par le format
 * sont reconnues — « - { repo: x, role: y } » et « - x ».
 */
function lireProjet(racine) {
  const yml = join(racine, 'ssk-canon.yml');
  if (!existsSync(yml)) return null;

  const lignes = readFileSync(yml, 'utf8').split('\n');
  let nom = '';
  const depots = [];
  let dansDepots = false;

  for (const ligne of lignes) {
    if (/^depots_code:/.test(ligne)) { dansDepots = true; continue; }
    // Toute clé de premier niveau referme le bloc.
    if (dansDepots && /^[a-z_]+:/.test(ligne)) dansDepots = false;

    if (!nom) {
      const m = ligne.match(/^ {2}nom: *(.+?) *$/);
      if (m) nom = m[1];
    }
    if (dansDepots) {
      const avecRole = ligne.match(/repo: *([^,}\s]+)/);
      const court = ligne.match(/^ *- *([^{\s]+) *$/);
      if (avecRole) depots.push(avecRole[1]);
      else if (court) depots.push(court[1]);
    }
  }
  return { nom: nom || '(sans nom)', racine, depots };
}

const courant = depotCourant();
dire(`DEPOT_COURANT ${courant ?? '(hors dépôt git)'}`);

if (!existsSync(CONFIG)) {
  dire(`CONFIG_ABSENTE ${CONFIG}`);
  process.exit(0);
}

let racines;
try {
  const brut = JSON.parse(readFileSync(CONFIG, 'utf8'));
  racines = Array.isArray(brut) ? brut : (brut.projets ?? []);
  if (!Array.isArray(racines)) throw new Error('« projets » doit être une liste');
} catch (e) {
  dire(`CONFIG_ILLISIBLE ${CONFIG} — ${e.message}`);
  process.exit(0);
}

let retenu = null;
for (const brut of racines) {
  const racine = developper(typeof brut === 'string' ? brut : brut?.chemin ?? '');
  const projet = lireProjet(racine);
  if (!projet) {
    dire(`PROJET_INTROUVABLE ${racine} (pas de ssk-canon.yml)`);
    continue;
  }
  dire(`PROJET ${projet.nom} | ${racine}`);
  for (const d of projet.depots) dire(`  DEPOT_CODE ${d}`);
  if (courant && projet.depots.includes(courant)) {
    retenu = projet;
    dire('  ↑ déclare le dépôt courant');
  }
}

dire(retenu ? `CADRAGE_RETENU ${retenu.racine}` : 'AUCUN_PROJET_NE_DECLARE_CE_DEPOT');
