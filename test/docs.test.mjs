// Tests de la documentation : les liens relatifs et les deux langues.
//
// Ce qu'ils protègent : une page déplacée ou un titre reformulé casse en
// silence les liens qui y menaient — GitHub affiche un 404 ou reste en haut de
// la page, et rien ne le signale. La version anglaise, elle, ne vaut que si
// elle suit la française : une page ajoutée d'un seul côté doit se voir.
//
//   node test/docs.test.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

let reussis = 0;
const echecs = [];

function test(nom, fn) {
  try {
    fn();
    reussis += 1;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  }
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

const racine = fileURLToPath(new URL('..', import.meta.url));
const lire = (chemin) => readFileSync(join(racine, chemin), 'utf8');
const pagesDe = (dossier) =>
  readdirSync(join(racine, dossier)).filter((nom) => nom.endsWith('.md')).sort();

const PAGES = [
  'README.md',
  'README.en.md',
  ...pagesDe('docs').map((nom) => `docs/${nom}`),
  ...pagesDe('docs/en').map((nom) => `docs/en/${nom}`),
  ...readdirSync(join(racine, 'skills')).map((skill) => `skills/${skill}/SKILL.md`),
];

// Le texte hors des blocs de code : un lien d'exemple n'y est pas un lien.
const horsCode = (texte) => texte.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');

// L'ancre que GitHub donne à un titre : en minuscules, sans ponctuation, les
// espaces changés en tirets ; les lettres accentuées restent.
function ancre(titre) {
  return titre
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function ancresDe(chemin) {
  const vues = new Map();
  const ancres = new Set();
  for (const [, titre] of lire(chemin).replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6} +(.+?) *$/gm)) {
    const base = ancre(titre);
    const n = vues.get(base) ?? 0;
    vues.set(base, n + 1);
    ancres.add(n ? `${base}-${n}` : base);
  }
  return ancres;
}

for (const page of PAGES) {
  test(`${page} : chaque lien relatif mène à un fichier, et à un titre quand il porte une ancre`, () => {
    const casses = [];
    for (const [, cible] of horsCode(lire(page)).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z][a-z+.-]*:/i.test(cible)) continue;
      const [chemin, fragment] = cible.split('#');
      const fichier = chemin ? relative(racine, join(racine, dirname(page), chemin)) : page;
      if (!existsSync(join(racine, fichier))) {
        casses.push(`${cible} (fichier absent)`);
        continue;
      }
      if (fragment && fichier.endsWith('.md') && !ancresDe(fichier).has(decodeURIComponent(fragment)))
        casses.push(`${cible} (aucun titre n'a cette ancre)`);
    }
    vrai(!casses.length, casses.join(' | '));
  });
}

test('chaque page de docs/ a sa traduction sous docs/en/, et réciproquement', () => {
  const fr = pagesDe('docs');
  const en = pagesDe('docs/en');
  const seules = [
    ...fr.filter((nom) => !en.includes(nom)).map((nom) => `docs/${nom} sans docs/en/${nom}`),
    ...en.filter((nom) => !fr.includes(nom)).map((nom) => `docs/en/${nom} sans docs/${nom}`),
  ];
  vrai(!seules.length, seules.join(' | '));
});

test('chaque page renvoie en tête à sa traduction', () => {
  const paires = [
    ['README.md', 'README.en.md', 'README.en.md'],
    ['README.en.md', 'README.md', 'README.md'],
    ...pagesDe('docs').flatMap((nom) => [
      [`docs/${nom}`, `en/${nom}`],
      [`docs/en/${nom}`, `../${nom}`],
    ]),
  ];
  const sans = paires
    .filter(([page, lien]) => !lire(page).split('\n')[0].includes(`](${lien})`))
    .map(([page, lien]) => `${page} ne renvoie pas à ${lien} sur sa première ligne`);
  vrai(!sans.length, sans.join(' | '));
});

test('les deux sommaires listent les mêmes pages', () => {
  const liens = (chemin) =>
    [...lire(chemin).matchAll(/\]\(docs\/(?:en\/)?([^)#]+\.md)/g)].map(([, nom]) => nom);
  const fr = [...new Set(liens('README.md'))];
  const en = [...new Set(liens('README.en.md'))];
  vrai(JSON.stringify(fr) === JSON.stringify(en), `README.md : ${fr.join(', ')} ; README.en.md : ${en.join(', ')}`);
  const absentes = pagesDe('docs').filter((nom) => !fr.includes(nom));
  vrai(!absentes.length, `pages absentes du sommaire : ${absentes.join(', ')}`);
});

// Les ancres du README que d'autres dépôts citent : ssk-it/ssk-canon renvoie
// à `#le-skill-de-cadrage`. Aucun test d'ici ne verrait ce lien casser.
test('les ancres du README citées par d’autres dépôts existent toujours', () => {
  const ancres = ancresDe('README.md');
  const manquantes = ['le-skill-de-cadrage', 'installation-dans-un-dépôt-cadré'].filter((a) => !ancres.has(a));
  vrai(!manquantes.length, `ancres disparues : ${manquantes.join(', ')}`);
});

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const e of echecs) console.error(`  ✗ ${e}`);
process.exit(echecs.length ? 1 : 0);
