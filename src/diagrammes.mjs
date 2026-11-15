// The diagrams of a specification — RG-verification-integrite, scoping 2026-074.
//
// A Mermaid block that the renderer cannot read, or that carries an HTML
// entity, used to pass the check and only showed up when Skanon displayed it,
// in place of the drawing. A delivered scoping no longer changes: the error is
// refused here, while it can still be fixed.
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
 * Blocks in a scoping not yet delivered — the one under review —, and only
 * there: what would stay wrong once delivered. A delivered scoping no longer
 * changes, and the document it projected only changes when another scoping is
 * merged; blocking on them would refuse every pull request of the repo, the one
 * that fixes them included. They are reported as warnings.
 */
function gravite(diagramme, livres) {
  return diagramme.cadrage && !livres.has(diagramme.cadrage) ? createError : createWarning;
}

/** The HTML entities in diagrams, checked without a renderer. */
export function verifierEntites(repo, { livres = new Set() } = {}) {
  const anomalies = [];
  for (const d of extraireDiagrammes(repo)) {
    const trouve = d.texte.match(ENTITE);
    if (trouve)
      anomalies.push(gravite(d, livres)('diagramme-entite-html', { source: d.source, rang: d.rang, entite: trouve[0] }));
  }
  return anomalies;
}

/**
 * The diagrams the given parser refuses. `analyser(texte)` resolves for a
 * readable diagram and rejects otherwise, with the renderer's message. Without
 * a parser, nothing is checked: a caller that has none says nothing rather
 * than a guess. Every block is parsed, so that one run tells every fault.
 *
 * `livres` carries the delivered scopings, as for `checkRepo`: only a block of
 * a scoping under review is an error.
 *
 * @param {{analyser?: (texte: string) => Promise<unknown>, livres?: Set<string>}} [options]
 */
export async function verifierDiagrammes(repo, { analyser, livres = new Set() } = {}) {
  if (!analyser) return [];
  const anomalies = [];
  for (const d of extraireDiagrammes(repo)) {
    try {
      await analyser(d.texte);
    } catch (e) {
      // The first line of the renderer's message says the line at fault; the
      // rest is a caret drawing and a list of expected tokens.
      const erreur = String(e?.message ?? e).split('\n')[0].trim();
      anomalies.push(gravite(d, livres)('diagramme-illisible', { source: d.source, rang: d.rang, erreur }));
    }
  }
  return anomalies;
}

// --- the catch-up of a faulty diagram in a delivered scoping — scoping 2026-076 ---

/**
 * The blocks that changed between two versions of a file, when nothing else
 * did: same text outside the blocks, same number of blocks. Returns `null`
 * otherwise — the change is then a modification of the file, not a retouch of
 * its diagrams (RG-cadrage-livre-immuable).
 *
 * @returns {{rang: number, avant: string, apres: string}[] | null}
 */
export function comparerBlocs(avant, apres) {
  const decouper = (texte) => {
    const blocs = [];
    const gabarit = String(texte ?? '').replace(BLOC, (tout, contenu) => {
      blocs.push(contenu.replace(/\n$/, ''));
      const debut = tout.indexOf('\n') + 1;
      return tout.slice(0, debut) + '\u0000\n' + tout.slice(debut + contenu.length);
    });
    return { gabarit, blocs };
  };
  const a = decouper(avant);
  const b = decouper(apres);
  if (a.gabarit !== b.gabarit || a.blocs.length !== b.blocs.length) return null;
  return a.blocs.flatMap((texte, i) =>
    texte === b.blocs[i] ? [] : [{ rang: i + 1, avant: texte, apres: b.blocs[i] }]);
}

/**
 * Judges the retouched blocks of a catch-up: each must have been faulty, and
 * must no longer be. Faulty means carrying an HTML entity, or refused by the
 * given parser. Without a parser, only the entities are judged: a block
 * without one, before or after, is left to the step that has the parser.
 *
 * @param {{cadrage: string, chemin: string, rang: number, avant: string, apres: string}[]} retouches
 * @param {{analyser?: (texte: string) => Promise<unknown>}} [options]
 */
export async function jugerRetouches(retouches, { analyser } = {}) {
  const faute = async (texte) => {
    const entite = texte.match(ENTITE);
    if (entite) return entite[0];
    if (!analyser) return null;
    try {
      await analyser(texte);
      return null;
    } catch (e) {
      return String(e?.message ?? e).split('\n')[0].trim();
    }
  };
  const anomalies = [];
  for (const r of retouches) {
    const params = { cadrage: r.cadrage, source: r.chemin, rang: r.rang };
    const avant = await faute(r.avant);
    // Without a parser, a block with no entity before cannot be told faulty
    // or readable: the judgement is left to the step that has one.
    if (avant === null && analyser) anomalies.push(createError('rattrapage-bloc-lisible', params));
    const apres = await faute(r.apres);
    if (apres !== null) anomalies.push(createError('rattrapage-encore-fautif', { ...params, faute: apres }));
  }
  return anomalies;
}

/**
 * The entities a catch-up leaves in its retouched blocks — what can be judged
 * without a parser, synchronously, by the check itself.
 */
export function jugerEntitesDesRetouches(retouches) {
  return retouches.flatMap((r) => {
    const entite = r.apres.match(ENTITE);
    return entite
      ? [createError('rattrapage-encore-fautif', { cadrage: r.cadrage, source: r.chemin, rang: r.rang, faute: entite[0] })]
      : [];
  });
}
