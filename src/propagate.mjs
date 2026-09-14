// Application des impacts au référentiel.
//
// Déclenchée au merge d'un cadrage sur la branche principale. Le principe :
// l'Action ne rejoue pas un historique, elle **compare l'état déclaré par les
// cadrages livrés à l'état réel du référentiel**, et n'écrit que l'écart.
//
// Deux propriétés en découlent :
//
// - **Idempotence** : relancer la propagation sur un référentiel à jour ne
//   produit aucune écriture. On peut donc la rejouer sans risque après un échec,
//   ou pour rattraper une propagation manquée.
// - **Tout ou rien** : les écritures sont calculées d'abord, appliquées ensuite.
//   Une incohérence interrompt avant toute écriture, laissant le référentiel
//   dans son état précédent, qui est cohérent.
//
//   node src/propagate.mjs [chemin-du-depot] [--dry-run]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { loadRepo, splitFrontmatter, extractEnonces } from './parse.mjs';
import { check } from './check.mjs';
import { cibleDe as natureDe } from './verifier.mjs';
import { listCadragesLivres } from './livraison.mjs';

/** Ordre des clés dans le frontmatter d'une règle, pour un diff lisible. */
const ORDRE_CLES = [
  'id',
  'fonctionnalites',
  'nature',
  'composants',
  'statut',
  'cree_par',
  'modifie_par',
];

/**
 * Calcule l'état que le référentiel devrait avoir, d'après les cadrages livrés.
 *
 * Les cadrages sont parcourus dans l'ordre de leur identifiant, qui porte
 * l'année et la séquence : c'est l'ordre de livraison, et il détermine quel
 * énoncé fait foi quand deux cadrages touchent la même règle.
 */
export function etatAttendu(repo, livres) {
  const attendu = new Map();

  const cadragesLivres = [...repo.cadrages.values()]
    .filter((c) => livres.has(c.id))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const cadrage of cadragesLivres) {
    const enonces = extractEnonces(cadrage.body);

    for (const impact of cadrage.impacts ?? []) {
      const { operation } = impact;
      if (operation === 'touche') continue; // ne produit aucune écriture

      // La nature est retenue avec la cible : c'est elle qui dira dans quel
      // répertoire écrire. La déduire plus tard obligerait à deviner d'après
      // l'identifiant, or rien n'impose qu'un préfixe le trahisse.
      const nature = natureDe(impact);
      if (!nature) continue; // impact sans cible : la vérification l'a déjà dit
      const { id: nom, collection } = nature;

      if (!attendu.has(nom)) {
        attendu.set(nom, {
          id: nom,
          collection,
          statut: 'actif',
          cree_par: null,
          modifie_par: [],
          enonce: null,
        });
      }
      const cible = attendu.get(nom);

      switch (operation) {
        case 'cree':
          cible.cree_par = cadrage.id;
          cible.enonce = enonces.get(nom) ?? cible.enonce;
          break;
        case 'modifie':
          cible.modifie_par.push(cadrage.id);
          cible.enonce = enonces.get(nom) ?? cible.enonce;
          break;
        case 'abroge':
          cible.modifie_par.push(cadrage.id);
          cible.statut = 'abroge';
          // une abrogation peut réécrire l'énoncé pour expliquer pourquoi
          if (enonces.has(nom)) cible.enonce = enonces.get(nom);
          break;
      }
    }
  }
  return attendu;
}

/**
 * Sérialise une cible dans le format du référentiel.
 *
 * `propres` porte ce que le référentiel décide et que le cadrage ne dicte pas :
 * le rattachement aux fonctionnalités pour une règle, la nature et les
 * composants reliés pour un document d'architecture. La propagation les
 * préserve sans jamais les choisir — c'est la même raison dans les deux cas.
 */
