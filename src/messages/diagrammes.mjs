// The messages of the diagram checks (`diagrammes.mjs`) — scoping 2026-074.

export const diagrammes = {
  fr: {
    'diagramme-illisible': (p) =>
      `${p.source} → diagramme ${p.rang} : Mermaid ne sait pas le lire — ${p.erreur}`,
    'diagramme-entite-html': (p) =>
      `${p.source} → diagramme ${p.rang} : entité HTML « ${p.entite} », affichée telle quelle ou coupant ` +
      `l'instruction — écrire ‹ › pour des chevrons, ou une entité de Mermaid (#60; pour <, #62; pour >)`,
  },
  en: {
    'diagramme-illisible': (p) =>
      `${p.source} → diagram ${p.rang}: Mermaid cannot read it — ${p.erreur}`,
    'diagramme-entite-html': (p) =>
      `${p.source} → diagram ${p.rang}: HTML entity “${p.entite}”, shown as is or cutting the ` +
      `statement — write ‹ › for angle brackets, or a Mermaid entity (#60; for <, #62; for >)`,
  },
};
