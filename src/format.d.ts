import type { Anomalie } from './verifier.js';

/** Un frontmatter lu, ou la raison pour laquelle il ne l'est pas. */
export interface FrontmatterLu<T = Record<string, unknown>> {
  readonly data: T;
  readonly body: string;
}

export interface FrontmatterIllisible {
  /** La forme française de `anomalie`. */
  readonly erreur: string;
  /** `frontmatter-illisible`, ou `frontmatter-deux-points` pour un « : » non quoté. */
  readonly anomalie: Anomalie;
  readonly body: string;
}

/**
 * Retourne `null` si le bloc est absent, `{ erreur }` s'il est présent mais
 * illisible, sans quoi le frontmatter et le corps.
 */
export function splitFrontmatter<T = Record<string, unknown>>(
  texte: string,
): FrontmatterLu<T> | FrontmatterIllisible | null;

/** Énoncés titrés dans la section `## Énoncés`, indexés par identifiant. */
export function extractEnonces(corps: string): Map<string, string>;
