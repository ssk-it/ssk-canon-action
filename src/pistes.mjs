// Rattachement d'une piste, sans dépendance au système de fichiers.
//
// Une piste est une issue du dépôt de référentiel, étiquetée `piste`, rattachée
// à des domaines et des fonctionnalités par des étiquettes `domaine/<id>` et
// `fonctionnalite/<id>` — RG-piste-definition, RG-piste-rattachee. Elle ne passe
// par aucune demande de fusion : sa vérification se fait à l'événement de
// l'issue, et se signale par un commentaire.
//
// La lecture des étiquettes vit ici, à côté de celle du format, pour la même
// raison : l'Action qui vérifie une piste et l'application qui l'affiche doivent
// la lire de la même façon, et deux lectures finiraient par diverger.
//
// Un écart est une anomalie codée (RG-anomalies-codees) ; sa forme textuelle,
// `ecarts`, se dit dans la langue qu'on demande, en français par défaut.

import { avertissement, formaterAnomalie, LANGUE_PAR_DEFAUT } from './anomalies.mjs';

/** L'étiquette qui fait d'une issue une piste. */
export const ETIQUETTE_PISTE = 'piste';

/**
 * Les préfixes de rattachement, et ce qu'ils désignent dans un référentiel
 * chargé. Une table, comme les cibles d'un impact : un rattachement ajouté
 * demain hérite des contrôles sans qu'on ait à penser à chacun.
 *
 * `libelle` et `connus` restent pour qui les lisait : les messages, eux, se
 * disent par le catalogue (`messages/pistes.mjs`), dans chaque langue.
 */
export const RATTACHEMENTS_PISTE = [
  { prefixe: 'domaine/', collection: 'domains', libelle: 'aucun domaine', connus: 'domaines connus' },
  { prefixe: 'fonctionnalite/', collection: 'features', libelle: 'aucune fonctionnalité', connus: 'fonctionnalités connues' },
];

/** Le marqueur caché qui permet de retrouver le commentaire de la vérification. */
export const MARQUEUR_PISTE = '<!-- ssk-canon:piste-rattachee -->';

const nomEtiquette = (e) => (typeof e === 'string' ? e : e?.name ?? '');

/**
 * Les rattachements que portent des étiquettes, dans leur ordre.
 *
 * Une étiquette étrangère au rattachement n'y figure pas ; une étiquette de
 * rattachement sans identifiant y figure avec un identifiant vide, pour pouvoir
 * être signalée.
 *
 * @param {ReadonlyArray<string | { name?: string }>} etiquettes
 */
export function lireRattachementsPiste(etiquettes) {
  const out = [];
  for (const e of etiquettes) {
    const nom = nomEtiquette(e);
    const r = RATTACHEMENTS_PISTE.find((r) => nom.startsWith(r.prefixe));
    if (r) out.push({ etiquette: nom, collection: r.collection, id: nom.slice(r.prefixe.length) });
  }
  return out;
}

/** Vrai quand les étiquettes font de l'issue une piste. */
export function estPiste(etiquettes) {
  return etiquettes.some((e) => nomEtiquette(e) === ETIQUETTE_PISTE);
}

/**
 * Vérifie le rattachement d'une piste à un référentiel chargé.
 *
 * Une issue qui n'est pas une piste n'est pas vérifiée. Une étiquette qui ne
 * désigne rien ne vaut pas rattachement : la piste qui n'a qu'elle n'apparaît
 * nulle part, et cela se dit aussi.
 *
 * Chaque écart est un avertissement codé, dans `anomalies` ; `ecarts` en est la
 * forme textuelle, dans `langue`.
 *
 * @param {ReadonlyArray<string | { name?: string }>} etiquettes
 * @param {{ domains: ReadonlyMap<string, unknown>, features: ReadonlyMap<string, unknown> }} repo
 * @param {string} [langue]
 */
export function checkPiste(etiquettes, repo, langue = LANGUE_PAR_DEFAUT) {
  if (!estPiste(etiquettes)) return { piste: false, ecarts: [], anomalies: [] };

  const anomalies = [];
  let rattachee = false;
  for (const { etiquette, collection, id } of lireRattachementsPiste(etiquettes)) {
    if (!id) anomalies.push(avertissement('etiquette-piste-sans-identifiant', { etiquette }));
    else if (!repo[collection]?.has(id)) {
      const connus = [...(repo[collection]?.keys() ?? [])].sort();
      anomalies.push(avertissement('etiquette-piste-inconnue', { etiquette, collection, connus }));
    } else rattachee = true;
  }

  if (!rattachee) anomalies.unshift(avertissement('piste-non-rattachee'));

  return { piste: true, ecarts: anomalies.map((a) => formaterAnomalie(a, langue)), anomalies };
}

/** Le commentaire qui signale des écarts, marqueur en tête, dans `langue`. */
export function corpsCommentairePiste(ecarts, langue = LANGUE_PAR_DEFAUT) {
  const dire = (code) => formaterAnomalie({ code, params: {} }, langue);
  return [
    MARQUEUR_PISTE,
    dire('piste-commentaire-titre'),
    '',
    ...ecarts.map((e) => `- ${e}`),
    '',
    dire('piste-commentaire-regle'),
  ].join('\n');
}

/**
 * Ce qu'il faut faire du commentaire de la vérification, d'après les
 * commentaires de l'issue et les écarts trouvés.
 *
 * Un seul commentaire, tenu à jour : le répéter à chaque étiquette posée
 * noierait la discussion. Seul un commentaire d'automate qui commence par le
 * marqueur est le sien — celui d'une personne qui le cite n'est jamais repris.
 *
 * @param {ReadonlyArray<{ id: number, body?: string, user?: { type?: string } }>} commentaires
 * @param {readonly string[]} ecarts
 * @param {string} [langue] celle du commentaire, qui est celle du dépôt
 * @returns {{ action: 'rien' } | { action: 'creer', corps: string }
 *   | { action: 'modifier', id: number, corps: string } | { action: 'supprimer', id: number }}
 */
export function planifierCommentairePiste(commentaires, ecarts, langue = LANGUE_PAR_DEFAUT) {
  const existant = commentaires.find(
    (c) => c.user?.type === 'Bot' && (c.body ?? '').startsWith(MARQUEUR_PISTE),
  );
  if (!ecarts.length) return existant ? { action: 'supprimer', id: existant.id } : { action: 'rien' };

  const corps = corpsCommentairePiste(ecarts, langue);
  if (!existant) return { action: 'creer', corps };
  if (existant.body === corps) return { action: 'rien' };
  return { action: 'modifier', id: existant.id, corps };
}

/**
 * Les étiquettes de rattachement qu'un référentiel attend : une par domaine, puis
 * une par fonctionnalité, dans l'ordre des identifiants.
 *
 * Les identifiants sont ceux que le chargeur a lus dans le frontmatter — les mêmes
 * que la vérification accepte. Les tirer des noms de fichiers créerait, pour un
 * fichier qui ne porte pas le nom de son identifiant, une étiquette que la
 * vérification refuserait.
 *
 * @param {{ domains: ReadonlyMap<string, unknown>, features: ReadonlyMap<string, unknown> }} repo
 */
export function etiquettesRattachementPiste(repo) {
  return RATTACHEMENTS_PISTE.flatMap(({ prefixe, collection }) =>
    [...(repo[collection]?.keys() ?? [])]
      .filter(Boolean)
      .sort()
      .map((id) => `${prefixe}${id}`),
  );
}
