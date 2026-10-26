// Les messages communs à tous les modules.

export const commun = {
  fr: {
    // un message déjà rédigé par l'appelant : la bibliothèque ne sait pas le dire autrement
    message: (p) => p.texte,
    'a-la-livraison': (p, dire) => `à la livraison : ${dire(p.anomalie)}`,
    'langue-inconnue': (p) =>
      `ssk-canon.yml → langue « ${p.valeur} » : attendu ${p.langues.join(' ou ')} — le dépôt se lit en français`,
  },
  en: {
    message: (p) => p.texte,
    'a-la-livraison': (p, dire) => `at delivery: ${dire(p.anomalie)}`,
    'langue-inconnue': (p) =>
      `ssk-canon.yml → langue “${p.valeur}”: expected ${p.langues.join(' or ')} — the repo is read in French`,
  },
};
