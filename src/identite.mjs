// L'identité visuelle d'un projet — RG-identite-du-projet.
//
// Un référentiel peut porter, dans `identite/` à sa racine, le symbole et le
// logotype de son projet. Rien ne la déclare ailleurs : c'est le nom des
// fichiers qui fait foi. D'où la vérification, sans laquelle un fichier mal
// nommé serait ignoré sans que personne ne sache pourquoi.
//
// Ce module ne dépend d'aucun système de fichiers. Il prend la liste des
// fichiers du répertoire avec leur poids, que l'Action lit sur le disque et
// l'application dans l'arborescence du dépôt distant — RG-parseur-partage.
// L'application en reprend aussi les noms, les formats et leur ordre de
// préférence : les écrire de son côté garantirait qu'ils divergent.

import { erreur, avertissement, enTexte } from './anomalies.mjs';

/** Le répertoire qui porte l'identité, à la racine du référentiel. */
export const REPERTOIRE_IDENTITE = 'identite';

/** Les éléments d'une identité. */
export const ELEMENTS_IDENTITE = Object.freeze(['symbole', 'logotype']);

/**
 * Les variantes d'un élément : pour un fond clair, pour un fond sombre. Un
 * élément sans suffixe convient aux deux fonds.
 */
export const VARIANTES_IDENTITE = Object.freeze(['clair', 'sombre']);

/**
 * Les formats admis, dans l'ordre de préférence : quand un même nom existe en
 * plusieurs formats, le premier de cet ordre est employé. Le SVG reste net à
 * toutes les tailles et se relit en différence ; les formats matriciels servent
 * quand le dessin n'existe qu'ainsi.
 */
export const FORMATS_IDENTITE = Object.freeze(['svg', 'webp', 'png']);

/**
 * Le poids maximal d'un fichier, en octets : 100 Kio.
 *
 * L'identité fait exception au refus des binaires versionnés (2026-002/02)
 * parce que ses fichiers sont peu nombreux, petits et rarement révisés. La
 * borne garantit qu'ils le restent : chaque révision d'un binaire pèse sur tout
 * clone du référentiel, et pour toujours.
 */
export const POIDS_MAX_IDENTITE = 100 * 1024;

/** Le fichier d'accueil, admis au titre de la documentation. */
const ACCUEIL = 'README.md';

const NOM = new RegExp(
  `^(${ELEMENTS_IDENTITE.join('|')})(?:-(${VARIANTES_IDENTITE.join('|')}))?\\.([^./]+)$`,
);

/**
 * Lit un nom de fichier d'identité.
 *
 * Retourne l'élément, la variante — `null` pour un fichier sans suffixe — et le
 * format, ou `null` si le fichier n'est pas une image d'identité admise.
 *
 * @param {string} chemin relatif au répertoire `identite/`
 * @returns {{ element: string, variante: string | null, format: string } | null}
 */
export function lireNomIdentite(chemin) {
  const m = NOM.exec(chemin);
  if (!m || !FORMATS_IDENTITE.includes(m[3])) return null;
  return { element: m[1], variante: m[2] ?? null, format: m[3] };
}

/**
 * Vérifie le répertoire `identite/` d'un référentiel.
 *
 * Nom inconnu, format non admis et poids dépassé sont des erreurs. Un même nom
 * en plusieurs formats, et une variante sans sa jumelle quand aucune version
 * sans suffixe ne couvre l'autre fond, sont des avertissements : l'application
 * sait quoi en faire, mais le rédacteur ne l'a sans doute pas voulu.
 *
 * Chaque cause se dit par une anomalie codée — RG-anomalies-codees — dans
 * `anomalies` ; `errors` et `warnings` en gardent la forme française.
 *
 * @param {ReadonlyArray<{ chemin: string, taille: number }>} fichiers
 *   les fichiers du répertoire, chemins relatifs à celui-ci
 * @param {string} [repertoire] le nom du répertoire, tel que le référentiel le
 *   déclare — RG-noms-declares
 */
export function checkIdentite(fichiers, repertoire = REPERTOIRE_IDENTITE) {
  const anomalies = [];
  // chaque nom sans extension, et les formats admis sous lesquels il existe
  const formats = new Map();

  for (const { chemin, taille } of fichiers) {
    const ici = `${repertoire}/${chemin}`;

    if (taille > POIDS_MAX_IDENTITE)
      anomalies.push(erreur('identite-trop-lourde', { chemin: ici, taille, max: POIDS_MAX_IDENTITE }));

    if (chemin === ACCUEIL) continue;

    const m = NOM.exec(chemin);
    if (!m) {
      anomalies.push(
        erreur('identite-nom-non-admis', {
          chemin: ici,
          elements: ELEMENTS_IDENTITE,
          variantes: VARIANTES_IDENTITE,
          accueil: ACCUEIL,
        }),
      );
      continue;
    }
    if (!FORMATS_IDENTITE.includes(m[3])) {
      anomalies.push(erreur('identite-format-non-admis', { chemin: ici, formats: FORMATS_IDENTITE }));
      continue;
    }

    const nom = chemin.slice(0, -(m[3].length + 1));
    if (!formats.has(nom)) formats.set(nom, []);
    formats.get(nom).push(m[3]);
  }

  for (const [nom, presents] of formats) {
    if (presents.length < 2) continue;
    const ordonnes = FORMATS_IDENTITE.filter((f) => presents.includes(f));
    anomalies.push(avertissement('identite-plusieurs-formats', { chemin: `${repertoire}/${nom}`, formats: ordonnes }));
  }

  for (const element of ELEMENTS_IDENTITE) {
    if (formats.has(element)) continue;
    const [clair, sombre] = VARIANTES_IDENTITE.map((v) => formats.has(`${element}-${v}`));
    if (clair === sombre) continue;
    const present = `${element}-${clair ? 'clair' : 'sombre'}`;
    const manquant = `${element}-${clair ? 'sombre' : 'clair'}`;
    anomalies.push(
      avertissement('identite-variante-seule', {
        chemin: `${repertoire}/${present}`,
        manquant,
        element,
        fond: clair ? 'sombre' : 'clair',
      }),
    );
  }

  return { ...enTexte(anomalies), anomalies };
}
