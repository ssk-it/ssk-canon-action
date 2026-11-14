// Mermaid under jsdom: the parser the Action gives the library — scoping
// 2026-074, decision 02. Mermaid only runs with a DOM, which Node does not
// have; Skanon, in the browser, gives its own.
//
// The version is Skanon's (package.json): a check that accepts what the
// display refuses would be worse than no check. It lives apart from the
// library's dependencies (decision 04), so that whoever installs the library —
// Skanon first — does not receive a second engine.

import { JSDOM } from 'jsdom';

/** A parser: resolves for a readable diagram, rejects with Mermaid's message otherwise. */
export async function creerAnalyseur() {
  const { window } = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window ??= window;
  globalThis.document ??= window.document;
  const { default: mermaid } = await import('mermaid');
  // The strictest level, as for display — ADR-langage-de-diagramme.
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  return (texte) => mermaid.parse(texte);
}
