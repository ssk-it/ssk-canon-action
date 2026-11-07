/**
 * The visual identity rule: the allowed names, variants and formats, the size limit, reading a name and checking the directory. Re-exported at the package root.
 *
 * @module @ssk-it/canon-check/identite
 */
import type { Anomalie } from './verifier.js';

/** A file of the `identite/` directory, as the platform or the disk gives it. */
export interface FichierIdentite {
  /** Path relative to the `identite/` directory, separated by “/”. */
  readonly chemin: string;
  /** Size in bytes. */
  readonly taille: number;
}

/** An identity image name, read. */
export interface NomIdentite {
  readonly element: 'symbole' | 'logotype';
  /** `null` for a file without a suffix, which suits both backgrounds. */
  readonly variante: 'clair' | 'sombre' | null;
  readonly format: 'svg' | 'webp' | 'png';
}

/** The format's name for the directory that carries the identity, which a specification can replace. */
export const REPERTOIRE_IDENTITE: 'identite';
export const ELEMENTS_IDENTITE: readonly ['symbole', 'logotype'];
export const VARIANTES_IDENTITE: readonly ['clair', 'sombre'];
/** The allowed formats, in order of preference. */
export const FORMATS_IDENTITE: readonly ['svg', 'webp', 'png'];
/** The maximum size of a file, in bytes: 100 KiB. */
export const POIDS_MAX_IDENTITE: number;

/** `null` if the file is not an allowed identity image. */
export function lireNomIdentite(path: string): NomIdentite | null;

/**
 * `directory`: the declared name of the directory, `identite` by default.
 * `anomalies`: each cause, coded; `errors` and `warnings` are its French form.
 */
export function checkIdentite(
  files: readonly FichierIdentite[],
  directory?: string,
): {
  errors: string[];
  warnings: string[];
  anomalies: Anomalie[];
};