function ecrireRegle(regle, propres, enonce) {
  const donnees = {
    id: regle.id,
    ...propres,
    statut: regle.statut,
    cree_par: regle.cree_par,
    modifie_par: regle.modifie_par,
  };
  const ordonne = {};
  for (const cle of ORDRE_CLES) {
    if (donnees[cle] !== undefined) ordonne[cle] = donnees[cle];
  }
  const frontmatter = dump(ordonne, { lineWidth: -1, flowLevel: 1 }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${enonce.trim()}\n`;
}

/**
 * Les cadrages livrés, tels que le dépôt les établit.
 *
 * La propagation s'exécute après la fusion, sur la branche principale : ce qui
 * est livré est donc ce que `HEAD` porte, et non ce qu'en dit une référence
 * distante — celle-ci peut être en retard du merge qui vient de déclencher
 * l'exécution.
 *
 * Un dépôt hors d'atteinte fait échouer plutôt que rendre un ensemble vide :
 * sans cadrage livré, la propagation conclurait que le référentiel entier est
 * de trop.
 */
function livresDuDepot(root) {
  const livres = listCadragesLivres(root, 'HEAD');
  if (livres === null)
    throw new Error(
      "impossible de lire les cadrages livrés depuis Git — la propagation a besoin d'un dépôt",
    );
  return livres;
}

/**
 * Compare l'attendu au réel et retourne les écritures nécessaires.
 * Ne modifie rien : c'est la phase de calcul du « tout ou rien ».
 */
export function calculerEcritures(root, livres) {
  const repo = loadRepo(root);
  const attendu = etatAttendu(repo, livres ?? livresDuDepot(root));
  const ecritures = [];
  const problemes = [];

  for (const [id, cible] of attendu) {
    if (cible.enonce === null) {
      problemes.push(
        `${id} : aucun énoncé fourni par les cadrages qui le créent ou le modifient`,
      );
      continue;
    }

    const collection = cible.collection ?? 'rules';
    const existante = repo[collection]?.get(id);

    // Ce que le référentiel décide et que le cadrage ne dicte pas. Pour une
    // règle, le rattachement aux fonctionnalités ; pour un document
    // d'architecture, sa nature et les composants qu'il relie. La propagation
    // les préserve, elle ne les choisit jamais.
    const propres =
      collection === 'rules'
        ? { fonctionnalites: existante?.fonctionnalites ?? [] }
        : {
            ...(existante?.nature !== undefined ? { nature: existante.nature } : {}),
            ...(existante?.composants !== undefined ? { composants: existante.composants } : {}),
          };

    // Une règle doit être trouvable par la navigation du référentiel, qui passe
    // par les fonctionnalités. Les cibles d'architecture se consultent par leur
    // répertoire : rien à exiger de ce côté.
    if (collection === 'rules' && !existante && !propres.fonctionnalites.length) {
      problemes.push(
        `règle ${id} : créée par un cadrage mais rattachée à aucune fonctionnalité — ` +
          `créer le fichier avec son rattachement avant de livrer`,
      );
      continue;
    }

    const contenu = ecrireRegle(cible, propres, cible.enonce);
    const chemin = join(root, collection, `${id}.md`);
    const actuel = existante ? readFileSync(chemin, 'utf8') : null;

    if (actuel !== contenu) {
      ecritures.push({
        chemin,
        id,
        contenu,
        operation: existante ? 'mise à jour' : 'création',
      });
    }
  }

  return { ecritures, problemes, repo };
}

/** Applique les écritures calculées. */
export function propager(root, { dryRun = false } = {}) {
  // La vérification d'intégrité passe d'abord : propager sur un référentiel
  // incohérent produirait un référentiel plus incohérent encore.
  //
  // Mais on omet les contrôles sur les index dérivés, que la propagation écrit
  // justement : les exiger corrects ici rendrait toute désynchronisation
  // impossible à corriger, la propagation étant bloquée par ce qu'elle répare.
  // Lu une seule fois et passé aux deux étapes : deux lectures pourraient
  // différer, et la vérification porterait alors sur un autre référentiel que
  // celui qu'on propage.
  const livres = livresDuDepot(root);

  const integrite = check(root, { ignorerIndexDerives: true, livres });
  if (integrite.errors.length) {
    return {
      ok: false,
      ecritures: [],
      problemes: integrite.errors.map((e) => `intégrité : ${e}`),
    };
  }

  const { ecritures, problemes } = calculerEcritures(root, livres);
  if (problemes.length) {
    return { ok: false, ecritures: [], problemes };
  }

  if (!dryRun) {
    for (const e of ecritures) writeFileSync(e.chemin, e.contenu, 'utf8');
  }
  return { ok: true, ecritures, problemes: [] };
}

// exécution directe
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const root = args.find((a) => !a.startsWith('--')) ?? '.';

  const { ok, ecritures, problemes } = propager(root, { dryRun });

  if (!ok) {
    console.log(`\n${problemes.length} problème(s) — aucune écriture effectuée :`);
    for (const p of problemes) console.log(`  ✗ ${p}`);
    process.exit(1);
  }

  if (!ecritures.length) {
    console.log('Référentiel déjà à jour — rien à propager.');
    process.exit(0);
  }

  console.log(`${ecritures.length} règle(s) ${dryRun ? 'à écrire' : 'écrites'} :`);
  for (const e of ecritures) console.log(`  ${e.operation === 'création' ? '+' : '~'} ${e.id}`);
  if (dryRun) console.log('\n(simulation — aucun fichier modifié)');
}
