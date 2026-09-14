// Déclarations pour les consommateurs TypeScript.
//
// Écrites à la main plutôt que générées : le module est en JavaScript, et le
// faire compiler depuis TypeScript ajouterait une étape de construction à un
// paquet qui n'en a aucune. Sa surface est étroite et stable.

/** Un référentiel chargé, quelle qu'en soit la provenance. */
export interface RepoVerifiable {
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
  /** Erreurs déjà rencontrées au chargement, reprises telles quelles. */
  readonly errors?: readonly string[];
}

export interface ResultatVerification {
  readonly errors: string[];
  readonly warnings: string[];
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
