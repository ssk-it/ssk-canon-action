// Tests de la garde qui empêche une propagation d'ouvrir une seconde demande.
//
// Ce qu'ils protègent : la propagation se déclenche aussi à heure fixe, pour
// rattraper une poussée que GitHub n'a pas transmise. Sur une branche protégée,
// chaque exécution qui trouve des écritures en attente ouvrirait sinon sa
// propre demande, dont la branche porte un nom tiré de son commit.
//
//   node src/propagation-en-attente.test.mjs

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasPropagationEnAttente } from './propagation-en-attente.mjs';

let reussis = 0;
const echecs = [];

function test(nom, fn) {
  try {
    fn();
    reussis += 1;
  } catch (erreur) {
    echecs.push(`${nom} : ${erreur.message}`);
  }
}

function egal(obtenu, attendu) {
  if (obtenu !== attendu) throw new Error(`attendu ${attendu}, obtenu ${obtenu}`);
}

test('voit une demande de propagation déjà ouverte', () => {
  egal(hasPropagationEnAttente([{ headRefName: 'propagation/1a2b3c4' }]), true);
});

test('ignore les demandes qui ne viennent pas de la propagation', () => {
  egal(
    hasPropagationEnAttente([{ headRefName: 'cadrage-2026-020' }, { headRefName: 'propagations' }]),
    false,
  );
});

test('ne voit rien sans demande ouverte', () => {
  egal(hasPropagationEnAttente([]), false);
});

test('lit la liste de gh sur son entrée, et le dit par oui ou non', () => {
  // C'est ainsi que `action.yml` l'appelle : `gh pr list --json headRefName | node …`.
  const script = fileURLToPath(new URL('./propagation-en-attente.mjs', import.meta.url));
  const sortie = (entree) =>
    execFileSync('node', [script], { input: JSON.stringify(entree) }).toString().trim();
  egal(sortie([{ headRefName: 'propagation/9f9f9f9' }]), 'oui');
  egal(sortie([]), 'non');
});

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
