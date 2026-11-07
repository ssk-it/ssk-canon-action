// The messages for reading the format: frontmatter, declared names, visual identity.

/** “a, b or c”: an enumeration, closed by its conjunction. */
const enumerate = (words, conjunction) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} ${conjunction} ${words.at(-1)}`;

const kib = (bytes) => Math.ceil(bytes / 1024);

/** The background on which a variant is missing. */
const BACKGROUND = {
  fr: { clair: 'clair', sombre: 'sombre' },
  en: { clair: 'light', sombre: 'dark' },
};

/** The faulty file, when loading knows it, and the line, when YAML gives it. */
const where = (p, separator) => (p.chemin ? `${p.chemin}${separator}` : '');
const line = (p, word) => (p.ligne == null ? '' : ` ${word} ${p.ligne}`);

/** A declared name set aside, and the format's name that replaces it. */
const keptFr = (p, fault) => `ssk-canon.yml → ${p.bloc}.${p.cle} : ${fault} — « ${p.defaut} » est retenu`;
const keptEn = (p, fault) => `ssk-canon.yml → ${p.bloc}.${p.cle}: ${fault} — “${p.defaut}” is kept`;

export const reading = {
  fr: {
    // --- the frontmatter and the configuration ---
    'frontmatter-illisible': (p) => `${where(p, ' : ')}frontmatter illisible${line(p, 'ligne')} : ${p.raison}`,
    'frontmatter-deux-points': (p) =>
      `${where(p, ' : ')}frontmatter illisible${line(p, 'ligne')} : ${p.raison}` +
      ' — une valeur contenant « : » doit être entre apostrophes',
    // The same defect used to be told more or less precisely depending on the file:
    // “malformed” was only said of an entity, and the French form stays.
    'frontmatter-absent': (p) => `${p.chemin} : frontmatter absent${p.malForme ? ' ou mal formé' : ''}`,
    'config-absente': (p) => `ssk-canon.yml : ${p.raison}`,
    'config-illisible': (p) => `ssk-canon.yml : ${p.raison}`,

    // --- the declared names ---
    'noms-bloc-non-table': (p) =>
      `ssk-canon.yml → ${p.bloc} : attendu une table de noms — les noms du format sont retenus`,
    'nom-cle-inconnue': (p) =>
      `ssk-canon.yml → ${p.bloc}.${p.cle} : clé inconnue — attendu l’une de ${p.cles.join(', ')}`,
    'nom-vide': (p) => keptFr(p, 'nom vide'),
    'nom-non-chaine': (p) => keptFr(p, 'attendu une chaîne'),
    'nom-borde-d-espaces': (p) => keptFr(p, 'nom bordé d’espaces'),
    'nom-chemin': (p) => keptFr(p, 'un nom, non un chemin : sans « / »'),
    'nom-commence-par-point': (p) => keptFr(p, 'ne commence pas par « . »'),
    'nom-fichier-non-markdown': (p) => keptFr(p, 'un fichier Markdown, finissant par « .md »'),
    'nom-en-double': (p) => keptFr(p, `« ${p.nom} » est aussi le nom de ${p.autres.join(', ')}`),
    'dossier-declare-introuvable': (p) =>
      `ssk-canon.yml → dossiers.${p.cle} : « ${p.nom}/ » est introuvable, alors que « ${p.ancien}/ » existe — ` +
      `un dossier ne se renomme pas, son nom se choisit à la création`,
    'nom-de-cadrage-introuvable': (p) =>
      `${p.chemin} : introuvable, alors que « ${p.ancien} » existe ` +
      `(ssk-canon.yml → ${p.cle}) — un nom se choisit à la création`,

    // --- the visual identity ---
    'identite-trop-lourde': (p) =>
      `${p.chemin} : ${kib(p.taille)} Kio, au-delà de la borne de ${kib(p.max)} Kio par fichier`,
    'identite-nom-non-admis': (p) =>
      `${p.chemin} : nom non admis — attendu ${enumerate(p.elements, 'ou')}, ` +
      `suivi ou non de ${enumerate(p.variantes.map((v) => `-${v}`), 'ou')}, ou ${p.accueil}`,
    'identite-format-non-admis': (p) => `${p.chemin} : format non admis — attendu ${enumerate(p.formats, 'ou')}`,
    'identite-plusieurs-formats': (p) =>
      `${p.chemin} : présent en ${enumerate(p.formats, 'et')} — le ${p.formats[0]} est employé`,
    'identite-variante-seule': (p) =>
      `${p.chemin} : sans ${p.manquant} ni ${p.element} sans suffixe — ` +
      `sur fond ${BACKGROUND.fr[p.fond]}, l'application montre son repli`,
  },
  en: {
    'frontmatter-illisible': (p) => `${where(p, ': ')}unreadable frontmatter${line(p, 'at line')}: ${p.raison}`,
    'frontmatter-deux-points': (p) =>
      `${where(p, ': ')}unreadable frontmatter${line(p, 'at line')}: ${p.raison}` +
      ' — a value containing “:” must be in single quotes',
    'frontmatter-absent': (p) => `${p.chemin}: frontmatter missing or malformed`,
    'config-absente': (p) => `ssk-canon.yml: not found — ${p.raison}`,
    'config-illisible': (p) => `ssk-canon.yml: unreadable — ${p.raison}`,

    'noms-bloc-non-table': (p) =>
      `ssk-canon.yml → ${p.bloc}: expected a table of names — the format’s names are kept`,
    'nom-cle-inconnue': (p) => `ssk-canon.yml → ${p.bloc}.${p.cle}: unknown key — expected one of ${p.cles.join(', ')}`,
    'nom-vide': (p) => keptEn(p, 'empty name'),
    'nom-non-chaine': (p) => keptEn(p, 'expected a string'),
    'nom-borde-d-espaces': (p) => keptEn(p, 'name with leading or trailing spaces'),
    'nom-chemin': (p) => keptEn(p, 'a name, not a path: no “/”'),
    'nom-commence-par-point': (p) => keptEn(p, 'must not start with “.”'),
    'nom-fichier-non-markdown': (p) => keptEn(p, 'a Markdown file, ending in “.md”'),
    'nom-en-double': (p) => keptEn(p, `“${p.nom}” is also the name of ${p.autres.join(', ')}`),
    'dossier-declare-introuvable': (p) =>
      `ssk-canon.yml → dossiers.${p.cle}: “${p.nom}/” not found, while “${p.ancien}/” exists — ` +
      `a folder is not renamed, its name is chosen at creation`,
    'nom-de-cadrage-introuvable': (p) =>
      `${p.chemin}: not found, while “${p.ancien}” exists (ssk-canon.yml → ${p.cle}) — a name is chosen at creation`,

    'identite-trop-lourde': (p) => `${p.chemin}: ${kib(p.taille)} KiB, above the limit of ${kib(p.max)} KiB per file`,
    'identite-nom-non-admis': (p) =>
      `${p.chemin}: name not allowed — expected ${enumerate(p.elements, 'or')}, ` +
      `optionally followed by ${enumerate(p.variantes.map((v) => `-${v}`), 'or')}, or ${p.accueil}`,
    'identite-format-non-admis': (p) => `${p.chemin}: format not allowed — expected ${enumerate(p.formats, 'or')}`,
    'identite-plusieurs-formats': (p) =>
      `${p.chemin}: present as ${enumerate(p.formats, 'and')} — the ${p.formats[0]} is used`,
    'identite-variante-seule': (p) =>
      `${p.chemin}: no ${p.manquant} nor ${p.element} without suffix — ` +
      `on a ${BACKGROUND.en[p.fond]} background, the application shows its fallback`,
  },
};
