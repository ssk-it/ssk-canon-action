#!/usr/bin/env node
/**
 * Compare les trois exemplaires du skill de cadrage.
 *
 * Le skill existe installé chez le développeur, en source dans le dépôt de
 * l'automatisation, et publié sur la branche principale. Modifier la copie
 * installée est le piège : le changement fonctionne chez soi, disparaît à la
 * réinstallation suivante, et n'atteint personne. Ce script montre lequel a
 * bougé avant qu'on n'écrase quoi que ce soit.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Les skills surveillés.
 *
 * Celui-ci se surveille lui-même : un outil de maintenance exclu de sa propre
 * surveillance diverge sans que rien ne le dise, et c'est précisément ce qu'il
 * existe pour empêcher.
 */
const SKILLS = ['cadrage-canon', 'cadrage-canon-update'];

/**
 * Ce qui compose un skill, découvert et non énuméré.
 *
 * Une liste écrite à la main oublie le fichier suivant : `preparer.mjs` a été
 * ajouté et n'était surveillé par rien, alors qu'il pouvait diverger comme les
 * autres. Ce que la source contient fait foi.
 */
function fichiersDuSkill(racine) {
  const trouves = [];
  const parcourir = (rel) => {
    const abs = join(racine, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const suivant = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) parcourir(suivant);
      else trouves.push(suivant);
    }
  };
  parcourir('');
  return trouves.sort();
}

const RACINE_INSTALLE = join(homedir(), '.claude', 'skills');
const RACINE_SOURCE = join(homedir(), 'dev', 'ssk-it', 'ssk-canon-action', 'skills');
const RACINE_PUBLIE =
  'https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/skills';

const empreinte = (texte) => createHash('sha256').update(texte).digest('hex').slice(0, 12);

function local(racine, fichier) {
  const chemin = join(racine, fichier);
  return existsSync(chemin) ? empreinte(readFileSync(chemin, 'utf8')) : null;
}

async function publie(chemin) {
  try {
    // Sans compression, délibérément : le CDN garde une entrée de cache par
    // encodage, et la variante compressée — celle que `fetch` demande d'office —
    // peut servir l'ancien contenu quand la variante brute est déjà à jour.
    // Mesuré : `curl` et `fetch` rendaient deux versions de la même URL, et le
    // script annonçait « un changement attend d'être fusionné » alors que tout
    // l'était.
    const r = await fetch(`${RACINE_PUBLIE}/${chemin}`, {
      headers: { 'Accept-Encoding': 'identity' },
    });
    return r.ok ? empreinte(await r.text()) : null;
  } catch {
    // Sans réseau, la comparaison locale reste utile : la dire partielle plutôt
    // que de laisser croire que le publié est absent.
    return undefined;
  }
}

let divergent = false;
let sansReseau = false;
const dire = (v) => (v === null ? 'ABSENT' : v === undefined ? '?' : v);

for (const nom of SKILLS) {
  console.log(`\n━━ ${nom}`);
  const installe = join(RACINE_INSTALLE, nom);
  const source = join(RACINE_SOURCE, nom);

  // Les deux côtés réunis : un fichier retiré de la source mais resté installé
  // est une divergence autant qu'un fichier neuf.
  const fichiers = [
    ...new Set([...fichiersDuSkill(source), ...fichiersDuSkill(installe)]),
  ].sort();

  if (fichiers.length === 0) {
    console.log('  → SOURCE ABSENTE : le dépôt n’est pas cloné à cet endroit.');
    divergent = true;
    continue;
  }

  for (const f of fichiers) {
    const i = local(installe, f);
    const s = local(source, f);
    const p = await publie(`${nom}/${f}`);
    if (p === undefined) sansReseau = true;

    console.log(`\n  ${f}`);
    console.log(`    installé  ${dire(i)}`);
    console.log(`    source    ${dire(s)}`);
    console.log(`    publié    ${dire(p)}`);

    if (s === null) {
      // Le répertoire source existe — on y a listé des fichiers — donc c'est ce
      // fichier-ci qui n'y est pas : un reliquat d'une version précédente, ou
      // quelque chose qui n'a jamais été publié.
      console.log(
        '    → ABSENT DE LA SOURCE : fichier installé qui n’existe pas dans le ' +
          'dépôt. Reliquat d’une version antérieure, ou travail jamais publié.',
      );
      divergent = true;
      continue;
    }
    if (i !== s) {
      // Le publié départage : si l'installé lui est identique, c'est la source
      // qui a bougé — un travail en cours, non une copie modifiée sur place. Les
      // confondre enverrait chercher une modification locale qui n'existe pas.
      const enCours = p !== undefined && i === p;
      console.log(
        i === null
          ? '    → pas installé chez vous.'
          : enCours
            ? '    → SOURCE MODIFIÉE : travail en cours dans le dépôt, pas encore ' +
              'publié ni réinstallé. Rien à récupérer.'
            : '    → INSTALLÉ ≠ SOURCE : une copie a été modifiée sur place. Récupérer ' +
              'ce qu’elle porte avant de la remplacer.',
      );
      divergent = true;
    }
    if (p !== undefined && s !== p) {
      console.log('    → SOURCE ≠ PUBLIÉ : un changement attend d’être fusionné.');
      divergent = true;
    }
  }
}

console.log(`\ninstallé  ${RACINE_INSTALLE}`);
console.log(`source    ${RACINE_SOURCE}`);

console.log(
  divergent
    ? '\nLes exemplaires divergent — voir ci-dessus avant de modifier.'
    : sansReseau
      ? '\nInstallé et source concordent ; le publié n’a pas pu être joint.'
      : '\nLes trois exemplaires concordent.',
);
