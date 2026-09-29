// Dit si une demande de propagation attend déjà sa fusion.
//
// Sur une branche protégée, la propagation passe par une demande de fusion
// dont la branche porte un nom tiré de son commit (`propagation/<sha>`). Elle
// se déclenche aussi à heure fixe, pour rattraper une poussée que GitHub n'a
// pas transmise : sans cette garde, chaque exécution qui trouve les mêmes
// écritures en attente ouvrirait sa propre demande.
//
//   gh pr list --state open --json headRefName | node src/propagation-en-attente.mjs
//   → « oui » ou « non »

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Le préfixe des branches que la propagation ouvre. */
const PREFIXE = 'propagation/';

/** Vrai quand l'une des demandes ouvertes vient de la propagation. */
export function hasPropagationEnAttente(demandes) {
  return demandes.some((demande) => demande.headRefName?.startsWith(PREFIXE) === true);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const demandes = JSON.parse(readFileSync(0, 'utf8'));
  console.log(hasPropagationEnAttente(demandes) ? 'oui' : 'non');
}
