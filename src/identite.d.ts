/** Un fichier du répertoire `identite/`, tel que la plateforme ou le disque le donne. */
export interface FichierIdentite {
  /** Chemin relatif au répertoire `identite/`, séparé par « / ». */
  readonly chemin: string;
  /** Poids en octets. */
  readonly taille: number;
}

/** Un nom d'image d'identité, lu. */
export interface NomIdentite {
  readonly element: 'symbole' | 'logotype';
  /** `null` pour un fichier sans suffixe, qui convient aux deux fonds. */
  readonly variante: 'clair' | 'sombre' | null;
  readonly format: 'svg' | 'webp' | 'png';
}

/** Le nom du format du répertoire qui porte l'identité, qu'un référentiel peut remplacer. */
export const REPERTOIRE_IDENTITE: 'identite';
export const ELEMENTS_IDENTITE: readonly ['symbole', 'logotype'];
export const VARIANTES_IDENTITE: readonly ['clair', 'sombre'];
/** Les formats admis, dans l'ordre de préférence. */
export const FORMATS_IDENTITE: readonly ['svg', 'webp', 'png'];
/** Le poids maximal d'un fichier, en octets : 100 Kio. */
export const POIDS_MAX_IDENTITE: number;

/** `null` si le fichier n'est pas une image d'identité admise. */
export function lireNomIdentite(chemin: string): NomIdentite | null;

/** `repertoire` : le nom déclaré du répertoire, `identite` par défaut. */
export function checkIdentite(
  fichiers: readonly FichierIdentite[],
  repertoire?: string,
): {
  errors: string[];
  warnings: string[];
};
