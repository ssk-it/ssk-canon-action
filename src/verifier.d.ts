// Declarations for TypeScript consumers.
//
// Written by hand rather than generated: the module is in JavaScript, and
// compiling it from TypeScript would add a build step to a package that has
// none. Its surface is narrow and stable.

/**
 * The integrity check of a loaded specification, and the rendering of its anomalies as text, in French or in English.
 *
 * @module @ssk-it/canon-check
 */
import type { FichierIdentite } from './identite.js';
import type { ReferentielCite } from './citations.js';

export * from './identite.js';
export * from './noms.js';
export * from './citations.js';

/** The languages in which an anomaly is said — RG-anomalies-codees. */
export type Langue = 'fr' | 'en';
export declare const LANGUES: readonly Langue[];

/**
 * An anomaly of the format: a stable code, a severity, and parameters —
 * values of the specification and of the format, never translated. Its message
 * is derived from the code, in each language, by `formaterAnomalie`.
 */
export interface Anomalie {
  readonly code: string;
  readonly gravite: 'erreur' | 'avertissement';
  readonly params: Readonly<Record<string, unknown>>;
}

/** The message of an anomaly in a language; an unknown language reads as French. */
export function formaterAnomalie(anomaly: Anomalie, language?: string): string;

/** The anomalies as texts, errors and warnings separated. */
export function enTexte(
  anomalies: readonly Anomalie[],
  language?: string,
): { errors: string[]; warnings: string[] };

/** The language the repo declares in `ssk-canon.yml` — RG-langue-du-depot. */
export function langueDuDepot(config: unknown): {
  langue: Langue;
  anomalies: Anomalie[];
};

/** A loaded specification, whatever its origin. */
export interface RepoVerifiable {
  /**
   * The project configuration, as `ssk-canon.yml` carries it.
   *
   * When absent, nothing that depends on it is checked: a specification
   * checked outside its repo remains checkable.
   */
  readonly config?: {
    readonly projet?: { readonly prefixe?: string };
    /** The repo's language — RG-langue-du-depot. */
    readonly langue?: unknown;
    /** The declared names — RG-noms-declares. */
    readonly dossiers?: unknown;
    readonly fichiers?: unknown;
    /** The cited specifications, `{ prefixe, repo }` — RG-regle-du-socle-citee. */
    readonly referentiels_cites?: unknown;
  } | null;
  readonly domains: ReadonlyMap<string, unknown>;
  readonly features: ReadonlyMap<string, unknown>;
  readonly rules: ReadonlyMap<string, unknown>;
  /**
   * The architecture targets, when the specification carries any.
   *
   * When absent, they read as empty: any impact targeting them would then be
   * reported as unknown, whereas it is the collection that is missing.
   */
  readonly decisions?: ReadonlyMap<string, unknown>;
  readonly architecture?: ReadonlyMap<string, unknown>;
  readonly cadrages: ReadonlyMap<string, unknown>;
  /**
   * The files of the `identite/` directory, with their size.
   *
   * When absent, the identity is not checked; an empty array says there are
   * none.
   */
  readonly identite?: readonly FichierIdentite[];
  /**
   * The repo's files, relative to its root, separated by « / ».
   *
   * When present, they reveal a declared folder that cannot be found while the
   * one bearing the format's name still exists; when absent, this check does not
   * take place.
   */
  readonly chemins?: readonly string[];
  /** Errors already met on loading: a text is taken as is, a coded anomaly is said in each language. */
  readonly errors?: readonly (string | Anomalie)[];
  /** The same, coded by the loading: preferred to `errors` when present. */
  readonly anomalies?: readonly Anomalie[];
}

export interface ResultatVerification {
  /** In French, word for word the form from before codes. */
  readonly errors: string[];
  readonly warnings: string[];
  /** The same, coded, in order: what an interface says in its language. */
  readonly anomalies: Anomalie[];
  readonly counts: {
    readonly domaines: number;
    readonly fonctionnalites: number;
    readonly regles: number;
    readonly cadrages: number;
  };
}

export interface OptionsVerification {
  /**
   * Skips the checks on `cree_par` and `modifie_par`.
   *
   * These fields are written by the propagation: requiring them correct
   * before it would make any desynchronisation impossible to fix.
   */
  readonly ignorerIndexDerives?: boolean;
  /**
   * The scopings considered delivered.
   *
   * A scoping does not declare its status: it is deduced from the repo's
   * state, which only the caller knows how to read — the main branch for the
   * Action, the platform for the browser.
   */
  readonly livres?: ReadonlySet<string>;
  /**
   * The cited specifications, by prefix, already loaded — or `null` for those
   * that could not be. What the caller has not read makes its citations
   * unchecked: warnings, never errors.
   */
  readonly cites?: ReadonlyMap<string, ReferentielCite | null>;
}

export function checkRepo(
  repo: RepoVerifiable,
  options?: OptionsVerification,
): ResultatVerification;
