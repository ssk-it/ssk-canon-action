// Déclarations de `citations.mjs` — RG-regle-du-socle-citee,
// RG-citation-signalee-chez-le-citant, RG-prefixe-projet.

/**
 * La citation d'un autre référentiel : lecture, résolution du préfixe, état de chaque citation. Repris à la racine du paquet.
 *
 * @module @ssk-it/canon-check/citations
 */
import type { Anomalie } from './verifier.js';

/** Un préfixe de projet : des lettres, chiffres ou « _ », commençant par une lettre. */
export declare const FORME_PREFIXE: RegExp;

/** Une citation lue : `<prefixe>:<id>@<cadrage>`, le cadrage étant celui du référentiel cité. */
export interface Citation {
  readonly prefixe: string;
  readonly id: string;
  readonly cadrage: string;
}

/** Une citation lue, ou `null` si elle ne suit pas la forme. */
export function lireCitation(texte: unknown): Citation | null;

/** Compare deux identifiants de cadrage, par année puis par numéro. */
export function comparerCadrages(a: string, b: string): number;

/**
 * Les référentiels que le projet cite — `referentiels_cites` de `ssk-canon.yml`
 * —, par préfixe. Une entrée fautive est écartée, et avertie.
 */
export function referentielsCites(config: unknown): {
  cites: Map<string, string>;
  anomalies: Anomalie[];
};

/** Ce que désigne un préfixe : le projet, un référentiel qu'il cite, ou une adresse inconnue. */
export function resoudrePrefixe(
  prefixe: string,
  config: unknown,
): { nature: 'projet' } | { nature: 'cite'; repo: string } | { nature: 'inconnue' };

/** Un référentiel cité, chargé : ses règles, et ses décisions d'architecture s'il en a. */
export interface ReferentielCite {
  readonly rules: ReadonlyMap<string, unknown>;
  readonly decisions?: ReadonlyMap<string, unknown>;
}

export interface OptionsCitations {
  /**
   * Par préfixe, le référentiel cité déjà chargé, ou `null` s'il n'a pas pu
   * l'être. Un préfixe absent n'a pas été lu : ses citations sont non vérifiées.
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

/** Une citation et ce qu'en dit la vérification. */
export interface EtatDeCitation {
  /** L'identifiant de la règle ou de la décision d'architecture qui cite. */
  readonly source: string;
  readonly nature: 'regle' | 'adr';
  /** La citation telle qu'écrite dans `applique`. */
  readonly texte: string;
  /** `null` quand elle est mal formée. */
  readonly citation: Citation | null;
  readonly etat: EtatCitation;
  /** Le dépôt cité ; `null` quand le préfixe est celui du projet ; absent si le préfixe ne se résout pas. */
  readonly repo?: string | null;
  /** `perimee` : les cadrages du référentiel cité postérieurs à celui noté. */
  readonly recents?: readonly string[];
  /** `abrogee` : le cadrage qui l'a abrogée, s'il est connu. */
  readonly cadrage?: string | null;
}

/** L'état de chaque citation, dans l'ordre des règles puis des décisions d'architecture. */
export function etatDesCitations(
  repo: { readonly config?: unknown; readonly rules: ReadonlyMap<string, unknown>; readonly decisions?: ReadonlyMap<string, unknown> },
  options?: OptionsCitations,
): EtatDeCitation[];

/**
 * L'état d'une citation face à sa seule cible, lue dans le référentiel cité :
 * `null` si elle est introuvable, `lu: false` si le référentiel n'a pas pu être lu.
 */
export function etatDeCible(
  citation: Pick<Citation, 'cadrage'>,
  cible: { readonly statut?: string; readonly modifie_par?: readonly string[] } | null | undefined,
  options?: { readonly lu?: boolean },
): {
  etat: 'a-jour' | 'perimee' | 'abrogee' | 'absente' | 'non-verifiee';
  recents?: string[];
  cadrage?: string | null;
};

/** Les avertissements des citations, et de la déclaration des référentiels cités. Jamais une erreur. */
export function verifierCitations(
  repo: { readonly config?: unknown; readonly rules: ReadonlyMap<string, unknown>; readonly decisions?: ReadonlyMap<string, unknown> },
  options?: OptionsCitations,
): Anomalie[];
