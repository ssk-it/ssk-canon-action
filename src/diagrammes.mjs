// The diagrams of a specification — RG-verification-integrite, scoping 2026-074.
//
// A Mermaid block that the renderer cannot read, or that carries an HTML
// entity, used to pass the check and only showed up when Skanon displayed it,
// in place of the drawing. A delivered scoping no longer changes: the error is
// refused here, while it can still be fixed, and no longer reported after.
//
// The library knows where diagrams are and what is wrong with them; it does
// not carry the renderer, which depends on the medium. The caller gives the
// parser — Mermaid under jsdom for the Action, the one Skanon already loads in
// the browser —, the same engine, at the same version, as the one that draws.

import { createError, createWarning } from './anomalies.mjs';

// A fenced block, at the start of a line: an indented sample of Markdown that
// shows a block is not one.
const BLOC = /^```mermaid[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;

// An HTML entity is shown as is, or escaped a second time; its « ; » ends the
// statement of a sequence diagram. Mermaid's own codes (#60;) are not entities.
const ENTITE = /&(?:[A-Za-z][A-Za-z0-9]*|#[0-9]+|#x[0-9A-Fa-f]+);/;

function blocsDe(body) {
  return [...String(body ?? '').matchAll(BLOC)].map((m) => m[1].replace(/\n$/, ''));
}

/**
 * The Mermaid blocks of a loaded specification: rules, architecture
 * decisions and documents, scopings and their decisions. Each says where it
 * comes from and its rank there, from 1, as an author counts them; a block of
 * a scoping, or of one of its decisions, also names that scoping.
 *
 * @returns {{source: string, rang: number, texte: string, cadrage?: string}[]}
 */
export function extraireDiagrammes(repo) {
  const diagrammes = [];
  const ajouter = (source, body, cadrage) =>
    blocsDe(body).forEach((texte, i) =>
      diagrammes.push({ source, rang: i + 1, texte, ...(cadrage ? { cadrage } : {}) }));

  for (const collection of ['rules', 'decisions', 'architecture'])
    for (const [id, e] of repo[collection] ?? []) ajouter(e.path ?? id, e.body);

  for (const [id, c] of repo.cadrages ?? []) {
    const source = c.path ?? id;
    // A scoping read from a file carries its body; a scoping being written, in
    // Skanon, its statements indexed by target — as `checkRepo` accepts both.
    if (c.body === undefined && c.enonces instanceof Map)
      for (const [cible, texte] of c.enonces) ajouter(`${source} → ${cible}`, texte, id);
    else ajouter(source, c.body, id);
    for (const d of c.decisions ?? []) ajouter(`${source} — ${d.id}`, d.body, id);
  }
  return diagrammes;
}

/**
 * The blocks the check looks at: all but those of a delivered scoping. A
 * delivered scoping no longer changes (RG-cadrage-livre-immuable): nothing can
 * fix its diagram, and a warning that leads nowhere would be read once, then
 * ignored, along with the ones that lead somewhere. Scoping 2026-075.
 */
function aVerifier(repo, livres) {
  return extraireDiagrammes(repo).filter((d) => !(d.cadrage && livres.has(d.cadrage)));
}

/**
 * A block in a scoping not yet delivered — the one under review — is an error:
 * what would stay wrong once delivered. The document a scoping projected only
 * changes when another scoping is merged; blocking on it would refuse every
 * pull request of the repo, the one that fixes it included. It is a warning.
 */
function gravite(diagramme) {
  return diagramme.cadrage ? createError : createWarning;
}

/** The HTML entities in diagrams, checked without a renderer. */
export function verifierEntites(repo, { livres = new Set() } = {}) {
  const anomalies = [];
  for (const d of aVerifier(repo, livres)) {
    const trouve = d.texte.match(ENTITE);
    if (trouve)
      anomalies.push(gravite(d)('diagramme-entite-html', { source: d.source, rang: d.rang, entite: trouve[0] }));
  }
  return anomalies;
}

/**
 * The diagrams the given parser refuses. `analyser(texte)` resolves for a
 * readable diagram and rejects otherwise, with the renderer's message. Without
 * a parser, nothing is checked: a caller that has none says nothing rather
 * than a guess. Every block is parsed, so that one run tells every fault.
 *
 * `livres` carries the delivered scopings, as for `checkRepo`: their blocks
 * are not parsed, and only a block of a scoping under review is an error.
 *
 * @param {{analyser?: (texte: string) => Promise<unknown>, livres?: Set<string>}} [options]
 */
export async function verifierDiagrammes(repo, { analyser, livres = new Set() } = {}) {
  if (!analyser) return [];
  const anomalies = [];
  for (const d of aVerifier(repo, livres)) {
    try {
      await analyser(d.texte);
    } catch (e) {
      // The first line of the renderer's message says the line at fault; the
      // rest is a caret drawing and a list of expected tokens.
      const erreur = String(e?.message ?? e).split('\n')[0].trim();
      anomalies.push(gravite(d)('diagramme-illisible', { source: d.source, rang: d.rang, erreur }));
    }
  }
  return anomalies;
}
