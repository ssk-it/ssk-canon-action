// Découpage frontmatter / corps, et chargement d'un dépôt de projet.
//
// Ce module est le pendant Node de ce que fait la PWA côté navigateur. Les deux
// doivent rester d'accord sur le format — voir l'invariant correspondant dans
// CLAUDE.md. `gray-matter` n'est volontairement pas utilisé : le découpage tient
// en quelques lignes et le paquet se comporte mal dans un navigateur.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import yaml from 'js-yaml';
import { splitFrontmatter, extractEnonces } from './format.mjs';

// Réexportés pour ne pas casser les appelants : le découpage entre ce qui
// touche au disque et ce qui n'y touche pas est une affaire interne.
export { splitFrontmatter, extractEnonces };

/** Liste récursivement les fichiers Markdown d'un répertoire. */
export function listMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) listMarkdown(p, out);
    else if (p.endsWith('.md')) out.push(p);
  }
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

    // Un README à l'intérieur d'un répertoire de contenu n'en est pas une non
    // plus : il explique ce que le répertoire attend, ce qui est utile à qui
    // ouvre le dépôt sur la plateforme. Le traiter comme une entité ferait
    // échouer la vérification sur de la documentation.
    if (parts.at(-1) === 'README.md') continue;

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
