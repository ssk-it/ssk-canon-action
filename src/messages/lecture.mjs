// Les messages de la lecture du format : frontmatter, noms déclarés, identité visuelle.

/** « a, b ou c » : une énumération, close par sa conjonction. */
const enumerer = (mots, conjonction) =>
  mots.length < 2 ? mots.join('') : `${mots.slice(0, -1).join(', ')} ${conjonction} ${mots.at(-1)}`;

const kio = (octets) => Math.ceil(octets / 1024);

/** Le fond sur lequel une variante manque. */
const FOND = {
  fr: { clair: 'clair', sombre: 'sombre' },
  en: { clair: 'light', sombre: 'dark' },
};

/** Le fichier fautif, quand le chargement le connaît, et la ligne, quand YAML la donne. */
const ou = (p, separateur) => (p.chemin ? `${p.chemin}${separateur}` : '');
const ligne = (p, mot) => (p.ligne == null ? '' : ` ${mot} ${p.ligne}`);

/** Un nom déclaré écarté, et celui du format qui le remplace. */
const retenuFr = (p, faute) => `ssk-canon.yml → ${p.bloc}.${p.cle} : ${faute} — « ${p.defaut} » est retenu`;
const retenuEn = (p, faute) => `ssk-canon.yml → ${p.bloc}.${p.cle}: ${faute} — “${p.defaut}” is kept`;

