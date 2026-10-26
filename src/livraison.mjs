// Ce qui établit qu'un cadrage est livré, et ce qui interdit de le reprendre.
//
// Le statut d'un cadrage n'est pas déclaré dans son fichier : il se déduit de
// l'état du dépôt. La branche principale est le seul fait qui établit la
// livraison — voir RG-statuts-cadrage. Ce module est le seul endroit qui
// interroge Git ; `verifier.mjs` reçoit le résultat et ne sait pas d'où il vient,
// ce qui lui permet de continuer à s'exécuter dans un navigateur.

import { execFileSync } from 'node:child_process';

/** Exécute une commande Git, ou rend null si elle échoue. */
function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Identifiants des cadrages présents sur une référence Git.
 *
 * Rend `null` — et non un ensemble vide — quand la référence est hors d'atteinte.
 * L'appelant doit distinguer « aucun cadrage livré » de « je ne sais pas » : un
 * historique tronqué rendrait sinon tout le référentiel non livré, et la
 * propagation effacerait des règles qu'elle croirait orphelines.
 *
 * @param {string} root racine du dépôt
 * @param {string} ref référence Git, typiquement `origin/main`
 * @param {string} [dossier] le dossier des cadrages, sous son nom déclaré
 * @returns {Set<string> | null}
 */
export function listCadragesLivres(root, ref = 'origin/main', dossier = 'cadrages') {
  // Un dépôt sans commit n'a pas de HEAD : rien n'y est livré, ce qui est un
  // état normal — un référentiel qu'on vient d'initialiser — et non une panne.
  if (ref === 'HEAD' && git(root, ['rev-parse', '--verify', '-q', 'HEAD']) === null)
    return new Set();

  const sortie = git(root, ['ls-tree', '-d', '--name-only', `${ref}`, `${dossier}/`]);
  if (sortie === null) return null;

  const ids = new Set();
  for (const ligne of sortie.split('\n')) {
    const nom = ligne.trim().replace(/\/$/, '').split('/').pop();
    if (nom) ids.add(nom);
  }
  return ids;
}

/**
 * Le contenu d'un fichier sur une référence, ou `null` s'il n'y existe pas ou
 * que la référence est hors d'atteinte.
 */
export function lireFichierA(root, ref, chemin) {
  return git(root, ['show', `${ref}:${chemin}`]);
}

/** Vrai si la référence porte au moins un fichier sous ce dossier. */
export function dossierPresentA(root, ref, dossier) {
  return Boolean(git(root, ['ls-tree', '--name-only', ref, `${dossier}/`])?.trim());
}

/**
 * L'ordre dans lequel les cadrages ont été livrés sur une référence.
 *
 * L'identifiant ne le dit pas : il est attribué à la préparation, et deux
 * cadrages préparés en parallèle se livrent dans l'ordre de leurs fusions, non
 * de leurs numéros. La livraison se lit donc dans l'historique de la branche
 * principale, en première parenté : pour un cadrage livré par une demande de
 * fusion, c'est le commit de fusion qui l'introduit, quelle que soit la date à
 * laquelle il a été commité sur sa branche.
 *
 * @param {{ dossier?: string, fichier?: string }} [noms] le dossier des
 *   cadrages et le fichier qui porte chacun, sous leurs noms déclarés
 * @returns {Map<string, number> | null} le rang de livraison de chaque cadrage,
 *   ou null si l'historique n'a pas pu être lu
 */
export function ordreDeLivraison(
  root,
  ref = 'HEAD',
  { dossier = 'cadrages', fichier = 'cadrage.md' } = {},
) {
  const sortie = git(root, [
    'log',
    '--first-parent',
    '--diff-merges=first-parent',
    '--diff-filter=A',
    '--reverse',
    '--format=@%H',
    '--name-only',
    ref,
    '--',
    dossier,
  ]);
  if (sortie === null) return null;

  const rangs = new Map();
  let rang = 0;
  for (const ligne of sortie.split('\n')) {
    if (ligne.startsWith('@')) {
      rang += 1;
      continue;
    }
    const [haut, id, nom, ...reste] = ligne.trim().split('/');
    if (haut === dossier && nom === fichier && !reste.length && !rangs.has(id)) rangs.set(id, rang);
  }
  return rangs;
}

/**
 * Fichiers modifiés entre une référence et l'état courant.
 *
 * La comparaison part de leur ancêtre commun (`...`), non de la pointe de la
 * référence : sans cela, tout ce qui est arrivé sur la branche principale depuis
 * qu'on s'en est détaché passerait pour une modification de la demande de fusion.
 *
 * @returns {string[] | null} chemins relatifs, ou null si la comparaison échoue
 */
