// Declarations for `citations.mjs` — RG-regle-du-socle-citee,
// RG-citation-signalee-chez-le-citant, RG-prefixe-projet.

/**
 * Citing another specification: parsing, prefix resolution, state of each citation. Re-exported at the package root.
 *
 * @module @ssk-it/canon-check/citations
 */
import type { Anomalie } from './verifier.js';

/** A project prefix: letters, digits or « _ », starting with a letter. */
export declare const FORME_PREFIXE: RegExp;

/** A parsed citation: `<prefixe>:<id>@<cadrage>`, the scoping being the cited specification's. */
export interface Citation {
  readonly prefixe: string;
  readonly id: string;
  readonly cadrage: string;
}

/** A parsed citation, or `null` if it does not follow the pattern. */
export function lireCitation(text: unknown): Citation | null;

/** Compares two scoping identifiers, by year then by number. */
export function comparerCadrages(a: string, b: string): number;

/**
 * The specifications the project cites — `referentiels_cites` in `ssk-canon.yml`
 * —, by prefix. A faulty entry is set aside, and warned about.
 */
export function referentielsCites(config: unknown): {
  cites: Map<string, string>;
  anomalies: Anomalie[];
};

/** What a prefix designates: the project, a specification it cites, or an unknown address. */
export function resoudrePrefixe(
  prefix: string,
  config: unknown,
): { nature: 'projet' } | { nature: 'cite'; repo: string } | { nature: 'inconnue' };

/** A loaded cited specification: its rules, and its architecture decisions if it has any. */
export interface ReferentielCite {
  readonly rules: ReadonlyMap<string, unknown>;
  readonly decisions?: ReadonlyMap<string, unknown>;
}

export interface OptionsCitations {
  /**
   * By prefix, the cited specification already loaded, or `null` if it could
   * not be. A missing prefix was not read: its citations are unchecked.
   */
  readonly cites?: ReadonlyMap<string, ReferentielCite | null>;
}

export type EtatCitation =
  | 'a-jour'
  | 'perimee'
  | 'abrogee'
  | 'absente'
  | 'non-verifiee'
  | 'prefixe-inconnu'
  | 'mal-formee';

/** A citation and what the check says about it. */
export interface EtatDeCitation {
  /** The identifier of the rule or architecture decision that cites. */
  readonly source: string;
  readonly nature: 'regle' | 'adr';
  /** The citation as written in `applique`. */
  readonly texte: string;
  /** `null` when it is malformed. */
  readonly citation: Citation | null;
  readonly etat: EtatCitation;
  /** The cited repo; `null` when the prefix is the project's; absent if the prefix does not resolve. */
  readonly repo?: string | null;
  /** `perimee`: the cited specification's scopings later than the noted one. */
  readonly recents?: readonly string[];
  /** `abrogee`: the scoping that repealed it, if known. */
  readonly cadrage?: string | null;
}

/** The state of each citation, in the order of rules then architecture decisions. */
export function etatDesCitations(
  repo: { readonly config?: unknown; readonly rules: ReadonlyMap<string, unknown>; readonly decisions?: ReadonlyMap<string, unknown> },
  options?: OptionsCitations,
): EtatDeCitation[];

/**
 * The state of a citation against its target alone, read in the cited specification:
 * `null` if it cannot be found, `lu: false` if the specification could not be read.
 */
export function etatDeCible(
  citation: Pick<Citation, 'cadrage'>,
  target: { readonly statut?: string; readonly modifie_par?: readonly string[] } | null | undefined,
  options?: { readonly lu?: boolean },
): {
  etat: 'a-jour' | 'perimee' | 'abrogee' | 'absente' | 'non-verifiee';
  recents?: string[];
  cadrage?: string | null;
};

/** The warnings of the citations, and of the declaration of cited specifications. Never an error. */
export function verifierCitations(
  repo: { readonly config?: unknown; readonly rules: ReadonlyMap<string, unknown>; readonly decisions?: ReadonlyMap<string, unknown> },
  options?: OptionsCitations,
): Anomalie[];
