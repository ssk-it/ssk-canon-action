// Passe chaque page de la référence générée à axe-core, en clair puis en
// sombre, contre les critères A et AA de WCAG 2.0 à 2.2 ; puis vérifie au
// clavier qu'une section dépliable s'ouvre et se ferme. Sort en erreur au
// premier écart, pour que la CI ne publie pas une référence qui régresse.
//
// Usage : npm run reference-api && npm run reference-api:accessibilite

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const SITE = join(import.meta.dirname, 'site');
const CRITERES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const pages = readdirSync(SITE, { recursive: true })
  .filter((chemin) => chemin.endsWith('.html'))
  .map((chemin) => join(SITE, chemin))
  .sort();
if (pages.length === 0) {
  console.error(`Aucune page dans ${SITE} : lancer d'abord npm run reference-api.`);
  process.exit(1);
}

const navigateur = await chromium.launch();
let ecarts = 0;

for (const schema of ['light', 'dark']) {
  const contexte = await navigateur.newContext({ colorScheme: schema });
  const onglet = await contexte.newPage();
  for (const page of pages) {
    await onglet.goto(pathToFileURL(page).href);
    // Le menu latéral est construit par un script asynchrone : l'analyser avant
    // qu'il soit là laisserait passer ses écarts.
    await onglet.waitForSelector('#tsd-nav-container li');
    await onglet.addScriptTag({ content: AXE });
    const { violations } = await onglet.evaluate(
      (criteres) => window.axe.run({ runOnly: criteres }),
      CRITERES,
    );
    for (const violation of violations) {
      ecarts++;
      console.error(`${relative(SITE, page)} (${schema}) — ${violation.id} : ${violation.help}`);
      for (const noeud of violation.nodes) console.error(`    ${noeud.target.join(' ')}`);
    }
  }
  await contexte.close();
}

// Le permalien retiré du <summary>, le titre de section doit rester atteignable
// et manipulable au clavier seul.
{
  const onglet = await navigateur.newPage();
  const module = pages.find((page) => page.endsWith('_pistes.html'));
  await onglet.goto(pathToFileURL(module).href);
  const section = onglet.locator('details.tsd-accordion:has(> summary h2)').first();
  const ouverte = () => section.evaluate((details) => details.open);
  const avant = await ouverte();
  let atteinte = false;
  for (let i = 0; i < 60 && !atteinte; i++) {
    await onglet.keyboard.press('Tab');
    atteinte = await section.evaluate((details) => document.activeElement === details.querySelector(':scope > summary'));
  }
  if (!atteinte) {
    ecarts++;
    console.error('Clavier : aucune tabulation n’atteint le titre de la première section.');
  } else {
    await onglet.keyboard.press('Enter');
    if ((await ouverte()) === avant) {
      ecarts++;
      console.error('Clavier : Entrée ne déplie ni ne replie la section.');
    }
  }
  await onglet.close();
}

await navigateur.close();

if (ecarts > 0) {
  console.error(`\n${ecarts} écart(s) d’accessibilité.`);
  process.exit(1);
}
console.log(`${pages.length} pages, en clair et en sombre : aucun écart WCAG 2.2 AA relevé par axe ; sections dépliables manipulables au clavier.`);