export function listFichiersModifies(root, ref = 'origin/main') {
  const sortie = git(root, ['diff', '--name-only', `${ref}...HEAD`]);
  if (sortie === null) return null;
  return sortie.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Le dernier commit de la branche courante qu'une référence a déjà fusionné.
 *
 * Une branche en cours se détache de la branche principale sur sa première
 * parenté : leur ancêtre commun est un commit de la branche principale elle-même.
 * Une branche fusionnée, elle, a son ancêtre commun sur la branche principale par
 * la seconde parenté d'un commit de fusion — c'est la pointe qu'avait la branche
 * quand on l'a fusionnée. Le cas se rencontre dès qu'un `fetch` suit la fusion :
 * la référence porte alors le cadrage de la branche, livré, mais pas encore
 * propagé.
 *
 * Une branche partie d'une branche fusionnée depuis répond de la même façon, et
 * c'est juste : ce qu'elle porte encore de sa devancière est déjà livré.
 *
 * @param {string} root racine du dépôt
 * @param {string} ref référence de comparaison, typiquement `origin/main`
 * @returns {string | null} l'identifiant abrégé de ce commit, ou null si la
 *   branche n'a pas été fusionnée — ou si la référence est hors d'atteinte, ce
 *   que les autres contrôles signalent déjà
 */
export function pointDeFusion(root, ref = 'origin/main') {
  const ancetre = git(root, ['merge-base', ref, 'HEAD'])?.trim();
  if (!ancetre) return null;

  const principale = git(root, ['rev-list', '--first-parent', ref]);
  if (principale === null || principale.split('\n').includes(ancetre)) return null;

  return git(root, ['rev-parse', '--short', ancetre])?.trim() ?? ancetre;
}

/**
 * Cadrages qu'une demande de fusion porte — ceux que sa fusion livrerait.
 *
 * Rend `null` quand la comparaison échoue, comme `listFichiersModifies` : ne pas
 * savoir ce que la demande porte ne se confond pas avec une demande qui ne porte
 * aucun cadrage, où le contrôle de livraison n'aurait rien à dire.
 *
 * @param {string} root racine du dépôt
 * @param {string} ref référence de comparaison, typiquement `origin/main`
 * @param {string} [dossier] le dossier des cadrages, sous son nom déclaré
 * @returns {Set<string> | null}
 */
export function listCadragesPortes(root, ref = 'origin/main', dossier = 'cadrages') {
  const fichiers = listFichiersModifies(root, ref);
  if (fichiers === null) return null;

  const ids = new Set();
  for (const chemin of [...fichiers, ...listFichiersEnCours(root)]) {
    const parts = chemin.split('/');
    if (parts[0] === dossier && parts.length > 1) ids.add(parts[1]);
  }
  return ids;
}

/**
 * Fichiers de l'arbre de travail que le dernier enregistrement ne porte pas
 * encore — modifiés ou pas même suivis.
 *
 * Sur une exécution d'intégration continue, l'arbre est propre et cette liste
 * est vide : elle n'existe que pour la vérification lancée à la main, où le
 * cadrage qu'on vient d'écrire n'est souvent pas encore enregistré. Sans elle,
 * le contrôle de livraison se tairait au moment précis où il servirait le plus.
 */
function listFichiersEnCours(root) {
  // `-uall` : sans lui, un répertoire entièrement non suivi est rapporté comme
  // répertoire — « cadrages/ » plutôt que les cadrages qu'il contient — et le
  // premier cadrage d'un référentiel neuf échapperait au contrôle.
  const sortie = git(root, ['status', '--porcelain', '-uall']);
  if (sortie === null) return [];

  return sortie
    .split('\n')
    .map((l) => l.slice(3).trim())
    // un renommage s'écrit « ancien -> nouveau » : c'est le nouveau qui compte
    .map((l) => l.split(' -> ').pop())
    .filter(Boolean);
}

/**
 * Cadrages livrés qu'une demande de fusion modifie — ce que RG-cadrage-livre-immuable
 * interdit.
 *
 * L'interdiction couvre tout le répertoire du cadrage, décisions comprises : une
 * décision ajoutée après la livraison n'a été relue par personne, alors que la
 * validation portait sur ce qui était présent quand elle a été donnée.
 *
 * @param {string[]} fichiers chemins modifiés
 * @param {Set<string>} livres identifiants présents sur la branche principale
 * @param {string} [dossier] le dossier des cadrages, sous son nom déclaré
 * @returns {Map<string, string[]>} par cadrage, les fichiers en cause
 */
export function findCadragesLivresModifies(fichiers, livres, dossier = 'cadrages') {
  const touches = new Map();

  for (const chemin of fichiers) {
    const parts = chemin.split('/');
    if (parts[0] !== dossier || parts.length < 2) continue;

    const id = parts[1];
    if (!livres.has(id)) continue;

    if (!touches.has(id)) touches.set(id, []);
    touches.get(id).push(chemin);
  }

  return touches;
}
