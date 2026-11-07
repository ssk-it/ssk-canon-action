/**
 * Resolving the names a specification declares in `ssk-canon.yml` (RG-noms-declares). Re-exported at the package root.
 *
 * @module @ssk-it/canon-check/noms
 */
import type { Anomalie } from './verifier.js';

/** The keys of the `dossiers` block of `ssk-canon.yml`. */
export type CleDossier =
  | 'domaines'
  | 'fonctionnalites'
  | 'regles'
  | 'cadrages'
  | 'decisions'
  | 'architecture'
  | 'identite'
  | 'decisions_cadrage';

/** The keys of the `fichiers` block of `ssk-canon.yml`. */
export type CleFichier = 'cadrage' | 'pieces_jointes';

/** A specification's names, declared or the format's. */
export interface Noms {
  readonly dossiers: Readonly<Record<CleDossier, string>>;
  readonly fichiers: Readonly<Record<CleFichier, string>>;
}

/** The format's names, which any undeclared key keeps. */
export const NOMS_PAR_DEFAUT: Noms;

/** The `dossiers` key that names each entity collection. */
export const DOSSIER_DE_COLLECTION: Readonly<{
  domains: 'domaines';
  features: 'fonctionnalites';
  rules: 'regles';
  cadrages: 'cadrages';
  decisions: 'decisions';
  architecture: 'architecture';
}>;

/**
 * Resolves the names from the configuration read from `ssk-canon.yml`. A
 * faulty entry is set aside, takes back the format's name, and is told in
 * `erreurs`, as a coded anomaly that `formaterAnomalie` tells in a language.
 */
export function resoudreNoms(config: unknown): Noms & { readonly erreurs: Anomalie[] };

/**
 * Reports a declared folder or file that cannot be found when the one with the
 * format's name still exists, as coded anomalies. `paths`: the repo's files,
 * relative to its root.
 */
export function verifierDossiersDeclares(names: Noms, paths: readonly string[]): Anomalie[];
