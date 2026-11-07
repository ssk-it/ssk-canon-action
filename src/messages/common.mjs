// The messages common to all modules.

export const common = {
  fr: {
    // a message already written by the caller: the library cannot tell it any other way
    message: (p) => p.texte,
    'a-la-livraison': (p, tell) => `à la livraison : ${tell(p.anomalie)}`,
    'langue-inconnue': (p) =>
      `ssk-canon.yml → langue « ${p.valeur} » : attendu ${p.langues.join(' ou ')} — le dépôt se lit en français`,
  },
  en: {
    message: (p) => p.texte,
    'a-la-livraison': (p, tell) => `at delivery: ${tell(p.anomalie)}`,
    'langue-inconnue': (p) =>
      `ssk-canon.yml → langue “${p.valeur}”: expected ${p.langues.join(' or ')} — the repo is read in French`,
  },
};
