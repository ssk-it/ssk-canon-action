// Frontmatter / body split, and loading of a project repo.
//
// This module is the Node counterpart of what the PWA does in the browser. The
// two must stay in agreement on the format — see the corresponding invariant in
// CLAUDE.md. `gray-matter` is deliberately not used: the split fits in a few
// lines and the package behaves badly in a browser.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { load } from 'js-yaml';
import { splitFrontmatter, extractEnonces } from './format.mjs';
import { resoudreNoms, DOSSIER_DE_COLLECTION } from './noms.mjs';
import { createError, formaterAnomalie } from './anomalies.mjs';

// Re-exported so as not to break callers: the split between what touches the
// disk and what does not is an internal matter.
export { splitFrontmatter, extractEnonces };

/** Recursively lists the Markdown files of a directory. */
export function listMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) listMarkdown(p, out);
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

/**
 * Recursively lists the files of a directory, with their size.
 *
 * Paths are relative to `rootDir`, separated by "/" whatever the system: that
 * is the form in which the platform gives them, and the one the shared rule
 * checks.
 */
function listFiles(rootDir, dir = rootDir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) listFiles(rootDir, p, out);
    else out.push({ chemin: relative(rootDir, p).split(sep).join('/'), taille: s.size });
  }
  return out;
}

/**
 * Lists the files of a repo, relative paths separated by "/".
 *
 * What starts with "." is left out: `.git` is not content, and walking it
 * would cost more than all the rest.
 */
function listPaths(rootDir, dir = rootDir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) listPaths(rootDir, p, out);
    else out.push(relative(rootDir, p).split(sep).join('/'));
  }
  return out;
}

/**
 * The names the specification declares, without loading the rest.
 *
 * An unreadable configuration gives the format's names: loading reports it,
 * and a specification can be read even when its configuration is faulty.
 */
export function readNames(root) {
  try {
    return resoudreNoms(load(readFileSync(join(root, 'ssk-canon.yml'), 'utf8')));
  } catch {
    return resoudreNoms(null);
  }
}

/**
 * Loads a project repo into memory.
 * Returns the entities indexed by identifier, and the form errors: coded in
 * `anomalies` — RG-anomalies-codees —, and in `errors` in yesterday's French
 * form, which some callers still read as text.
 */
export function loadRepo(root) {
  const anomalies = [];
  const domains = new Map();
  const features = new Map();
  const rules = new Map();
  const cadrages = new Map();
  // Architecture targets are indexed apart from rules: they follow the same
  // projection regime, but are consulted separately — one does not read an
  // architecture folder to look for the product's behaviour.
  const decisions = new Map();
  const architecture = new Map();

  let config = null;
  try {
    config = load(readFileSync(join(root, 'ssk-canon.yml'), 'utf8'));
  } catch (e) {
    // Missing or unreadable: two causes, two codes; the reason stays the one
    // we received.
    anomalies.push(createError(e?.code === 'ENOENT' ? 'config-absente' : 'config-illisible', { raison: e.message }));
  }

  /** An unreadable frontmatter, attributed to the file that carries it. */
  const inFile = (chemin, anomaly) => ({ ...anomaly, params: { chemin, ...anomaly.params } });

  // The names the specification declares — RG-noms-declares. A faulty
  // declaration is set aside here silently: the check reports it, and reporting
  // it twice would cast doubt on the number of faults.
  const names = resoudreNoms(config);
  const scopingsDir = names.dossiers.cadrages;

  // the folder of each collection, under its declared name
  const collectionOfFolder = new Map(
    Object.entries(DOSSIER_DE_COLLECTION).map(([collection, key]) => [names.dossiers[key], collection]),
  );
  const collections = { domains, features, rules, cadrages, decisions, architecture };

  const paths = listPaths(root).sort();
  for (const rel of paths) {
    if (!rel.endsWith('.md')) continue;
    const file = join(root, ...rel.split('/'));
    const parts = rel.split('/');
    const collection = collectionOfFolder.get(parts[0]);

    // files outside the content directories (README and the like) are not
    // entities: they are ignored without a word
    if (parts.length < 2 || !collection) continue;

    // A README inside a content directory is not one either: it explains what
    // the directory expects, which is useful to whoever opens the repo on the
    // platform. Treating it as an entity would make the check fail on
    // documentation.
    if (parts.at(-1) === 'README.md') continue;

    // The files attached to a scoping — decisions, attachments — are loaded
    // further down, with their scoping. Handling them here as well would report
    // the same error twice.
    if (collection === 'cadrages' && !(parts.length === 3 && parts[2] === names.fichiers.cadrage)) continue;

    const parsed = splitFrontmatter(readFileSync(file, 'utf8'));
    if (!parsed) {
      anomalies.push(createError('frontmatter-absent', { chemin: rel, malForme: true }));
      continue;
    }
    // An unreadable file is set aside and reported, without interrupting the
    // others: fixing one error at a time when the check stops at the first one
    // takes as many runs as there are faults.
    if (parsed.erreur) {
      anomalies.push(inFile(rel, parsed.anomalie));
      continue;
    }
    const { data, body } = parsed;
    // the path keeps the system's separator, as before names were declared:
    // the messages quote it as the author types it
    collections[collection].set(data.id, { ...data, path: parts.join(sep), body });
    // scoping decisions and attachments are linked to their scoping further down
  }

  // The visual identity is not content: its files are not entities, and only
  // their name and size matter — RG-identite-du-projet.
  let identity = [];
  try {
    identity = listFiles(join(root, names.dossiers.identite)).sort((a, b) =>
      a.chemin.localeCompare(b.chemin),
    );
  } catch {
    // no identity, normal case
  }

  // linking of decisions and attachments
  for (const [id, c] of cadrages) {
    const dir = join(root, scopingsDir, id);
    c.decisions = [];
    try {
      for (const f of listMarkdown(join(dir, names.dossiers.decisions_cadrage)).sort()) {
        const parsed = splitFrontmatter(readFileSync(f, 'utf8'));
        if (!parsed) anomalies.push(createError('frontmatter-absent', { chemin: relative(root, f), malForme: false }));
        else if (parsed.erreur) anomalies.push(inFile(relative(root, f), parsed.anomalie));
        else c.decisions.push({ ...parsed.data, body: parsed.body });
      }
    } catch { /* no decisions, normal case */ }

    try {
      const parsed = splitFrontmatter(readFileSync(join(dir, names.fichiers.pieces_jointes), 'utf8'));
      if (parsed?.erreur)
        anomalies.push(inFile(`${scopingsDir}/${id}/${names.fichiers.pieces_jointes}`, parsed.anomalie));
      c.attachments = parsed?.data?.attachments ?? [];
    } catch {
      // missing file: normal case, a scoping does not always have attachments
      c.attachments = [];
    }
  }

  return {
    config,
    noms: names,
    chemins: paths,
    domains,
    features,
    rules,
    cadrages,
    decisions,
    architecture,
    identite: identity,
    errors: anomalies.map((a) => formaterAnomalie(a, 'fr')),
    anomalies,
  };
}
