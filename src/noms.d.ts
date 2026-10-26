import type { Anomalie } from './verifier.js';

/** Les clés du bloc `dossiers` de `ssk-canon.yml`. */
export type CleDossier =
  | 'domaines'
  | 'fonctionnalites'
  | 'regles'
  | 'cadrages'
  | 'decisions'
  | 'architecture'
  | 'identite'
  | 'decisions_cadrage';

/** Les clés du bloc `fichiers` de `ssk-canon.yml`. */
export type CleFichier = 'cadrage' | 'pieces_jointes';

/** Les noms d'un référentiel, déclarés ou ceux du format. */
export interface Noms {
  readonly dossiers: Readonly<Record<CleDossier, string>>;
  readonly fichiers: Readonly<Record<CleFichier, string>>;
}

/** Les noms du format, que garde toute clé non déclarée. */
export const NOMS_PAR_DEFAUT: Noms;

/** La clé de `dossiers` qui nomme chaque collection d'entités. */
export const DOSSIER_DE_COLLECTION: Readonly<{
  domains: 'domaines';
  features: 'fonctionnalites';
  rules: 'regles';
  cadrages: 'cadrages';
  decisions: 'decisions';
  architecture: 'architecture';
}>;

/**
 * Résout les noms à partir de la configuration lue de `ssk-canon.yml`. Une
 * entrée fautive est écartée, reprend le nom du format, et se dit dans
 * `erreurs`, en anomalie codée que `formaterAnomalie` dit dans une langue.
 */
export function resoudreNoms(config: unknown): Noms & { readonly erreurs: Anomalie[] };

/**
 * Signale un dossier ou un fichier déclaré introuvable quand celui du nom du
 * format existe encore, en anomalies codées. `chemins` : les fichiers du dépôt,
 * relatifs à sa racine.
 */
export function verifierDossiersDeclares(noms: Noms, chemins: readonly string[]): Anomalie[];
