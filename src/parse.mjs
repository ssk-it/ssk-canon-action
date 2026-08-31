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

/** Sépare le frontmatter YAML du corps Markdown. */
export function splitFrontmatter(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return null;
  return { data: yaml.load(m[1]) ?? {}, body: m[2] };
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

    const parsed = splitFrontmatter(readFileSync(file, 'utf8'));
    if (!parsed) {
      errors.push(`${rel} : frontmatter absent ou mal formé`);
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
        if (parsed) c.decisions.push({ ...parsed.data, body: parsed.body });
        else errors.push(`${relative(root, f)} : frontmatter absent`);
      }
    } catch { /* pas de décisions, cas normal */ }

    try {
      const parsed = splitFrontmatter(readFileSync(join(dir, 'attachments.md'), 'utf8'));
      c.attachments = parsed?.data?.attachments ?? [];
    } catch { c.attachments = []; }
  }

  return { config, domains, features, rules, cadrages, errors };
}
