// Vérification d'intégrité d'un dépôt de projet, depuis le système de fichiers.
//
// Les règles elles-mêmes vivent dans `verifier.mjs`, qui ne dépend d'aucun
// système de fichiers et s'exécute aussi dans un navigateur. Ce module ne fait
// que charger le dépôt et lui passer le relais.
//
//   node src/check.mjs [chemin-du-depot] [--base <ref>] [--sans-immuabilite] [--livraison]

import { load } from 'js-yaml';
import { loadRepo } from './parse.mjs';
import { checkRepo } from './verifier.mjs';
import { resoudreNoms } from './noms.mjs';
import {
  lireFichierA,
  dossierPresentA,
  listCadragesLivres,
  listCadragesPortes,
  listFichiersModifies,
  findCadragesLivresModifies,
  pointDeFusion,
} from './livraison.mjs';

export { checkRepo };

/**
 * @param {string} root
 * @param {{ ignorerIndexDerives?: boolean, livres?: Set<string>, base?: string, immuabilite?: boolean, livraison?: boolean }} [options]
 */
export function check(root, options = {}) {
  const { base, livres: livresFournis, immuabilite = true, livraison = false, ...reste } = options;

  // Le statut d'un cadrage n'est pas déclaré : il se déduit du dépôt, et la
  // branche principale est ce qui établit la livraison. Hors dépôt Git — un
  // référentiel vérifié depuis une archive — aucun cadrage n'est tenu pour
  // livré, ce que `checkRepo` traite comme un cas normal.
  const reference = base ?? 'origin/main';
  const repo = loadRepo(root);
  const dossier = repo.noms.dossiers.cadrages;
  const livres = livresFournis ?? listCadragesLivres(root, reference, dossier) ?? new Set();

  // Une branche que la référence a déjà fusionnée y trouve son propre cadrage
  // livré, sans la propagation qui suit la fusion : ses index dérivés sont en
  // attente, non faux. Les réclamer au rédacteur lui ferait chercher une erreur
  // qui n'existe pas — c'est la propagation qui en répond, RG-propagation-verifiee.
  // La fusion se dit, sans rien bloquer — RG-branches-survivantes-signalees.
  const fusion = livresFournis ? null : pointDeFusion(root, reference);
  const resultat = checkRepo(repo, {
    ...reste,
    livres,
    ...(fusion ? { ignorerIndexDerives: true } : {}),
  });
  if (fusion)
    resultat.warnings.unshift(
      `branche déjà fusionnée dans « ${reference} », jusqu'à ${fusion} : ses index dérivés ` +
        `y attendent la propagation et ne sont pas contrôlés ici — repartir de ` +
        `« ${reference} », et changer un cadrage livré par un nouveau cadrage`,
    );

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
    base && immuabilite ? checkImmuabilite(root, base, livres, dossier) : [];

  // Ce que la fusion exigera, réclamé tant qu'il est encore temps de l'écrire —
  // RG-controle-de-livraison.
  const erreursLivraison =
    livraison && base ? checkLivraison(root, base, livres, resultat, dossier) : [];

  const erreursNoms = base ? checkNomsInchanges(root, base, repo.noms) : [];

  return {
    ...resultat,
    errors: [...resultat.errors, ...erreursNoms, ...erreursImmuabilite, ...erreursLivraison],
  };
}

/**
 * Refuse qu'un nom déclaré change, une fois que son dossier existe —
 * RG-noms-declares, RG-chemins-immuables.
 *
 * Le nom se choisit à la création. Le changer laisserait les fichiers sous un
 * nom que plus rien ne lit, ou les déplacerait en perdant leur historique. La
 * comparaison se fait avec la configuration de la base : c'est elle qui dit le
 * nom précédent, que l'état courant a oublié.
 */
