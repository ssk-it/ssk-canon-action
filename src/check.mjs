// Vérification d'intégrité d'un dépôt de projet, depuis le système de fichiers.
//
// Les règles elles-mêmes vivent dans `verifier.mjs`, qui ne dépend d'aucun
// système de fichiers et s'exécute aussi dans un navigateur. Ce module ne fait
// que charger le dépôt et lui passer le relais.
//
//   node src/check.mjs [chemin-du-depot] [--base <ref>] [--sans-immuabilite]

import { loadRepo } from './parse.mjs';
import { checkRepo } from './verifier.mjs';
import {
  listCadragesLivres,
  listFichiersModifies,
  findCadragesLivresModifies,
} from './livraison.mjs';

export { checkRepo };

/**
 * @param {string} root
 * @param {{ ignorerIndexDerives?: boolean, livres?: Set<string>, base?: string, immuabilite?: boolean }} [options]
 */
export function check(root, options = {}) {
  const { base, livres: livresFournis, immuabilite = true, ...reste } = options;

  // Le statut d'un cadrage n'est pas déclaré : il se déduit du dépôt, et la
  // branche principale est ce qui établit la livraison. Hors dépôt Git — un
  // référentiel vérifié depuis une archive — aucun cadrage n'est tenu pour
  // livré, ce que `checkRepo` traite comme un cas normal.
  const livres = livresFournis ?? listCadragesLivres(root, base ?? 'origin/main') ?? new Set();
  const resultat = checkRepo(loadRepo(root), { ...reste, livres });

  // L'immuabilité ne se contrôle que face à une base explicite, c'est-à-dire sur
  // une demande de fusion. La propagation, elle, s'exécute après la fusion : son
  // écart avec la branche principale est le cadrage qu'on vient de livrer, et
  // l'y contrôler refuserait toute livraison.
  //
  // Un référentiel peut avoir à le suspendre le temps d'une reprise de format :
  // le cadrage qui institue l'immuabilité doit lui-même toucher les cadrages
  // livrés, faute de quoi il ne peut pas être livré. La suspension se déclare, se
  // relit dans le workflow, et n'a pas à être retirée du code puis remise.
  const erreursImmuabilite =
    base && immuabilite ? checkImmuabilite(root, base, livres) : [];

  return { ...resultat, errors: [...resultat.errors, ...erreursImmuabilite] };
}

/**
 * Refuse la modification d'un cadrage déjà livré — RG-cadrage-livre-immuable.
 *
 * Le référentiel est la projection des cadrages livrés : modifier l'un d'eux
 * change ce que le référentiel devrait contenir, sans que rien ne le repropage.
 *
 * Le contrôle porte sur un écart entre deux états, là où les autres se
 * contentent du dernier : il n'a de sens que sur une demande de fusion, et se
 * tait partout où la comparaison n'est pas possible — un dépôt sans historique,
 * ou la branche principale elle-même, où l'écart est vide par construction.
 */
function checkImmuabilite(root, base, livres) {
  const fichiers = listFichiersModifies(root, base);
  if (fichiers === null || !fichiers.length) return [];

  const errors = [];
  for (const [id, chemins] of findCadragesLivresModifies(fichiers, livres)) {
    errors.push(
      `cadrage ${id} : livré, donc figé — ${chemins.join(', ')} ; ` +
        `ce qui doit changer se change par un nouveau cadrage`,
    );
  }
  return errors;
}

// exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const iBase = args.indexOf('--base');
  const base = iBase === -1 ? undefined : args[iBase + 1];
  // sans `--base`, aucun indice n'est à sauter : -1 + 1 vaut 0, qui est le
  // chemin lui-même
  const iValeur = iBase === -1 ? -1 : iBase + 1;
  const root = args.find((a, i) => !a.startsWith('--') && i !== iValeur) ?? '.';

  const { errors, warnings, counts } = check(root, {
    ...(base ? { base } : {}),
    immuabilite: !args.includes('--sans-immuabilite'),
  });

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
