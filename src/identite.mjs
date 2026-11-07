// A project's visual identity — RG-identite-du-projet.
//
// A specification can carry, in `identite/` at its root, its project's symbol
// and logotype. Nothing declares it elsewhere: the file names are what count.
// Hence the check, without which a badly named file would be ignored without
// anyone knowing why.
//
// This module depends on no file system. It takes the list of the directory's
// files with their size, which the Action reads on disk and the application in
// the remote repo's tree — RG-parseur-partage. The application also takes
// from it the names, the formats and their order of preference: writing them
// on its side would guarantee that they diverge.

import { createError, createWarning, enTexte } from './anomalies.mjs';

/** The directory that carries the identity, at the specification's root. */
export const REPERTOIRE_IDENTITE = 'identite';

/** The elements of an identity. */
export const ELEMENTS_IDENTITE = Object.freeze(['symbole', 'logotype']);

/**
 * The variants of an element: for a light background, for a dark background.
 * An element without a suffix suits both backgrounds.
 */
export const VARIANTES_IDENTITE = Object.freeze(['clair', 'sombre']);

/**
 * The allowed formats, in order of preference: when a same name exists in
 * several formats, the first in this order is used. SVG stays sharp at every
 * size and can be reviewed as a diff; raster formats serve when the drawing
 * only exists that way.
 */
export const FORMATS_IDENTITE = Object.freeze(['svg', 'webp', 'png']);

/**
 * The maximum size of a file, in bytes: 100 KiB.
 *
 * The identity is an exception to the refusal of versioned binaries (2026-002/02)
 * because its files are few, small and rarely revised. The limit guarantees
 * they stay so: each revision of a binary weighs on every clone of the
 * specification, and forever.
 */
export const POIDS_MAX_IDENTITE = 100 * 1024;

/** The landing file, allowed as documentation. */
const README_FILE = 'README.md';

const NAME_PATTERN = new RegExp(
  `^(${ELEMENTS_IDENTITE.join('|')})(?:-(${VARIANTES_IDENTITE.join('|')}))?\\.([^./]+)$`,
);

/**
 * Reads an identity file name.
 *
 * Returns the element, the variant — `null` for a file without a suffix — and
 * the format, or `null` if the file is not an allowed identity image.
 *
 * @param {string} path relative to the `identite/` directory
 * @returns {{ element: string, variante: string | null, format: string } | null}
 */
export function lireNomIdentite(path) {
  const m = NAME_PATTERN.exec(path);
  if (!m || !FORMATS_IDENTITE.includes(m[3])) return null;
  return { element: m[1], variante: m[2] ?? null, format: m[3] };
}

/**
 * Checks a specification's `identite/` directory.
 *
 * Unknown name, disallowed format and exceeded size are errors. A same name
 * in several formats, and a variant without its twin when no suffix-less
 * version covers the other background, are warnings: the application knows
 * what to do with them, but the author most likely did not mean it.
 *
 * Each cause is told by a coded anomaly — RG-anomalies-codees — in
 * `anomalies`; `errors` and `warnings` keep its French form.
 *
 * @param {ReadonlyArray<{ chemin: string, taille: number }>} files
 *   the directory's files, paths relative to it
 * @param {string} [directory] the directory's name, as the specification
 *   declares it — RG-noms-declares
 */
export function checkIdentite(files, directory = REPERTOIRE_IDENTITE) {
  const anomalies = [];
  // each name without extension, and the allowed formats it exists in
  const formats = new Map();

  for (const { chemin: path, taille: size } of files) {
    const here = `${directory}/${path}`;

    if (size > POIDS_MAX_IDENTITE)
      anomalies.push(createError('identite-trop-lourde', { chemin: here, taille: size, max: POIDS_MAX_IDENTITE }));

    if (path === README_FILE) continue;

    const m = NAME_PATTERN.exec(path);
    if (!m) {
      anomalies.push(
        createError('identite-nom-non-admis', {
          chemin: here,
          elements: ELEMENTS_IDENTITE,
          variantes: VARIANTES_IDENTITE,
          accueil: README_FILE,
        }),
      );
      continue;
    }
    if (!FORMATS_IDENTITE.includes(m[3])) {
      anomalies.push(createError('identite-format-non-admis', { chemin: here, formats: FORMATS_IDENTITE }));
      continue;
    }

    const name = path.slice(0, -(m[3].length + 1));
    if (!formats.has(name)) formats.set(name, []);
    formats.get(name).push(m[3]);
  }

  for (const [name, present] of formats) {
    if (present.length < 2) continue;
    const ordered = FORMATS_IDENTITE.filter((f) => present.includes(f));
    anomalies.push(createWarning('identite-plusieurs-formats', { chemin: `${directory}/${name}`, formats: ordered }));
  }

  for (const element of ELEMENTS_IDENTITE) {
    if (formats.has(element)) continue;
    const [light, dark] = VARIANTES_IDENTITE.map((v) => formats.has(`${element}-${v}`));
    if (light === dark) continue;
    const present = `${element}-${light ? 'clair' : 'sombre'}`;
    const missing = `${element}-${light ? 'sombre' : 'clair'}`;
    anomalies.push(
      createWarning('identite-variante-seule', {
        chemin: `${directory}/${present}`,
        manquant: missing,
        element,
        fond: light ? 'sombre' : 'clair',
      }),
    );
  }

  return { ...enTexte(anomalies), anomalies };
}