function checkNomsInchanges(root, base, noms) {
  let configBase = null;
  try {
    configBase = load(lireFichierA(root, base, 'ssk-canon.yml') ?? '');
  } catch {
    // une configuration de base illisible ne dit aucun nom précédent
    return [];
  }
  const avant = resoudreNoms(configBase);
  const cadragesAvant = dossierPresentA(root, base, avant.dossiers.cadrages);
  const errors = [];

  for (const bloc of ['dossiers', 'fichiers'])
    for (const [cle, nom] of Object.entries(noms[bloc])) {
      const ancien = avant[bloc][cle];
      if (nom === ancien) continue;
      // Un nom de la racine compte dès que son dossier existe ; un nom interne
      // à un cadrage, dès qu'un cadrage existe.
      const interne = bloc === 'fichiers' || cle === 'decisions_cadrage';
      const existe = interne ? cadragesAvant : dossierPresentA(root, base, ancien);
      if (existe)
        errors.push(
          `ssk-canon.yml → ${bloc}.${cle} : passe de « ${ancien} » à « ${nom} » — ` +
            `un nom se choisit à la création, et ne change plus`,
        );
    }
  return errors;
}

/**
 * Contrôle l'état qu'aura le référentiel une fois la demande de fusion fusionnée
 * — RG-controle-de-livraison.
 *
 * Le référentiel est relu en tenant pour livrés les cadrages que la demande
 * porte, et seules les erreurs que cette hypothèse fait apparaître sont
 * rapportées : les autres ont déjà été dites par la vérification ordinaire, et
 * les répéter ferait douter de leur nombre.
 *
 * Les index dérivés sont exclus : `cree_par` et `modifie_par` sont écrits par la
 * propagation, après la fusion. Les exiger avant reviendrait à réclamer au
 * rédacteur ce que la machine doit produire.
 */
function checkLivraison(root, base, livres, dejaVu, dossier) {
  const portes = listCadragesPortes(root, base, dossier);

  // Ne pas savoir ce que la demande porte n'est pas une demande sans cadrage :
  // le contrôle n'a pas eu lieu, et se taire le rendrait silencieusement
  // inapplicable — le même piège que l'immuabilité sans historique.
  if (portes === null)
    return [
      `livraison : « ${base} » est hors d'atteinte, le contrôle n'a pas pu ` +
        `avoir lieu — récupérer l'historique avec « fetch-depth: 0 »`,
    ];

  const nouveaux = [...portes].filter((id) => !livres.has(id));
  if (!nouveaux.length) return [];

  const apresFusion = checkRepo(loadRepo(root), {
    livres: new Set([...livres, ...nouveaux]),
    ignorerIndexDerives: true,
  });

  const connues = new Set(dejaVu.errors);
  return apresFusion.errors
    .filter((e) => !connues.has(e))
    .map((e) => `à la livraison : ${e}`);
}

/**
 * Refuse la modification d'un cadrage déjà livré — RG-cadrage-livre-immuable.
 *
 * Le référentiel est la projection des cadrages livrés : modifier l'un d'eux
 * change ce que le référentiel devrait contenir, sans que rien ne le repropage.
 *
 * Le contrôle porte sur un écart entre deux états, là où les autres se
 * contentent du dernier : il n'a de sens que sur une demande de fusion, et se
 * tait sur la branche principale elle-même, où l'écart est vide par
 * construction. Une base hors d'atteinte, en revanche, se signale : le contrôle
 * n'a pas eu lieu, ce qui ne se confond pas avec un référentiel conforme.
 */
function checkImmuabilite(root, base, livres, dossier) {
  const fichiers = listFichiersModifies(root, base);

  // Une base hors d'atteinte n'est pas un référentiel conforme : c'est un
  // contrôle qui n'a pas eu lieu. Se taire ici rendait la règle silencieusement
  // inapplicable — un dépôt dont le workflow omet `fetch-depth: 0` croyait
  // protéger ses cadrages livrés alors que rien ne les vérifiait.
  if (fichiers === null)
    return [
      `immuabilité : « ${base} » est hors d'atteinte, le contrôle n'a pas pu ` +
        `avoir lieu — récupérer l'historique avec « fetch-depth: 0 »`,
    ];

  if (!fichiers.length) return [];

  const errors = [];
  for (const [id, chemins] of findCadragesLivresModifies(fichiers, livres, dossier)) {
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
    livraison: args.includes('--livraison'),
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
