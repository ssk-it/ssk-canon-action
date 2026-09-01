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

/**
 * Jusqu'où le skill va de lui-même, une fois le cadrage écrit.
 *
 * Le défaut ne fait rien : écrire dans le dépôt de quelqu'un, pousser une
 * branche que d'autres verront, ouvrir une demande qui sollicite une relecture
 * sont trois gestes de portée croissante, et aucun ne doit se produire sans
 * qu'on l'ait voulu.
 */
const ARRETS = ['ecriture', 'commit', 'push', 'pr'];
const ARRET_PAR_DEFAUT = 'ecriture';

let racines;
let arretGlobal = ARRET_PAR_DEFAUT;
try {
  const brut = JSON.parse(readFileSync(CONFIG, 'utf8'));
  racines = Array.isArray(brut) ? brut : (brut.projets ?? []);
  if (!Array.isArray(racines)) throw new Error('« projets » doit être une liste');

  if (!Array.isArray(brut) && brut.arret !== undefined) {
    if (!ARRETS.includes(brut.arret)) {
      dire(`ARRET_INCONNU ${brut.arret} — attendu : ${ARRETS.join(', ')}`);
    } else {
      arretGlobal = brut.arret;
    }
  }
} catch (e) {
  dire(`CONFIG_ILLISIBLE ${CONFIG} — ${e.message}`);
  process.exit(0);
}

/**
 * Tous les projets qui déclarent le dépôt courant, non le dernier vu.
 *
 * Deux applications peuvent partager un dépôt de code sans partager leur
 * cadrage — un back qui porte deux produits, un front qui en assemble deux. Ne
 * garder que le dernier ferait décider l'ordre du fichier de configuration,
 * qui n'a aucune autorité pour cela : le cadrage atterrirait dans un
 * référentiel ou dans l'autre selon une ligne écrite une fois et jamais relue,
 * sans que rien ne le signale.
 */
const candidats = [];
for (const brut of racines) {
  const enObjet = typeof brut === 'object' && brut !== null;
  const racine = developper(enObjet ? (brut.chemin ?? '') : brut);
  const projet = lireProjet(racine);
  if (!projet) {
    dire(`PROJET_INTROUVABLE ${racine} (pas de ssk-canon.yml)`);
    continue;
  }
  dire(`PROJET ${projet.nom} | ${racine}`);
  for (const d of projet.depots) dire(`  DEPOT_CODE ${d}`);
  if (courant && projet.depots.includes(courant)) {
    // Le réglage du projet prime sur le réglage général : on peut vouloir
    // pousser d'office sur un projet et rien du tout sur un autre.
    let arret = arretGlobal;
    if (enObjet && brut.arret !== undefined) {
      if (ARRETS.includes(brut.arret)) arret = brut.arret;
      else dire(`  ARRET_INCONNU ${brut.arret} — le réglage général s'applique`);
    }
    candidats.push({ projet, arret });
    dire('  ↑ déclare le dépôt courant');
  }
}

if (candidats.length === 0) {
  dire('AUCUN_PROJET_NE_DECLARE_CE_DEPOT');
  dire(`ARRET ${arretGlobal}`);
} else if (candidats.length === 1) {
  dire(`CADRAGE_RETENU ${candidats[0].projet.racine}`);
  dire(`ARRET ${candidats[0].arret}`);
} else {
  // Pas de CADRAGE_RETENU : l'ambiguïté se demande, elle ne se tranche pas
  // ici. Choisir à la place du rédacteur écrirait dans un référentiel qu'il
  // n'a pas désigné, et une erreur muette de ce genre ne se voit qu'après
  // coup. Aucun ARRET non plus : il dépend du projet, encore inconnu.
  dire(`PLUSIEURS_PROJETS_DECLARENT_CE_DEPOT ${candidats.length}`);
  for (const c of candidats) dire(`  CANDIDAT ${c.projet.nom} | ${c.projet.racine}`);
}
