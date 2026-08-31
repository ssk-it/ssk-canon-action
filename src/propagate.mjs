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

/** Ordre des clés dans le frontmatter d'une règle, pour un diff lisible. */
const ORDRE_CLES = ['id', 'fonctionnalites', 'statut', 'cree_par', 'modifie_par'];

/**
 * Calcule l'état que le référentiel devrait avoir, d'après les cadrages livrés.
 *
 * Les cadrages sont parcourus dans l'ordre de leur identifiant, qui porte
 * l'année et la séquence : c'est l'ordre de livraison, et il détermine quel
 * énoncé fait foi quand deux cadrages touchent la même règle.
 */
export function etatAttendu(repo) {
  const attendu = new Map();

  const livres = [...repo.cadrages.values()]
    .filter((c) => c.statut === 'livree')
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const cadrage of livres) {
    const enonces = extractEnonces(cadrage.body);

    for (const impact of cadrage.impacts ?? []) {
      const { regle, operation } = impact;
      if (operation === 'touche') continue; // ne produit aucune écriture

      if (!attendu.has(regle)) {
        attendu.set(regle, {
          id: regle,
          statut: 'actif',
          cree_par: null,
          modifie_par: [],
          enonce: null,
        });
      }
      const cible = attendu.get(regle);

      switch (operation) {
        case 'cree':
          cible.cree_par = cadrage.id;
          cible.enonce = enonces.get(regle) ?? cible.enonce;
          break;
        case 'modifie':
          cible.modifie_par.push(cadrage.id);
          cible.enonce = enonces.get(regle) ?? cible.enonce;
          break;
        case 'abroge':
          cible.modifie_par.push(cadrage.id);
          cible.statut = 'abroge';
          // une abrogation peut réécrire l'énoncé pour expliquer pourquoi
          if (enonces.has(regle)) cible.enonce = enonces.get(regle);
          break;
      }
    }
  }
  return attendu;
}

/** Sérialise une règle dans le format du référentiel. */
function ecrireRegle(regle, fonctionnalites, enonce) {
  const donnees = {
    id: regle.id,
    fonctionnalites,
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
 * Compare l'attendu au réel et retourne les écritures nécessaires.
 * Ne modifie rien : c'est la phase de calcul du « tout ou rien ».
 */
export function calculerEcritures(root) {
  const repo = loadRepo(root);
  const attendu = etatAttendu(repo);
  const ecritures = [];
  const problemes = [];

  for (const [id, cible] of attendu) {
    if (cible.enonce === null) {
      problemes.push(
        `règle ${id} : aucun énoncé fourni par les cadrages qui la créent ou la modifient`,
      );
      continue;
    }

    const existante = repo.rules.get(id);
    // le rattachement aux fonctionnalités est une donnée du référentiel, pas
    // du cadrage : la propagation ne le décide pas, elle le préserve
    const fonctionnalites = existante?.fonctionnalites ?? [];
    if (!existante && !fonctionnalites.length) {
      problemes.push(
        `règle ${id} : créée par un cadrage mais rattachée à aucune fonctionnalité — ` +
          `créer le fichier avec son rattachement avant de livrer`,
      );
      continue;
    }

    const contenu = ecrireRegle(cible, fonctionnalites, cible.enonce);
    const chemin = join(root, 'rules', `${id}.md`);
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
  const integrite = check(root, { ignorerIndexDerives: true });
  if (integrite.errors.length) {
    return {
      ok: false,
      ecritures: [],
      problemes: integrite.errors.map((e) => `intégrité : ${e}`),
    };
  }

  const { ecritures, problemes } = calculerEcritures(root);
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
