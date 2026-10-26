// Les messages de la vérification d'un référentiel chargé (`verifier.mjs`).

/** Le mot qui nomme une nature de cible, dans chaque langue. */
const NATURE = {
  fr: { regle: 'règle', adr: "décision d'architecture", architecture: "document d'architecture" },
  en: { regle: 'rule', adr: 'architecture decision', architecture: 'architecture document' },
};

/** Ce qui porte un domaine inconnu. */
const SOURCE = {
  fr: { fonctionnalite: 'fonctionnalité', cadrage: 'cadrage' },
  en: { fonctionnalite: 'feature', cadrage: 'scoping' },
};

export const verification = {
  fr: {
    'prefixe-invalide': (p) =>
      `ssk-canon.yml → prefixe « ${p.prefixe} » : attendu des lettres, chiffres ou « _ », ` +
      `commençant par une lettre`,
    'identifiant-manquant': (p) => `${p.chemin} : identifiant manquant`,
    'fonctionnalite-sans-domaine': (p) => `fonctionnalité ${p.id} : rattachée à aucun domaine`,
    'domaine-inconnu': (p) => `${SOURCE.fr[p.source]} ${p.id} → domaine inconnu : ${p.domaine}`,
    'statut-regle-invalide': (p) => `règle ${p.regle} : statut invalide « ${p.statut} »`,
    'regle-sans-fonctionnalite': (p) =>
      `règle ${p.regle} : rattachée à aucune fonctionnalité — introuvable dans le référentiel`,
    'fonctionnalite-inconnue': (p) => `règle ${p.regle} → fonctionnalité inconnue : ${p.fonctionnalite}`,
    'cree-par-inconnu': (p) => `règle ${p.regle} → cree_par pointe un cadrage inconnu : ${p.cadrage}`,
    'modifie-par-inconnu': (p) => `règle ${p.regle} → modifie_par pointe un cadrage inconnu : ${p.cadrage}`,
    'statut-declare': (p) =>
      `cadrage ${p.cadrage} : le statut ne se déclare pas, il se déduit de l'état du dépôt`,
    'impact-sans-cible': (p) =>
      `cadrage ${p.cadrage} → impact sans cible : attendu l'un de ${p.champs.join(', ')}`,
    'operation-invalide': (p) => `cadrage ${p.cadrage} → opération invalide « ${p.operation} » sur ${p.cible}`,
    'impact-en-double': (p) => `cadrage ${p.cadrage} → impact en double sur la ${NATURE.fr[p.nature]} ${p.cible}`,
    'cible-inconnue': (p) => `cadrage ${p.cadrage} → ${NATURE.fr[p.nature]} inconnue : ${p.cible}`,
    'enonce-manquant': (p) =>
      `cadrage ${p.cadrage} → impact « ${p.operation} » sur ${p.cible} sans énoncé correspondant dans « ## Énoncés »`,
    'enonce-sans-impact': (p) => `cadrage ${p.cadrage} : énoncé pour ${p.cible} sans impact déclaré`,
    'piece-jointe-empreinte': (p) =>
      `cadrage ${p.cadrage} → pièce jointe « ${p.nom} » : sha256 absent ou mal formé`,
    'cible-jamais-creee': (p) => `${NATURE.fr[p.nature]} ${p.id} : aucun cadrage livré ne la crée`,
    'cree-par-diverge': (p) =>
      `${NATURE.fr[p.nature]} ${p.id} : cree_par vaut « ${p.declare ?? '—'} » mais les impacts livrés disent « ${p.derive ?? '—'} »`,
    'modifie-par-diverge': (p) =>
      `${NATURE.fr[p.nature]} ${p.id} : modifie_par vaut ${JSON.stringify(p.declare)} mais les impacts livrés disent ${JSON.stringify(p.derive)}`,
    'abrogee-sans-cadrage': (p) => `règle ${p.regle} : abrogée sans cadrage responsable`,
    'abrogee-par-non-livre': (p) => `règle ${p.regle} : abrogée par ${p.cadrage}, qui n'est pas livré`,
    'opere-sur-abrogee': (p) => `cadrage ${p.cadrage} : opère sur ${p.cible}, qui est abrogée`,
  },
  en: {
    'prefixe-invalide': (p) =>
      `ssk-canon.yml → prefixe “${p.prefixe}”: expected letters, digits or “_”, starting with a letter`,
    'identifiant-manquant': (p) => `${p.chemin}: missing identifier`,
    'fonctionnalite-sans-domaine': (p) => `feature ${p.id}: attached to no domain`,
    'domaine-inconnu': (p) => `${SOURCE.en[p.source]} ${p.id} → unknown domain: ${p.domaine}`,
    'statut-regle-invalide': (p) => `rule ${p.regle}: invalid status “${p.statut}”`,
    'regle-sans-fonctionnalite': (p) =>
      `rule ${p.regle}: attached to no feature — it cannot be found in the specification`,
    'fonctionnalite-inconnue': (p) => `rule ${p.regle} → unknown feature: ${p.fonctionnalite}`,
    'cree-par-inconnu': (p) => `rule ${p.regle} → cree_par points to an unknown scoping: ${p.cadrage}`,
    'modifie-par-inconnu': (p) => `rule ${p.regle} → modifie_par points to an unknown scoping: ${p.cadrage}`,
    'statut-declare': (p) =>
      `scoping ${p.cadrage}: the status is not declared, it derives from the repo state`,
    'impact-sans-cible': (p) =>
      `scoping ${p.cadrage} → impact without a target: expected one of ${p.champs.join(', ')}`,
    'operation-invalide': (p) => `scoping ${p.cadrage} → invalid operation “${p.operation}” on ${p.cible}`,
    'impact-en-double': (p) => `scoping ${p.cadrage} → duplicate impact on the ${NATURE.en[p.nature]} ${p.cible}`,
    'cible-inconnue': (p) => `scoping ${p.cadrage} → unknown ${NATURE.en[p.nature]}: ${p.cible}`,
    'enonce-manquant': (p) =>
      `scoping ${p.cadrage} → “${p.operation}” impact on ${p.cible} without a matching statement in “## Énoncés”`,
    'enonce-sans-impact': (p) => `scoping ${p.cadrage}: statement for ${p.cible} without a declared impact`,
    'piece-jointe-empreinte': (p) =>
      `scoping ${p.cadrage} → attachment “${p.nom}”: sha256 missing or malformed`,
    'cible-jamais-creee': (p) => `${NATURE.en[p.nature]} ${p.id}: no delivered scoping creates it`,
    'cree-par-diverge': (p) =>
      `${NATURE.en[p.nature]} ${p.id}: cree_par is “${p.declare ?? '—'}” but the delivered impacts say “${p.derive ?? '—'}”`,
    'modifie-par-diverge': (p) =>
      `${NATURE.en[p.nature]} ${p.id}: modifie_par is ${JSON.stringify(p.declare)} but the delivered impacts say ${JSON.stringify(p.derive)}`,
    'abrogee-sans-cadrage': (p) => `rule ${p.regle}: repealed without a responsible scoping`,
    'abrogee-par-non-livre': (p) => `rule ${p.regle}: repealed by ${p.cadrage}, which is not delivered`,
    'opere-sur-abrogee': (p) => `scoping ${p.cadrage}: operates on ${p.cible}, which is repealed`,
  },
};
