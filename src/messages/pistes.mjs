// Les messages des pistes (`pistes.mjs`, `verifier-piste.mjs`, `etiquettes-pistes.mjs`).

/** Ce que désigne une collection de rattachement, et ce qu'elle connaît, dans chaque langue. */
const COLLECTION = {
  fr: {
    domains: { aucun: 'aucun domaine', connus: 'domaines connus' },
    features: { aucun: 'aucune fonctionnalité', connus: 'fonctionnalités connues' },
  },
  en: {
    domains: { aucun: 'no domain', connus: 'known domains' },
    features: { aucun: 'no feature', connus: 'known features' },
  },
};

const enCode = (ids) => ids.map((id) => `\`${id}\``).join(', ');

/** Ce qu'il advient du commentaire, dit dans le journal en anglais. */
const ACTION_EN = { rien: 'none', creer: 'created', modifier: 'updated', supprimer: 'deleted' };

export const pistes = {
  fr: {
    'piste-non-rattachee': () =>
      `la piste n'est rattachée à aucun domaine ni aucune fonctionnalité du référentiel : ` +
      `elle n'apparaîtra nulle part — lui ajouter une étiquette \`domaine/<id>\` ou \`fonctionnalite/<id>\``,
    'etiquette-piste-sans-identifiant': (p) => `l'étiquette \`${p.etiquette}\` est sans identifiant`,
    'etiquette-piste-inconnue': (p) =>
      `l'étiquette \`${p.etiquette}\` ne désigne ${COLLECTION.fr[p.collection].aucun} du référentiel` +
      (p.connus.length ? ` — ${COLLECTION.fr[p.collection].connus} : ${enCode(p.connus)}` : ''),

    // Le commentaire sur l'issue.
    'piste-commentaire-titre': () => '**Cette piste est mal rattachée au référentiel.**',
    'piste-commentaire-regle': () =>
      'Une piste se rattache à au moins un domaine ou une fonctionnalité par des étiquettes ' +
      '`domaine/<id>` et `fonctionnalite/<id>`, où `<id>` est un identifiant de la branche ' +
      'principale du référentiel — RG-piste-rattachee. Ce commentaire se met à jour à chaque ' +
      "modification de l'issue, et disparaît quand le rattachement est juste.",

    // Le journal de la vérification.
    'piste-sans-issue': () => 'Aucune issue dans cet événement : rien à vérifier.',
    'piste-pas-une-piste': (p) => `Issue #${p.numero} : pas une piste.`,
    'piste-commentaire-action': (p) => `Commentaire : ${p.action}.`,
    'piste-ecarts': (p) => `${p.nombre} écart(s) de rattachement`,
    'piste-aucun-ecart': () => 'aucun écart de rattachement',

    // Les étiquettes à créer.
    'piste-referentiel-vide': (p) => `${p.racine} : ni domaine ni fonctionnalité — est-ce un référentiel ?`,
  },
  en: {
    'piste-non-rattachee': () =>
      `the roadmap item is linked to no domain and no feature of the specification: ` +
      `it will appear nowhere — add a \`domaine/<id>\` or \`fonctionnalite/<id>\` label to it`,
    'etiquette-piste-sans-identifiant': (p) => `the label \`${p.etiquette}\` has no identifier`,
    'etiquette-piste-inconnue': (p) =>
      `the label \`${p.etiquette}\` designates ${COLLECTION.en[p.collection].aucun} of the specification` +
      (p.connus.length ? ` — ${COLLECTION.en[p.collection].connus}: ${enCode(p.connus)}` : ''),

    'piste-commentaire-titre': () => '**This roadmap item is not properly linked to the specification.**',
    'piste-commentaire-regle': () =>
      'A roadmap item is linked to at least one domain or feature by `domaine/<id>` and ' +
      '`fonctionnalite/<id>` labels, where `<id>` is an identifier on the main branch of the ' +
      'specification — RG-piste-rattachee. This comment is updated whenever the issue changes, ' +
      'and disappears once the linking is right.',

    'piste-sans-issue': () => 'No issue in this event: nothing to check.',
    'piste-pas-une-piste': (p) => `Issue #${p.numero}: not a roadmap item.`,
    'piste-commentaire-action': (p) => `Comment: ${ACTION_EN[p.action] ?? p.action}.`,
    'piste-ecarts': (p) => `${p.nombre} linking gap(s)`,
    'piste-aucun-ecart': () => 'no linking gap',

    'piste-referentiel-vide': (p) => `${p.racine}: no domain and no feature — is this a specification?`,
  },
};
