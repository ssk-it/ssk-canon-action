// Fixes, in the pages produced by TypeDoc's default theme, what keeps them from
// WCAG 2.2 AA or from French, without replacing the theme.

import { PageEvent } from 'typedoc';

// The theme puts a permalink in the <summary> of each collapsible section: an
// interactive element inside another, which screen readers announce badly and
// which axe reports (nested-interactive). The heading keeps its identifier, and
// the page's table of contents still leads to it.
const SUMMARY = /(<summary\b[^>]*>)([\s\S]*?)(<\/summary>)/g;
const PERMALINK = /<a href="#[^"]*" aria-label="[^"]*" class="tsd-anchor-icon">[\s\S]*?<\/a>/g;

// `--lang fr` translates the interface, but not each page's description.
const DESCRIPTION = '<meta name="description" content="Documentation for ';

export function load(app) {
  app.renderer.on(PageEvent.END, (page) => {
    if (!page.contents) return;
    page.contents = page.contents
      .replace(SUMMARY, (_, opening, body, closing) => opening + body.replace(PERMALINK, '') + closing)
      .replace(DESCRIPTION, '<meta name="description" content="Référence de l’API de ');
  });
}
