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
 * @returns {Set<string> | null}
 */
export function listCadragesLivres(root, ref = 'origin/main') {
  // Un dépôt sans commit n'a pas de HEAD : rien n'y est livré, ce qui est un
  // état normal — un référentiel qu'on vient d'initialiser — et non une panne.
  if (ref === 'HEAD' && git(root, ['rev-parse', '--verify', '-q', 'HEAD']) === null)
    return new Set();

  const sortie = git(root, ['ls-tree', '-d', '--name-only', `${ref}`, 'cadrages/']);
  if (sortie === null) return null;

  const ids = new Set();
  for (const ligne of sortie.split('\n')) {
    const nom = ligne.trim().replace(/\/$/, '').split('/').pop();
    if (nom) ids.add(nom);
  }
  return ids;
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
 * Cadrages livrés qu'une demande de fusion modifie — ce que RG-cadrage-livre-immuable
 * interdit.
 *
 * L'interdiction couvre tout le répertoire du cadrage, décisions comprises : une
 * décision ajoutée après la livraison n'a été relue par personne, alors que la
 * validation portait sur ce qui était présent quand elle a été donnée.
 *
 * @param {string[]} fichiers chemins modifiés
 * @param {Set<string>} livres identifiants présents sur la branche principale
 * @returns {Map<string, string[]>} par cadrage, les fichiers en cause
 */
export function findCadragesLivresModifies(fichiers, livres) {
  const touches = new Map();

  for (const chemin of fichiers) {
    const parts = chemin.split('/');
    if (parts[0] !== 'cadrages' || parts.length < 2) continue;

    const id = parts[1];
    if (!livres.has(id)) continue;

    if (!touches.has(id)) touches.set(id, []);
    touches.get(id).push(chemin);
  }

  return touches;
}
