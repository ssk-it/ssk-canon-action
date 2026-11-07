// Runs each page of the generated reference through axe-core, in light then in
// dark, against the A and AA criteria of WCAG 2.0 to 2.2; then checks with the
// keyboard that a collapsible section opens and closes. Exits with an error on
// the first discrepancy, so that CI does not publish a reference that regresses.
//
// Usage: npm run reference-api && npm run reference-api:accessibilite

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const SITE = join(import.meta.dirname, 'site');
const CRITERIA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const pages = readdirSync(SITE, { recursive: true })
  .filter((path) => path.endsWith('.html'))
  .map((path) => join(SITE, path))
  .sort();
if (pages.length === 0) {
  console.error(`Aucune page dans ${SITE} : lancer d'abord npm run reference-api.`);
  process.exit(1);
}

const browser = await chromium.launch();
let discrepancies = 0;

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ colorScheme: scheme });
  const tab = await context.newPage();
  for (const page of pages) {
    await tab.goto(pathToFileURL(page).href);
    // The side menu is built by an asynchronous script: analysing before it is
    // there would let its discrepancies through.
    await tab.waitForSelector('#tsd-nav-container li');
    await tab.addScriptTag({ content: AXE });
    const { violations } = await tab.evaluate(
      (criteria) => window.axe.run({ runOnly: criteria }),
      CRITERIA,
    );
    for (const violation of violations) {
      discrepancies++;
      console.error(`${relative(SITE, page)} (${scheme}) — ${violation.id} : ${violation.help}`);
      for (const node of violation.nodes) console.error(`    ${node.target.join(' ')}`);
    }
  }
  await context.close();
}

// With the permalink removed from the <summary>, the section title must stay
// reachable and operable with the keyboard alone.
{
  const tab = await browser.newPage();
  const module = pages.find((page) => page.endsWith('_pistes.html'));
  await tab.goto(pathToFileURL(module).href);
  const section = tab.locator('details.tsd-accordion:has(> summary h2)').first();
  const isOpen = () => section.evaluate((details) => details.open);
  const before = await isOpen();
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) {
    await tab.keyboard.press('Tab');
    reached = await section.evaluate((details) => document.activeElement === details.querySelector(':scope > summary'));
  }
  if (!reached) {
    discrepancies++;
    console.error('Clavier : aucune tabulation n’atteint le titre de la première section.');
  } else {
    await tab.keyboard.press('Enter');
    if ((await isOpen()) === before) {
      discrepancies++;
      console.error('Clavier : Entrée ne déplie ni ne replie la section.');
    }
  }
  await tab.close();
}

await browser.close();

if (discrepancies > 0) {
  console.error(`\n${discrepancies} écart(s) d’accessibilité.`);
  process.exit(1);
}
console.log(`${pages.length} pages, en clair et en sombre : aucun écart WCAG 2.2 AA relevé par axe ; sections dépliables manipulables au clavier.`);
