// Vérification d'intégrité d'un dépôt de projet, depuis le système de fichiers.
//
// Les règles elles-mêmes vivent dans `verifier.mjs`, qui ne dépend d'aucun
// système de fichiers et s'exécute aussi dans un navigateur. Ce module ne fait
// que charger le dépôt et lui passer le relais.
//
//   node src/check.mjs [chemin-du-depot]

import { loadRepo } from './parse.mjs';
import { checkRepo } from './verifier.mjs';

export { checkRepo };

/**
 * @param {string} root
 * @param {{ ignorerIndexDerives?: boolean }} [options]
 */
export function check(root, options = {}) {
  return checkRepo(loadRepo(root), options);
}

// exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? '.';
  const { errors, warnings, counts } = check(root);

  console.log(
    `${counts.domaines} domaines · ${counts.fonctionnalites} fonctionnalités · ` +
    `${counts.regles} règles · ${counts.cadrages} cadrages`
  );

  if (warnings.length) {
    console.log(`\n${warnings.length} avertissement(s) :`);
    for (const w of warnings) console.log(`  ~ ${w}`);
  }

  if (errors.length) {
    console.log(`\n${errors.length} erreur(s) :`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    process.exit(1);
  }

  console.log('\nIntégrité vérifiée.');
}
