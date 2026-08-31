// Lecture du format, sans dépendance au système de fichiers.
//
// Ce module s'exécute aussi bien dans l'Action, qui lit un répertoire, que dans
// un navigateur, qui lit un dépôt distant. C'est ce qui permet aux deux de
// partager une seule implémentation des règles du format — les dupliquer
// garantirait qu'elles divergent.
//
// Tout ce qui touche au disque vit dans `parse.mjs`, qui s'appuie sur celui-ci.

import yaml from 'js-yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Sépare le frontmatter YAML du corps Markdown.
 *
 * Retourne `null` si le bloc est absent, et `{ erreur }` s'il est présent mais
 * illisible. Les deux cas sont distincts : le premier dit que le fichier n'est
 * pas une entité, le second qu'il en est une et qu'elle est cassée.
 *
 * L'erreur n'est jamais propagée telle quelle. Une exception de la bibliothèque
 * YAML remonterait jusqu'au sommet et sortirait une trace de pile, où le lecteur
 * chercherait en vain quel fichier reprendre.
 */
export function splitFrontmatter(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return null;
  try {
    return { data: yaml.load(m[1]) ?? {}, body: m[2] };
  } catch (e) {
    return { erreur: formatErreurYaml(e), body: m[2] };
  }
}

/**
 * Met en forme une erreur de la bibliothèque YAML.
 *
 * Elle porte la ligne et la colonne fautives dans `mark`, mais son `message`
 * embarque aussi un extrait multiligne du document qui, recopié dans une liste
 * d'erreurs, la rend illisible. On garde la première ligne et les coordonnées,
 * qui suffisent à retrouver le point exact.
 */
function formatErreurYaml(e) {
  let raison = String(e?.reason ?? e?.message ?? e).split('\n')[0].trim();

  // Cause de loin la plus fréquente, et dont le message d'origine ne dit rien :
  // un `:` suivi d'une espace dans une valeur non quotée, que YAML lit comme un
  // séparateur. Un titre de décision en contient presque toujours un.
  if (/bad indentation of a mapping entry/.test(raison)) {
    raison +=
      ' — une valeur contenant « : » doit être entre apostrophes';
  }
  const ligne = e?.mark?.line;
  // `line` est indexée à zéro et relative au bloc : le `---` d'ouverture
  // décale d'une ligne de plus pour retrouver le numéro dans le fichier.
  return typeof ligne === 'number'
    ? `frontmatter illisible ligne ${ligne + 2} : ${raison}`
    : `frontmatter illisible : ${raison}`;
}

/** Extrait les identifiants de règles titrés dans la section `## Énoncés`. */
export function extractEnonces(body) {
  const section = /^##[ \t]+Énoncés[ \t]*$([\s\S]*?)(?=^##[ \t]|$(?![\s\S]))/m.exec(body);
  if (!section) return new Map();
  const out = new Map();
  const re = /^###[ \t]+(\S+)[ \t]*$([\s\S]*?)(?=^###[ \t]|$(?![\s\S]))/gm;
  for (const m of section[1].matchAll(re)) out.set(m[1], m[2].trim());
  return out;
}
