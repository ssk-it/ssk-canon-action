// Corrige, dans les pages produites par le thème par défaut de TypeDoc, ce qui
// les écarte de WCAG 2.2 AA ou du français, sans remplacer le thème.

import { PageEvent } from 'typedoc';

// Le thème place un lien de permalien dans le <summary> de chaque section
// dépliable : un élément interactif dans un autre, que les lecteurs d'écran
// annoncent mal et qu'axe signale (nested-interactive). Le titre garde son
// identifiant, et le sommaire de la page y mène toujours.
const SOMMAIRE = /(<summary\b[^>]*>)([\s\S]*?)(<\/summary>)/g;
const PERMALIEN = /<a href="#[^"]*" aria-label="[^"]*" class="tsd-anchor-icon">[\s\S]*?<\/a>/g;

// `--lang fr` traduit l'interface, mais pas la description de chaque page.
const DESCRIPTION = '<meta name="description" content="Documentation for ';

export function load(app) {
  app.renderer.on(PageEvent.END, (page) => {
    if (!page.contents) return;
    page.contents = page.contents
      .replace(SOMMAIRE, (_, ouverture, corps, fermeture) => ouverture + corps.replace(PERMALIEN, '') + fermeture)
      .replace(DESCRIPTION, '<meta name="description" content="Référence de l’API de ');
  });
}
