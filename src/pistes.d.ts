/**
 * Reading a roadmap item's labels and checking them, so that an application displaying roadmap items links them the way the Action checks them.
 *
 * @module @ssk-it/canon-check/pistes
 */
import type { Anomalie } from './verifier.js';

/** A label, as the platform gives it or by its name alone. */
export type EtiquettePiste = string | { readonly name?: string };

/** The label that makes an issue a roadmap item. */
export const ETIQUETTE_PISTE: 'piste';

/** The link prefixes, and the specification collection they designate. */
export const RATTACHEMENTS_PISTE: readonly [
  { readonly prefixe: 'domaine/'; readonly collection: 'domains'; readonly libelle: string; readonly connus: string },
  { readonly prefixe: 'fonctionnalite/'; readonly collection: 'features'; readonly libelle: string; readonly connus: string },
];

/** The hidden marker that opens the check's comment. */
export const MARQUEUR_PISTE: string;

export interface RattachementPiste {
  readonly etiquette: string;
  readonly collection: 'domains' | 'features';
  /** Empty for a link label without an identifier. */
  readonly id: string;
}

/** The links carried by labels, in their order. */
export function lireRattachementsPiste(labels: readonly EtiquettePiste[]): RattachementPiste[];

/** True when the labels make the issue a roadmap item. */
export function estPiste(labels: readonly EtiquettePiste[]): boolean;

/**
 * Checks how a roadmap item is linked to a loaded specification — RG-piste-rattachee.
 * Each discrepancy is a coded warning, in `anomalies` (codes
 * `piste-non-rattachee`, `etiquette-piste-sans-identifiant`,
 * `etiquette-piste-inconnue`); `ecarts` is its text, in `language`
 * (French by default).
 */
export function checkPiste(
  labels: readonly EtiquettePiste[],
  repo: {
    readonly domains: ReadonlyMap<string, unknown>;
    readonly features: ReadonlyMap<string, unknown>;
  },
  language?: string,
): { piste: boolean; ecarts: string[]; anomalies: Anomalie[] };

/** The comment that reports discrepancies, marker first, in `language` (French by default). */
export function corpsCommentairePiste(discrepancies: readonly string[], language?: string): string;

export interface CommentaireIssue {
  readonly id: number;
  readonly body?: string;
  readonly user?: { readonly type?: string };
}

/** What to do with the check's comment. */
export function planifierCommentairePiste(
  comments: readonly CommentaireIssue[],
  discrepancies: readonly string[],
  language?: string,
):
  | { action: 'rien' }
  | { action: 'creer'; corps: string }
  | { action: 'modifier'; id: number; corps: string }
  | { action: 'supprimer'; id: number };

/** The link labels a specification expects, domains then features. */
export function etiquettesRattachementPiste(repo: {
  readonly domains: ReadonlyMap<string, unknown>;
  readonly features: ReadonlyMap<string, unknown>;
}): string[];
