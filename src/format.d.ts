/**
 * Splitting the frontmatter and extracting the statements, to build a specification from Markdown files.
 *
 * @module @ssk-it/canon-check/format
 */
import type { Anomalie } from './verifier.js';

/** A frontmatter that was read, or the reason it could not be. */
export interface FrontmatterLu<T = Record<string, unknown>> {
  readonly data: T;
  readonly body: string;
}

export interface FrontmatterIllisible {
  /** The French form of `anomalie`. */
  readonly erreur: string;
  /** `frontmatter-illisible`, or `frontmatter-deux-points` for an unquoted “:”. */
  readonly anomalie: Anomalie;
  readonly body: string;
}

/**
 * Returns `null` if the block is missing, `{ erreur }` if it is present but
 * unreadable, otherwise the frontmatter and the body.
 */
export function splitFrontmatter<T = Record<string, unknown>>(
  text: string,
): FrontmatterLu<T> | FrontmatterIllisible | null;

/** Statements titled in the `## Énoncés` section, keyed by identifier. */
export function extractEnonces(body: string): Map<string, string>;
