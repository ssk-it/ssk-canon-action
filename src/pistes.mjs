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

/** L'étiquette qui fait d'une issue une piste. */
export const ETIQUETTE_PISTE = 'piste';

/**
 * Les préfixes de rattachement, et ce qu'ils désignent dans un référentiel
 * chargé. Une table, comme les cibles d'un impact : un rattachement ajouté
 * demain hérite des contrôles sans qu'on ait à penser à chacun.
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
 * @param {ReadonlyArray<string | { name?: string }>} etiquettes
 * @param {{ domains: ReadonlyMap<string, unknown>, features: ReadonlyMap<string, unknown> }} repo
 */
export function checkPiste(etiquettes, repo) {
  if (!estPiste(etiquettes)) return { piste: false, ecarts: [] };

  const ecarts = [];
  let rattachee = false;
  for (const { etiquette, collection, id } of lireRattachementsPiste(etiquettes)) {
    const r = RATTACHEMENTS_PISTE.find((r) => r.collection === collection);
    if (!id) ecarts.push(`l'étiquette \`${etiquette}\` est sans identifiant`);
    else if (!repo[collection]?.has(id)) {
      const connus = [...(repo[collection]?.keys() ?? [])].sort().map((k) => `\`${k}\``);
      ecarts.push(
        `l'étiquette \`${etiquette}\` ne désigne ${r.libelle} du référentiel` +
          (connus.length ? ` — ${r.connus} : ${connus.join(', ')}` : ''),
      );
    } else rattachee = true;
  }

  if (!rattachee)
    ecarts.unshift(
      `la piste n'est rattachée à aucun domaine ni aucune fonctionnalité du référentiel : ` +
        `elle n'apparaîtra nulle part — lui ajouter une étiquette \`domaine/<id>\` ou \`fonctionnalite/<id>\``,
    );

  return { piste: true, ecarts };
}

/** Le commentaire qui signale des écarts, marqueur en tête. */
export function corpsCommentairePiste(ecarts) {
  return [
    MARQUEUR_PISTE,
    '**Cette piste est mal rattachée au référentiel.**',
    '',
    ...ecarts.map((e) => `- ${e}`),
    '',
    'Une piste se rattache à au moins un domaine ou une fonctionnalité par des étiquettes ' +
      '`domaine/<id>` et `fonctionnalite/<id>`, où `<id>` est un identifiant de la branche ' +
      'principale du référentiel — RG-piste-rattachee. Ce commentaire se met à jour à chaque ' +
      "modification de l'issue, et disparaît quand le rattachement est juste.",
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
 * @returns {{ action: 'rien' } | { action: 'creer', corps: string }
 *   | { action: 'modifier', id: number, corps: string } | { action: 'supprimer', id: number }}
 */
export function planifierCommentairePiste(commentaires, ecarts) {
  const existant = commentaires.find(
    (c) => c.user?.type === 'Bot' && (c.body ?? '').startsWith(MARQUEUR_PISTE),
  );
  if (!ecarts.length) return existant ? { action: 'supprimer', id: existant.id } : { action: 'rien' };

  const corps = corpsCommentairePiste(ecarts);
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
