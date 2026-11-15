// The messages of the diagram checks (`diagrammes.mjs`) — scoping 2026-074.

export const diagrammes = {
  fr: {
    'diagramme-illisible': (p) =>
      `${p.source} → diagramme ${p.rang} : Mermaid ne sait pas le lire — ${p.erreur}`,
    'diagramme-entite-html': (p) =>
      `${p.source} → diagramme ${p.rang} : entité HTML « ${p.entite} », affichée telle quelle ou coupant ` +
      `l'instruction — écrire ‹ › pour des chevrons, ou une entité de Mermaid (#60; pour <, #62; pour >)`,
    'rattrapage-bloc-lisible': (p) =>
      `${p.source} → diagramme ${p.rang} : il se lisait sur la branche principale — dans un cadrage livré ` +
      `(${p.cadrage}), seul un diagramme fautif se rattrape`,
    'rattrapage-encore-fautif': (p) =>
      `${p.source} → diagramme ${p.rang} : le rattrapage le laisse fautif — ${p.faute}`,
  },
  en: {
    'diagramme-illisible': (p) =>
      `${p.source} → diagram ${p.rang}: Mermaid cannot read it — ${p.erreur}`,
    'diagramme-entite-html': (p) =>
      `${p.source} → diagram ${p.rang}: HTML entity “${p.entite}”, shown as is or cutting the ` +
      `statement — write ‹ › for angle brackets, or a Mermaid entity (#60; for <, #62; for >)`,
    'rattrapage-bloc-lisible': (p) =>
      `${p.source} → diagram ${p.rang}: it read on the main branch — in a delivered scoping ` +
      `(${p.cadrage}), only a faulty diagram may be caught up`,
    'rattrapage-encore-fautif': (p) =>
      `${p.source} → diagram ${p.rang}: the catch-up leaves it faulty — ${p.faute}`,
  },
};
