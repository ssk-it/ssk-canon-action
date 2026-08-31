// Découpage frontmatter / corps, et chargement d'un dépôt de projet.
//
// Ce module est le pendant Node de ce que fait la PWA côté navigateur. Les deux
// doivent rester d'accord sur le format — voir l'invariant correspondant dans
// CLAUDE.md. `gray-matter` n'est volontairement pas utilisé : le découpage tient
// en quelques lignes et le paquet se comporte mal dans un navigateur.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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

/** Liste récursivement les fichiers Markdown d'un répertoire. */
export function listMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) listMarkdown(p, out);
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
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

/**
 * Charge un dépôt de projet en mémoire.
 * Retourne les entités indexées par identifiant, et les erreurs de forme.
 */
export function loadRepo(root) {
  const errors = [];
  const domains = new Map();
  const features = new Map();
  const rules = new Map();
  const cadrages = new Map();

  let config = null;
  try {
    config = yaml.load(readFileSync(join(root, 'ssk-canon.yml'), 'utf8'));
  } catch (e) {
    errors.push(`ssk-canon.yml : ${e.message}`);
  }

  const CONTENT_DIRS = new Set(['domains', 'features', 'rules', 'cadrages']);

  for (const file of listMarkdown(root).sort()) {
    const rel = relative(root, file);
    const parts = rel.split(sep);

    // les fichiers hors des répertoires de contenu (README et compagnie) ne
    // sont pas des entités : on les ignore sans rien en dire
    if (parts.length < 2 || !CONTENT_DIRS.has(parts[0])) continue;

    // Les fichiers rattachés à un cadrage — décisions, pièces jointes — sont
    // chargés plus bas, avec leur cadrage. Les traiter ici aussi signalerait
    // deux fois la même erreur.
    if (parts[0] === 'cadrages' && !rel.endsWith('cadrage.md')) continue;

    const parsed = splitFrontmatter(readFileSync(file, 'utf8'));
    if (!parsed) {
      errors.push(`${rel} : frontmatter absent ou mal formé`);
      continue;
    }
    // Un fichier illisible est écarté et signalé, sans interrompre les autres :
    // corriger une erreur à la fois quand la vérification s'arrête à la première
    // demande autant d'exécutions qu'il y a de fautes.
    if (parsed.erreur) {
      errors.push(`${rel} : ${parsed.erreur}`);
      continue;
    }
    const { data, body } = parsed;
    const entry = { ...data, path: rel, body };

    const top = parts[0];
    if (top === 'domains') domains.set(data.id, entry);
    else if (top === 'features') features.set(data.id, entry);
    else if (top === 'rules') rules.set(data.id, entry);
    else if (top === 'cadrages' && rel.endsWith('cadrage.md')) cadrages.set(data.id, entry);
    // les décisions et attachments sont rattachés à leur cadrage plus bas
  }

  // rattachement des décisions et pièces jointes
  for (const [id, c] of cadrages) {
    const dir = join(root, 'cadrages', id);
    c.decisions = [];
    try {
      for (const f of listMarkdown(join(dir, 'decisions')).sort()) {
        const parsed = splitFrontmatter(readFileSync(f, 'utf8'));
        if (!parsed) errors.push(`${relative(root, f)} : frontmatter absent`);
        else if (parsed.erreur) errors.push(`${relative(root, f)} : ${parsed.erreur}`);
        else c.decisions.push({ ...parsed.data, body: parsed.body });
      }
    } catch { /* pas de décisions, cas normal */ }

    try {
      const parsed = splitFrontmatter(readFileSync(join(dir, 'attachments.md'), 'utf8'));
      if (parsed?.erreur) errors.push(`cadrages/${id}/attachments.md : ${parsed.erreur}`);
      c.attachments = parsed?.data?.attachments ?? [];
    } catch {
      // absence de fichier : cas normal, un cadrage n'a pas toujours de pièces
      c.attachments = [];
    }
  }

  return { config, domains, features, rules, cadrages, errors };
}
