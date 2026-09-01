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

const FICHIERS = ['SKILL.md', 'scripts/situer.mjs'];
const INSTALLE = join(homedir(), '.claude', 'skills', 'cadrage-canon');
const SOURCE = join(homedir(), 'dev', 'ssk-it', 'ssk-canon-action', 'skills', 'cadrage-canon');
const PUBLIE =
  'https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/skills/cadrage-canon';

const empreinte = (texte) => createHash('sha256').update(texte).digest('hex').slice(0, 12);

function local(racine, fichier) {
  const chemin = join(racine, fichier);
  return existsSync(chemin) ? empreinte(readFileSync(chemin, 'utf8')) : null;
}

async function publie(fichier) {
  try {
    const r = await fetch(`${PUBLIE}/${fichier}`);
    return r.ok ? empreinte(await r.text()) : null;
  } catch {
    // Sans réseau, la comparaison locale reste utile : la dire partielle plutôt
    // que de laisser croire que le publié est absent.
    return undefined;
  }
}

let divergent = false;
let sansReseau = false;

for (const f of FICHIERS) {
  const i = local(INSTALLE, f);
  const s = local(SOURCE, f);
  const p = await publie(f);
  if (p === undefined) sansReseau = true;

  const dire = (v) => (v === null ? 'ABSENT' : v === undefined ? '?' : v);
  console.log(`\n${f}`);
  console.log(`  installé  ${dire(i)}  ${INSTALLE}`);
  console.log(`  source    ${dire(s)}  ${SOURCE}`);
  console.log(`  publié    ${dire(p)}  main`);

  if (s === null) {
    console.log('  → SOURCE ABSENTE : le dépôt n’est pas cloné à cet endroit.');
    divergent = true;
    continue;
  }
  if (i !== s) {
    console.log(
      i === null
        ? '  → pas installé chez vous.'
        : '  → INSTALLÉ ≠ SOURCE : une copie a été modifiée sur place. Récupérer ce ' +
          'qu’elle porte avant de la remplacer.',
    );
    divergent = true;
  }
  if (p !== undefined && s !== p) {
    console.log('  → SOURCE ≠ PUBLIÉ : un changement attend d’être fusionné.');
    divergent = true;
  }
}

console.log(
  divergent
    ? '\nLes exemplaires divergent — voir ci-dessus avant de modifier.'
    : sansReseau
      ? '\nInstallé et source concordent ; le publié n’a pas pu être joint.'
      : '\nLes trois exemplaires concordent.',
);
