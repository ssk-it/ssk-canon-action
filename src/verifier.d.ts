// Déclarations pour les consommateurs TypeScript.
//
// Écrites à la main plutôt que générées : le module est en JavaScript, et le
// faire compiler depuis TypeScript ajouterait une étape de construction à un
// paquet qui n'en a aucune. Sa surface est étroite et stable.

import type { FichierIdentite } from './identite.js';

export * from './identite.js';
export * from './noms.js';

/** Les langues dans lesquelles une anomalie se dit — RG-anomalies-codees. */
export type Langue = 'fr' | 'en';
export declare const LANGUES: readonly Langue[];

/**
 * Une anomalie du format : un code stable, une gravité, et des paramètres —
 * valeurs du référentiel et du format, jamais traduites. Son message se déduit
 * du code, dans chaque langue, par `formaterAnomalie`.
 */
export interface Anomalie {
  readonly code: string;
  readonly gravite: 'erreur' | 'avertissement';
  readonly params: Readonly<Record<string, unknown>>;
}

/** Le message d'une anomalie dans une langue ; une langue inconnue se lit en français. */
export function formaterAnomalie(anomalie: Anomalie, langue?: string): string;

/** Les anomalies en textes, erreurs et avertissements séparés. */
export function enTexte(
  anomalies: readonly Anomalie[],
  langue?: string,
): { errors: string[]; warnings: string[] };

/** La langue que le dépôt déclare dans `ssk-canon.yml` — RG-langue-du-depot. */
export function langueDuDepot(config: unknown): {
  langue: Langue;
  anomalies: Anomalie[];
};

/** Un référentiel chargé, quelle qu'en soit la provenance. */
export interface RepoVerifiable {
  /**
   * La configuration du projet, telle que `ssk-canon.yml` la porte.
   *
   * Absente, rien de ce qui en dépend n'est contrôlé : un référentiel vérifié
   * hors de son dépôt reste vérifiable.
   */
  readonly config?: {
    readonly projet?: { readonly prefixe?: string };
    /** La langue du dépôt — RG-langue-du-depot. */
    readonly langue?: unknown;
    /** Les noms déclarés — RG-noms-declares. */
    readonly dossiers?: unknown;
    readonly fichiers?: unknown;
  } | null;
  readonly domains: ReadonlyMap<string, unknown>;
  readonly features: ReadonlyMap<string, unknown>;
  readonly rules: ReadonlyMap<string, unknown>;
  /**
   * Les cibles d'architecture, quand le référentiel en porte.
   *
   * Absentes, elles se lisent comme vides : tout impact les visant serait alors
   * signalé comme inconnu, alors que c'est la collection qui manque.
   */
  readonly decisions?: ReadonlyMap<string, unknown>;
  readonly architecture?: ReadonlyMap<string, unknown>;
  readonly cadrages: ReadonlyMap<string, unknown>;
  /**
   * Les fichiers du répertoire `identite/`, avec leur poids.
   *
   * Absents, l'identité n'est pas contrôlée ; un tableau vide dit qu'il n'y en
   * a pas.
   */
  readonly identite?: readonly FichierIdentite[];
  /**
   * Les fichiers du dépôt, relatifs à sa racine, séparés par « / ».
   *
   * Présents, ils révèlent un dossier déclaré introuvable alors que celui du
   * nom du format existe encore ; absents, ce contrôle n'a pas lieu.
   */
  readonly chemins?: readonly string[];
  /** Erreurs déjà rencontrées au chargement : un texte est repris tel quel, une anomalie codée se dit dans chaque langue. */
  readonly errors?: readonly (string | Anomalie)[];
  /** Les mêmes, codées par le chargement : préférées à `errors` quand elles sont là. */
  readonly anomalies?: readonly Anomalie[];
}

export interface ResultatVerification {
  /** En français, mot pour mot la forme d'avant les codes. */
  readonly errors: string[];
  readonly warnings: string[];
  /** Les mêmes, codées, dans l'ordre : ce qu'une interface dit dans sa langue. */
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
   * Omet les contrôles portant sur `cree_par` et `modifie_par`.
   *
   * Ces champs sont écrits par la propagation : les exiger corrects avant elle
   * rendrait toute désynchronisation impossible à corriger.
   */
  readonly ignorerIndexDerives?: boolean;
  /**
   * Les cadrages tenus pour livrés.
   *
   * Un cadrage ne déclare pas son statut : il se déduit de l'état du dépôt, que
   * seul l'appelant sait lire — la branche principale pour l'Action, la
   * plateforme pour le navigateur.
   */
  readonly livres?: ReadonlySet<string>;
}

export function checkRepo(
  repo: RepoVerifiable,
  options?: OptionsVerification,
): ResultatVerification;
