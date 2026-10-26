// Tests des anomalies de la lecture du format — RG-anomalies-codees.
//
// Ce qu'ils protègent : un frontmatter illisible, absent, ou une configuration
// qui ne se lit pas se signalent par un code, dont le message se dit en
// français et en anglais. La forme textuelle d'hier, que l'interface lit
// encore (`splitFrontmatter(...).erreur`), doit rester mot pour mot la même.
//
//   node test/lecture.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { splitFrontmatter } from '../src/format.mjs';
import { loadRepo } from '../src/parse.mjs';
import { checkRepo } from '../src/verifier.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';

let reussis = 0;
const echecs = [];

async function test(nom, fn) {
  try {
    await fn();
    reussis += 1;
  } catch (erreur) {
    echecs.push(`${nom} : ${erreur.message}`);
  }
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

const egal = (obtenu, attendu) =>
  vrai(JSON.stringify(obtenu) === JSON.stringify(attendu), `\n    obtenu  ${JSON.stringify(obtenu)}\n    attendu ${JSON.stringify(attendu)}`);

// --- le frontmatter, sans disque ---

await test('un « : » dans une valeur non quotée a son code, et le conseil des apostrophes', () => {
  const lu = splitFrontmatter('---\nid: x\ntitre: Choix : le bon\n---\n');
  egal(lu.anomalie.code, 'frontmatter-deux-points');
  egal(lu.anomalie.gravite, 'erreur');
  egal(
    lu.erreur,
    'frontmatter illisible ligne 3 : bad indentation of a mapping entry — une valeur contenant « : » doit être entre apostrophes',
  );
  egal(formaterAnomalie(lu.anomalie, 'fr'), lu.erreur);
  egal(
    formaterAnomalie(lu.anomalie, 'en'),
    'unreadable frontmatter at line 3: bad indentation of a mapping entry — a value containing “:” must be in single quotes',
  );
});

await test('un frontmatter illisible pour une autre cause garde la raison de YAML', () => {
  const lu = splitFrontmatter('---\nid: [x\n---\n');
  egal(lu.anomalie.code, 'frontmatter-illisible');
  egal(lu.erreur, 'frontmatter illisible ligne 2 : unexpected end of the stream within a flow collection');
  egal(formaterAnomalie(lu.anomalie, 'fr'), lu.erreur);
  egal(
    formaterAnomalie(lu.anomalie, 'en'),
    'unreadable frontmatter at line 2: unexpected end of the stream within a flow collection',
  );
});

await test('sans ligne connue, le message n’en cite pas', () => {
  const sans = { code: 'frontmatter-illisible', gravite: 'erreur', params: { ligne: null, raison: 'r' } };
  egal(formaterAnomalie(sans, 'fr'), 'frontmatter illisible : r');
  egal(formaterAnomalie(sans, 'en'), 'unreadable frontmatter: r');
});

await test('un frontmatter lu ou absent n’a pas d’anomalie', () => {
  egal(splitFrontmatter('pas de frontmatter'), null);
  vrai(!('anomalie' in splitFrontmatter('---\nid: x\n---\ncorps')), 'anomalie sur un frontmatter lu');
});

// --- le chargement d'un dépôt ---

function depot(fn) {
  const racine = mkdtempSync(join(tmpdir(), 'canon-lecture-'));
  try {
    return fn(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

function ecrire(racine, chemin, contenu) {
  const complet = join(racine, ...chemin.split('/'));
  mkdirSync(join(complet, '..'), { recursive: true });
  writeFileSync(complet, contenu);
}

const fautif = (racine) => {
  ecrire(racine, 'ssk-canon.yml', 'projet: [\n');
  ecrire(racine, 'rules/RG-a.md', 'pas de frontmatter\n');
  ecrire(racine, 'rules/RG-b.md', '---\nid: RG-b\ntitre: Choix : le bon\n---\n');
  ecrire(racine, 'cadrages/2026-001/cadrage.md', '---\nid: 2026-001\n---\n');
  ecrire(racine, 'cadrages/2026-001/decisions/01-x.md', 'rien\n');
  ecrire(racine, 'cadrages/2026-001/decisions/02-y.md', '---\ntitre: a: b\n---\n');
  ecrire(racine, 'cadrages/2026-001/attachments.md', '---\nattachments: [\n---\n');
};

await test('les erreurs de chargement sont codées, et errors en reste la forme française d’hier', () =>
  depot((racine) => {
    fautif(racine);
    const repo = loadRepo(racine);
    egal(
      repo.anomalies.map((a) => a.code),
      [
        'config-illisible',
        'frontmatter-absent',
        'frontmatter-deux-points',
        'frontmatter-absent',
        'frontmatter-deux-points',
        'frontmatter-illisible',
      ],
    );
    const fr = repo.anomalies.map((a) => formaterAnomalie(a, 'fr'));
    egal(repo.errors, fr);
    vrai(fr[0].startsWith('ssk-canon.yml : '), fr[0]);
    egal(fr.slice(1), [
      'rules/RG-a.md : frontmatter absent ou mal formé',
      'rules/RG-b.md : frontmatter illisible ligne 3 : bad indentation of a mapping entry — une valeur contenant « : » doit être entre apostrophes',
      'cadrages/2026-001/decisions/01-x.md : frontmatter absent',
      'cadrages/2026-001/decisions/02-y.md : frontmatter illisible ligne 2 : bad indentation of a mapping entry — une valeur contenant « : » doit être entre apostrophes',
      'cadrages/2026-001/attachments.md : frontmatter illisible ligne 2 : unexpected end of the stream within a flow collection',
    ]);
    // la vérification les rend en texte, mot pour mot
    const { errors } = checkRepo(repo);
    for (const e of fr) vrai(errors.includes(e), `${e} absent de ${errors.join(' | ')}`);
  }));

await test('les erreurs de chargement se disent en anglais', () =>
  depot((racine) => {
    fautif(racine);
    const en = loadRepo(racine).anomalies.map((a) => formaterAnomalie(a, 'en'));
    vrai(en[0].startsWith('ssk-canon.yml: unreadable — '), en[0]);
    egal(en.slice(1), [
      'rules/RG-a.md: frontmatter missing or malformed',
      'rules/RG-b.md: unreadable frontmatter at line 3: bad indentation of a mapping entry — a value containing “:” must be in single quotes',
      'cadrages/2026-001/decisions/01-x.md: frontmatter missing or malformed',
      'cadrages/2026-001/decisions/02-y.md: unreadable frontmatter at line 2: bad indentation of a mapping entry — a value containing “:” must be in single quotes',
      'cadrages/2026-001/attachments.md: unreadable frontmatter at line 2: unexpected end of the stream within a flow collection',
    ]);
  }));

await test('une configuration absente a son propre code', () =>
  depot((racine) => {
    ecrire(racine, 'rules/RG-a.md', '---\nid: RG-a\n---\n');
    const repo = loadRepo(racine);
    egal(repo.anomalies.map((a) => a.code), ['config-absente']);
    vrai(formaterAnomalie(repo.anomalies[0], 'fr').startsWith('ssk-canon.yml : ENOENT'), formaterAnomalie(repo.anomalies[0], 'fr'));
    vrai(formaterAnomalie(repo.anomalies[0], 'en').startsWith('ssk-canon.yml: not found — ENOENT'), formaterAnomalie(repo.anomalies[0], 'en'));
  }));

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
