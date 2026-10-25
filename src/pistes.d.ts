/** Une étiquette, telle que la plateforme la donne ou par son seul nom. */
export type EtiquettePiste = string | { readonly name?: string };

/** L'étiquette qui fait d'une issue une piste. */
export const ETIQUETTE_PISTE: 'piste';

/** Les préfixes de rattachement, et la collection du référentiel qu'ils désignent. */
export const RATTACHEMENTS_PISTE: readonly [
  { readonly prefixe: 'domaine/'; readonly collection: 'domains'; readonly libelle: string; readonly connus: string },
  { readonly prefixe: 'fonctionnalite/'; readonly collection: 'features'; readonly libelle: string; readonly connus: string },
];

/** Le marqueur caché qui ouvre le commentaire de la vérification. */
export const MARQUEUR_PISTE: string;

export interface RattachementPiste {
  readonly etiquette: string;
  readonly collection: 'domains' | 'features';
  /** Vide pour une étiquette de rattachement sans identifiant. */
  readonly id: string;
}

/** Les rattachements que portent des étiquettes, dans leur ordre. */
export function lireRattachementsPiste(etiquettes: readonly EtiquettePiste[]): RattachementPiste[];

/** Vrai quand les étiquettes font de l'issue une piste. */
export function estPiste(etiquettes: readonly EtiquettePiste[]): boolean;

/** Vérifie le rattachement d'une piste à un référentiel chargé — RG-piste-rattachee. */
export function checkPiste(
  etiquettes: readonly EtiquettePiste[],
  repo: {
    readonly domains: ReadonlyMap<string, unknown>;
    readonly features: ReadonlyMap<string, unknown>;
  },
): { piste: boolean; ecarts: string[] };

/** Le commentaire qui signale des écarts, marqueur en tête. */
export function corpsCommentairePiste(ecarts: readonly string[]): string;

export interface CommentaireIssue {
  readonly id: number;
  readonly body?: string;
  readonly user?: { readonly type?: string };
}

/** Ce qu'il faut faire du commentaire de la vérification. */
export function planifierCommentairePiste(
  commentaires: readonly CommentaireIssue[],
  ecarts: readonly string[],
):
  | { action: 'rien' }
  | { action: 'creer'; corps: string }
  | { action: 'modifier'; id: number; corps: string }
  | { action: 'supprimer'; id: number };
