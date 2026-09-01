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
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Les deux skills, et ce qui compose chacun.
 *
 * Celui-ci se surveille lui-même : un outil de maintenance exclu de sa propre
 * surveillance diverge sans que rien ne le dise, et c'est précisément ce qu'il
 * existe pour empêcher.
 */
const SKILLS = [
  { nom: 'cadrage-canon', fichiers: ['SKILL.md', 'scripts/situer.mjs'] },
  { nom: 'cadrage-canon-update', fichiers: ['SKILL.md', 'scripts/comparer.mjs'] },
];

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
    const r = await fetch(`${RACINE_PUBLIE}/${chemin}`);
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

for (const skill of SKILLS) {
  console.log(`\n━━ ${skill.nom}`);
  const installe = join(RACINE_INSTALLE, skill.nom);
  const source = join(RACINE_SOURCE, skill.nom);

  for (const f of skill.fichiers) {
    const i = local(installe, f);
    const s = local(source, f);
    const p = await publie(`${skill.nom}/${f}`);
    if (p === undefined) sansReseau = true;

    console.log(`\n  ${f}`);
    console.log(`    installé  ${dire(i)}`);
    console.log(`    source    ${dire(s)}`);
    console.log(`    publié    ${dire(p)}`);

    if (s === null) {
      console.log('    → SOURCE ABSENTE : le dépôt n’est pas cloné à cet endroit.');
      divergent = true;
      continue;
    }
    if (i !== s) {
      console.log(
        i === null
          ? '    → pas installé chez vous.'
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
