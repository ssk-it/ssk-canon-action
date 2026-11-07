// Reading the format, with no dependency on the file system.
//
// This module runs both in the Action, which reads a directory, and in a
// browser, which reads a remote repo. That is what lets the two share a single
// implementation of the format's rules — duplicating them would guarantee that
// they diverge.
//
// Everything that touches the disk lives in `parse.mjs`, which builds on this one.

import { load } from 'js-yaml';
import { createError, formaterAnomalie } from './anomalies.mjs';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Splits the YAML frontmatter from the Markdown body.
 *
 * Returns `null` if the block is missing, and `{ erreur, anomalie }` if it is
 * present but unreadable: the coded anomaly — RG-anomalies-codees —, and its
 * French form, which the interface still reads. The two cases are distinct: the first says the file is
 * not an entity, the second that it is one and that it is broken.
 *
 * The error is never propagated as is. An exception from the YAML library
 * would bubble up to the top and print a stack trace, in which the reader
 * would search in vain for which file to fix.
 */
export function splitFrontmatter(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return null;
  try {
    return { data: load(m[1]) ?? {}, body: m[2] };
  } catch (e) {
    const anomaly = yamlAnomaly(e);
    return { erreur: formaterAnomalie(anomaly, 'fr'), anomalie: anomaly, body: m[2] };
  }
}

/**
 * The anomaly of a YAML library error.
 *
 * It carries the faulty line and column in `mark`, but its `message` also
 * embeds a multi-line excerpt of the document which, copied into a list of
 * errors, makes it unreadable. We keep the first line and the coordinates,
 * which are enough to find the exact spot.
 */
function yamlAnomaly(e) {
  // The reason stays the library's, in English: it is a value we quote, not a
  // message we write.
  const reason = String(e?.reason ?? e?.message ?? e).split('\n')[0].trim();
  const l = e?.mark?.line;
  // `line` is zero-based and relative to the block: the opening `---` shifts
  // it by one more line to get the line number in the file.
  const params = { ligne: typeof l === 'number' ? l + 2 : null, raison: reason };

  // By far the most frequent cause, and one the original message says nothing
  // about: a `:` followed by a space in an unquoted value, which YAML reads as a
  // separator. A decision title almost always contains one.
  if (/bad indentation of a mapping entry/.test(reason)) return createError('frontmatter-deux-points', params);
  return createError('frontmatter-illisible', params);
}

/** Extracts the rule identifiers titled in the `## Énoncés` section. */
export function extractEnonces(body) {
  const section = /^##[ \t]+Énoncés[ \t]*$([\s\S]*?)(?=^##[ \t]|$(?![\s\S]))/m.exec(body);
  if (!section) return new Map();
  const out = new Map();
  const re = /^###[ \t]+(\S+)[ \t]*$([\s\S]*?)(?=^###[ \t]|$(?![\s\S]))/gm;
  for (const m of section[1].matchAll(re)) out.set(m[1], m[2].trim());
  return out;
}
