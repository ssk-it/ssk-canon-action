// Découpage frontmatter / corps, et chargement d'un dépôt de projet.
//
// Ce module est le pendant Node de ce que fait la PWA côté navigateur. Les deux
// doivent rester d'accord sur le format — voir l'invariant correspondant dans
// CLAUDE.md. `gray-matter` n'est volontairement pas utilisé : le découpage tient
// en quelques lignes et le paquet se comporte mal dans un navigateur.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { load } from 'js-yaml';
import { splitFrontmatter, extractEnonces } from './format.mjs';
import { resoudreNoms, DOSSIER_DE_COLLECTION } from './noms.mjs';

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
 * Liste récursivement les fichiers d'un répertoire, avec leur poids.
 *
 * Les chemins sont relatifs à `racine`, séparés par « / » quel que soit le
 * système : c'est la forme sous laquelle la plateforme les donne, et celle que
 * la règle partagée contrôle.
 */
function listFichiers(racine, dir = racine, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) listFichiers(racine, p, out);
    else out.push({ chemin: relative(racine, p).split(sep).join('/'), taille: s.size });
  }
  return out;
}

/**
 * Liste les fichiers d'un dépôt, chemins relatifs séparés par « / ».
 *
 * Ce qui commence par « . » est écarté : `.git` n'est pas du contenu, et le
 * parcourir coûterait plus que tout le reste.
 */
function listChemins(racine, dir = racine, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) listChemins(racine, p, out);
    else out.push(relative(racine, p).split(sep).join('/'));
  }
  return out;
}

/**
 * Les noms que le référentiel déclare, sans charger le reste.
 *
 * Une configuration illisible rend les noms du format : le chargement la
 * signale, et un référentiel se lit même quand sa configuration est fautive.
 */
export function lireNoms(root) {
  try {
    return resoudreNoms(load(readFileSync(join(root, 'ssk-canon.yml'), 'utf8')));
  } catch {
    return resoudreNoms(null);
  }
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
  // Les cibles d'architecture sont indexées à part des règles : elles suivent
  // le même régime de projection, mais se consultent séparément — on ne lit pas
  // un dossier d'architecture pour y chercher le comportement du produit.
  const decisions = new Map();
  const architecture = new Map();

  let config = null;
  try {
    config = load(readFileSync(join(root, 'ssk-canon.yml'), 'utf8'));
  } catch (e) {
    errors.push(`ssk-canon.yml : ${e.message}`);
  }

  // Les noms que le référentiel déclare — RG-noms-declares. Une déclaration
  // fautive est écartée ici sans bruit : la vérification la signale, et la
  // signaler deux fois ferait douter du nombre de fautes.
  const noms = resoudreNoms(config);
  const repertoireCadrages = noms.dossiers.cadrages;

  // le dossier de chaque collection, sous son nom déclaré
  const collectionDuDossier = new Map(
    Object.entries(DOSSIER_DE_COLLECTION).map(([collection, cle]) => [noms.dossiers[cle], collection]),
  );
  const collections = { domains, features, rules, cadrages, decisions, architecture };

  const chemins = listChemins(root).sort();
  for (const rel of chemins) {
    if (!rel.endsWith('.md')) continue;
    const file = join(root, ...rel.split('/'));
    const parts = rel.split('/');
    const collection = collectionDuDossier.get(parts[0]);

    // les fichiers hors des répertoires de contenu (README et compagnie) ne
    // sont pas des entités : on les ignore sans rien en dire
    if (parts.length < 2 || !collection) continue;

    // Un README à l'intérieur d'un répertoire de contenu n'en est pas une non
    // plus : il explique ce que le répertoire attend, ce qui est utile à qui
    // ouvre le dépôt sur la plateforme. Le traiter comme une entité ferait
    // échouer la vérification sur de la documentation.
    if (parts.at(-1) === 'README.md') continue;

    // Les fichiers rattachés à un cadrage — décisions, pièces jointes — sont
    // chargés plus bas, avec leur cadrage. Les traiter ici aussi signalerait
    // deux fois la même erreur.
    if (collection === 'cadrages' && !(parts.length === 3 && parts[2] === noms.fichiers.cadrage)) continue;

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
    // le chemin garde le séparateur du système, comme avant que les noms ne
    // se déclarent : les messages le citent tel que le rédacteur le tape
    collections[collection].set(data.id, { ...data, path: parts.join(sep), body });
    // les décisions de cadrage et pièces jointes sont rattachées à leur cadrage plus bas
  }

  // L'identité visuelle n'est pas un contenu : ses fichiers ne sont pas des
  // entités, et seuls leur nom et leur poids comptent — RG-identite-du-projet.
  let identite = [];
  try {
    identite = listFichiers(join(root, noms.dossiers.identite)).sort((a, b) =>
      a.chemin.localeCompare(b.chemin),
    );
  } catch {
    // pas d'identité, cas normal
  }

  // rattachement des décisions et pièces jointes
  for (const [id, c] of cadrages) {
    const dir = join(root, repertoireCadrages, id);
    c.decisions = [];
    try {
      for (const f of listMarkdown(join(dir, noms.dossiers.decisions_cadrage)).sort()) {
        const parsed = splitFrontmatter(readFileSync(f, 'utf8'));
        if (!parsed) errors.push(`${relative(root, f)} : frontmatter absent`);
        else if (parsed.erreur) errors.push(`${relative(root, f)} : ${parsed.erreur}`);
        else c.decisions.push({ ...parsed.data, body: parsed.body });
      }
    } catch { /* pas de décisions, cas normal */ }

    try {
      const parsed = splitFrontmatter(readFileSync(join(dir, noms.fichiers.pieces_jointes), 'utf8'));
      if (parsed?.erreur)
        errors.push(`${repertoireCadrages}/${id}/${noms.fichiers.pieces_jointes} : ${parsed.erreur}`);
      c.attachments = parsed?.data?.attachments ?? [];
    } catch {
      // absence de fichier : cas normal, un cadrage n'a pas toujours de pièces
      c.attachments = [];
    }
  }

  return {
    config,
    noms,
    chemins,
    domains,
    features,
    rules,
    cadrages,
    decisions,
    architecture,
    identite,
    errors,
  };
}
