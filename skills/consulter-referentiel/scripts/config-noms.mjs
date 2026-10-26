// Les noms qu'un référentiel déclare dans `ssk-canon.yml` — RG-noms-declares.
//
// Les scripts des skills tournent sans rien d'installé : ils ne peuvent ni
// importer la bibliothèque, ni lire YAML. Ce fichier lit les seuls blocs
// `dossiers` et `fichiers`, ligne à ligne, et confie le reste à `noms.mjs`,
// copie exacte de `src/noms.mjs` — la résolution reste celle de la
// vérification. Il est identique dans chaque skill qui le porte, et un test
// le confronte à YAML.

import { resoudreNoms } from './noms.mjs';

const BLOCS = ['dossiers', 'fichiers'];

/** Une valeur scalaire, telle que YAML la comprendrait. */
function scalaire(brut) {
  const v = brut.trim();
  const cite = /^'(.*)'$/.exec(v) ?? /^"(.*)"$/.exec(v);
  if (cite) return cite[1];
  if (v === '' || v === '~' || v === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === 'true' || v === 'false') return v === 'true';
  return v;
}

/** Retire un commentaire de fin de ligne, hors d'une valeur citée. */
function sansCommentaire(ligne) {
  let cite = null;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (cite) {
      if (c === cite) cite = null;
    } else if (c === "'" || c === '"') cite = c;
    else if (c === '#' && (i === 0 || /\s/.test(ligne[i - 1]))) return ligne.slice(0, i);
  }
  return ligne;
}

/** Une table en ligne : `{ a: b, c: d }`. */
function tableEnLigne(texte) {
  const table = {};
  for (const paire of texte.slice(1, -1).split(',')) {
    const m = /^\s*([\w-]+)\s*:(.*)$/.exec(paire);
    if (m) table[m[1]] = scalaire(m[2]);
  }
  return table;
}

/**
 * Les blocs `dossiers` et `fichiers` de la configuration, tels que YAML les
 * lirait pour les formes qu'on y écrit : une table indentée, ou en ligne.
 */
export function lireBlocs(texte) {
  const config = {};
  let courant = null;
  for (const brute of String(texte ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const ligne = sansCommentaire(brute).replace(/\s+$/, '');
    if (!ligne.trim()) continue;
    const haut = /^([\w-]+)\s*:(.*)$/.exec(ligne);
    if (haut) {
      courant = BLOCS.includes(haut[1]) ? haut[1] : null;
      if (!courant) continue;
      const reste = haut[2].trim();
      if (reste.startsWith('{') && reste.endsWith('}')) {
        config[courant] = tableEnLigne(reste);
        courant = null;
      } else if (reste) {
        config[courant] = scalaire(reste);
        courant = null;
      } else config[courant] = {};
      continue;
    }
    const entree = courant && /^\s+([\w-]+)\s*:(.*)$/.exec(ligne);
    if (entree) config[courant][entree[1]] = scalaire(entree[2]);
  }
  return config;
}

/** Les noms d'un référentiel, à partir du texte de sa configuration. */
export function lireNoms(texte) {
  return resoudreNoms(lireBlocs(texte));
}

/**
 * Les noms déclarés autrement que le format, en une ligne : « dossiers.regles=
 * exigences fichiers.cadrage=evolution.md ». Vide quand rien ne diffère.
 */
export function nomsDeclares(noms) {
  const defaut = resoudreNoms(null);
  return BLOCS.flatMap((bloc) =>
    Object.entries(noms[bloc])
      .filter(([cle, nom]) => nom !== defaut[bloc][cle])
      .map(([cle, nom]) => `${bloc}.${cle}=${nom}`),
  ).join(' ');
}