export const lecture = {
  fr: {
    // --- le frontmatter et la configuration ---
    'frontmatter-illisible': (p) => `${ou(p, ' : ')}frontmatter illisible${ligne(p, 'ligne')} : ${p.raison}`,
    'frontmatter-deux-points': (p) =>
      `${ou(p, ' : ')}frontmatter illisible${ligne(p, 'ligne')} : ${p.raison}` +
      ' — une valeur contenant « : » doit être entre apostrophes',
    // Le même défaut se disait plus ou moins précisément selon le fichier :
    // « mal formé » n'était dit que d'une entité, et la forme française reste.
    'frontmatter-absent': (p) => `${p.chemin} : frontmatter absent${p.malForme ? ' ou mal formé' : ''}`,
    'config-absente': (p) => `ssk-canon.yml : ${p.raison}`,
    'config-illisible': (p) => `ssk-canon.yml : ${p.raison}`,

    // --- les noms déclarés ---
    'noms-bloc-non-table': (p) =>
      `ssk-canon.yml → ${p.bloc} : attendu une table de noms — les noms du format sont retenus`,
    'nom-cle-inconnue': (p) =>
      `ssk-canon.yml → ${p.bloc}.${p.cle} : clé inconnue — attendu l’une de ${p.cles.join(', ')}`,
    'nom-vide': (p) => retenuFr(p, 'nom vide'),
    'nom-non-chaine': (p) => retenuFr(p, 'attendu une chaîne'),
    'nom-borde-d-espaces': (p) => retenuFr(p, 'nom bordé d’espaces'),
    'nom-chemin': (p) => retenuFr(p, 'un nom, non un chemin : sans « / »'),
    'nom-commence-par-point': (p) => retenuFr(p, 'ne commence pas par « . »'),
    'nom-fichier-non-markdown': (p) => retenuFr(p, 'un fichier Markdown, finissant par « .md »'),
    'nom-en-double': (p) => retenuFr(p, `« ${p.nom} » est aussi le nom de ${p.autres.join(', ')}`),
    'dossier-declare-introuvable': (p) =>
      `ssk-canon.yml → dossiers.${p.cle} : « ${p.nom}/ » est introuvable, alors que « ${p.ancien}/ » existe — ` +
      `un dossier ne se renomme pas, son nom se choisit à la création`,
    'nom-de-cadrage-introuvable': (p) =>
      `${p.chemin} : introuvable, alors que « ${p.ancien} » existe ` +
      `(ssk-canon.yml → ${p.cle}) — un nom se choisit à la création`,

    // --- l'identité visuelle ---
    'identite-trop-lourde': (p) =>
      `${p.chemin} : ${kio(p.taille)} Kio, au-delà de la borne de ${kio(p.max)} Kio par fichier`,
    'identite-nom-non-admis': (p) =>
      `${p.chemin} : nom non admis — attendu ${enumerer(p.elements, 'ou')}, ` +
      `suivi ou non de ${enumerer(p.variantes.map((v) => `-${v}`), 'ou')}, ou ${p.accueil}`,
    'identite-format-non-admis': (p) => `${p.chemin} : format non admis — attendu ${enumerer(p.formats, 'ou')}`,
    'identite-plusieurs-formats': (p) =>
      `${p.chemin} : présent en ${enumerer(p.formats, 'et')} — le ${p.formats[0]} est employé`,
    'identite-variante-seule': (p) =>
      `${p.chemin} : sans ${p.manquant} ni ${p.element} sans suffixe — ` +
      `sur fond ${FOND.fr[p.fond]}, l'application montre son repli`,
  },
  en: {
    'frontmatter-illisible': (p) => `${ou(p, ': ')}unreadable frontmatter${ligne(p, 'at line')}: ${p.raison}`,
    'frontmatter-deux-points': (p) =>
      `${ou(p, ': ')}unreadable frontmatter${ligne(p, 'at line')}: ${p.raison}` +
      ' — a value containing “:” must be in single quotes',
    'frontmatter-absent': (p) => `${p.chemin}: frontmatter missing or malformed`,
    'config-absente': (p) => `ssk-canon.yml: not found — ${p.raison}`,
    'config-illisible': (p) => `ssk-canon.yml: unreadable — ${p.raison}`,

    'noms-bloc-non-table': (p) =>
      `ssk-canon.yml → ${p.bloc}: expected a table of names — the format’s names are kept`,
    'nom-cle-inconnue': (p) => `ssk-canon.yml → ${p.bloc}.${p.cle}: unknown key — expected one of ${p.cles.join(', ')}`,
    'nom-vide': (p) => retenuEn(p, 'empty name'),
    'nom-non-chaine': (p) => retenuEn(p, 'expected a string'),
    'nom-borde-d-espaces': (p) => retenuEn(p, 'name with leading or trailing spaces'),
    'nom-chemin': (p) => retenuEn(p, 'a name, not a path: no “/”'),
    'nom-commence-par-point': (p) => retenuEn(p, 'must not start with “.”'),
    'nom-fichier-non-markdown': (p) => retenuEn(p, 'a Markdown file, ending in “.md”'),
    'nom-en-double': (p) => retenuEn(p, `“${p.nom}” is also the name of ${p.autres.join(', ')}`),
    'dossier-declare-introuvable': (p) =>
      `ssk-canon.yml → dossiers.${p.cle}: “${p.nom}/” not found, while “${p.ancien}/” exists — ` +
      `a folder is not renamed, its name is chosen at creation`,
    'nom-de-cadrage-introuvable': (p) =>
      `${p.chemin}: not found, while “${p.ancien}” exists (ssk-canon.yml → ${p.cle}) — a name is chosen at creation`,

    'identite-trop-lourde': (p) => `${p.chemin}: ${kio(p.taille)} KiB, above the limit of ${kio(p.max)} KiB per file`,
    'identite-nom-non-admis': (p) =>
      `${p.chemin}: name not allowed — expected ${enumerer(p.elements, 'or')}, ` +
      `optionally followed by ${enumerer(p.variantes.map((v) => `-${v}`), 'or')}, or ${p.accueil}`,
    'identite-format-non-admis': (p) => `${p.chemin}: format not allowed — expected ${enumerer(p.formats, 'or')}`,
    'identite-plusieurs-formats': (p) =>
      `${p.chemin}: present as ${enumerer(p.formats, 'and')} — the ${p.formats[0]} is used`,
    'identite-variante-seule': (p) =>
      `${p.chemin}: no ${p.manquant} nor ${p.element} without suffix — ` +
      `on a ${FOND.en[p.fond]} background, the application shows its fallback`,
  },
};
