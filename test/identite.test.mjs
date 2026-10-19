// Tests du contrôle de l'identité visuelle — RG-identite-du-projet.
//
// Ce qu'ils protègent : l'identité ne se déclare nulle part, c'est le nom des
// fichiers qui fait foi. Un fichier mal nommé serait donc ignoré sans bruit, et
// une image trop lourde pèserait sur chaque clone du référentiel. La règle vit
// dans la bibliothèque partagée : l'application en reprend la liste des noms,
// des formats et l'ordre de préférence.
//
//   node test/identite.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkIdentite,
  lireNomIdentite,
  FORMATS_IDENTITE,
  ELEMENTS_IDENTITE,
  VARIANTES_IDENTITE,
  POIDS_MAX_IDENTITE,
  REPERTOIRE_IDENTITE,
} from '../src/identite.mjs';
import { checkRepo } from '../src/verifier.mjs';
import { loadRepo } from '../src/parse.mjs';
import { check } from '../src/check.mjs';

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

const petit = (chemin) => ({ chemin, taille: 800 });

// --- la règle, sur une liste de fichiers ---

await test('l’identité de Skaron passe sans rien signaler', () => {
  const { errors, warnings } = checkIdentite(
    ['symbole-clair.svg', 'symbole-sombre.svg', 'logotype-clair.svg', 'logotype-sombre.svg'].map(petit),
  );
  vrai(!errors.length, `erreurs : ${errors.join(' | ')}`);
  vrai(!warnings.length, `avertissements : ${warnings.join(' | ')}`);
});

await test('un nom inconnu est une erreur, qui dit les noms admis', () => {
  const { errors } = checkIdentite([petit('symbol-clair.svg')]);
  vrai(errors.length === 1, `${errors.length} erreur(s) : ${errors.join(' | ')}`);
  vrai(errors[0].includes('identite/symbol-clair.svg'), `le fichier n’est pas nommé : ${errors[0]}`);
  vrai(/symbole/.test(errors[0]) && /logotype/.test(errors[0]), `les noms admis manquent : ${errors[0]}`);
});

await test('le nom est sensible à la casse', () => {
  const { errors } = checkIdentite([petit('Symbole.svg')]);
  vrai(errors.length === 1, `${errors.length} erreur(s)`);
});

await test('un format non admis est une erreur, qui dit les formats admis', () => {
  const { errors } = checkIdentite([petit('symbole.jpg')]);
  vrai(errors.length === 1, `${errors.length} erreur(s) : ${errors.join(' | ')}`);
  vrai(/format/.test(errors[0]), `l’erreur ne parle pas de format : ${errors[0]}`);
  for (const f of ['svg', 'webp', 'png'])
    vrai(errors[0].includes(f), `le format ${f} n’est pas cité : ${errors[0]}`);
});

await test('un fichier trop lourd est une erreur, qui dit la borne', () => {
  const { errors } = checkIdentite([{ chemin: 'logotype.png', taille: 400 * 1024 }]);
  vrai(errors.length === 1, `${errors.length} erreur(s)`);
  vrai(errors[0].includes('100 Kio'), `la borne n’est pas dite : ${errors[0]}`);
  vrai(errors[0].includes('400 Kio'), `le poids n’est pas dit : ${errors[0]}`);
});

await test('la borne est de 100 Kio inclus', () => {
  vrai(POIDS_MAX_IDENTITE === 102400, `borne : ${POIDS_MAX_IDENTITE}`);
  vrai(!checkIdentite([{ chemin: 'symbole.png', taille: 102400 }]).errors.length, '100 Kio refusés');
  vrai(checkIdentite([{ chemin: 'symbole.png', taille: 102401 }]).errors.length === 1, '100 Kio et un octet admis');
});

await test('le fichier d’accueil est admis', () => {
  const { errors, warnings } = checkIdentite([petit('README.md'), petit('symbole.svg')]);
  vrai(!errors.length, `erreurs : ${errors.join(' | ')}`);
  vrai(!warnings.length, `avertissements : ${warnings.join(' | ')}`);
});

await test('un sous-répertoire n’est pas admis', () => {
  const { errors } = checkIdentite([petit('anciens/symbole.svg')]);
  vrai(errors.length === 1, `${errors.length} erreur(s)`);
  vrai(errors[0].includes('identite/anciens/symbole.svg'), errors[0]);
});

await test('un même nom en plusieurs formats avertit, et dit lequel est employé', () => {
  const { errors, warnings } = checkIdentite([petit('symbole.png'), petit('symbole.svg'), petit('symbole.webp')]);
  vrai(!errors.length, `erreurs : ${errors.join(' | ')}`);
  vrai(warnings.length === 1, `${warnings.length} avertissement(s) : ${warnings.join(' | ')}`);
  vrai(/svg.*employé/.test(warnings[0]), `le format employé n’est pas dit : ${warnings[0]}`);
});

await test('le WebP l’emporte sur le PNG', () => {
  const { warnings } = checkIdentite([petit('logotype-sombre.png'), petit('logotype-sombre.webp'), petit('logotype-clair.svg')]);
  const doublon = warnings.find((w) => w.includes('logotype-sombre'));
  vrai(/webp.*employé/.test(doublon ?? ''), `avertissement : ${doublon}`);
});

await test('une variante sans sa jumelle avertit', () => {
  const { errors, warnings } = checkIdentite([petit('symbole-clair.svg')]);
  vrai(!errors.length, `erreurs : ${errors.join(' | ')}`);
  vrai(warnings.length === 1, `${warnings.length} avertissement(s)`);
  vrai(warnings[0].includes('symbole-sombre'), `la jumelle n’est pas nommée : ${warnings[0]}`);
});

await test('une version sans suffixe couvre l’autre fond', () => {
  const { warnings } = checkIdentite([petit('symbole-clair.svg'), petit('symbole.svg')]);
  vrai(!warnings.length, `avertissements : ${warnings.join(' | ')}`);
});

await test('la jumelle peut être d’un autre format', () => {
  const { warnings } = checkIdentite([petit('symbole-clair.svg'), petit('symbole-sombre.png')]);
  vrai(!warnings.length, `avertissements : ${warnings.join(' | ')}`);
});

await test('un fichier refusé ne compte pas comme jumelle', () => {
  const { warnings } = checkIdentite([petit('symbole-clair.svg'), petit('symbole-sombre.jpg')]);
  vrai(warnings.some((w) => w.includes('symbole-sombre')), `avertissements : ${warnings.join(' | ')}`);
});

// --- ce que l'application reprend ---

await test('la bibliothèque expose les noms, les variantes et les formats dans l’ordre', () => {
  vrai(REPERTOIRE_IDENTITE === 'identite', REPERTOIRE_IDENTITE);
  vrai(JSON.stringify(ELEMENTS_IDENTITE) === '["symbole","logotype"]', JSON.stringify(ELEMENTS_IDENTITE));
  vrai(JSON.stringify(VARIANTES_IDENTITE) === '["clair","sombre"]', JSON.stringify(VARIANTES_IDENTITE));
  vrai(JSON.stringify(FORMATS_IDENTITE) === '["svg","webp","png"]', JSON.stringify(FORMATS_IDENTITE));
});

await test('un nom se lit en élément, variante et format', () => {
  const lu = lireNomIdentite('logotype-sombre.webp');
  vrai(lu?.element === 'logotype' && lu.variante === 'sombre' && lu.format === 'webp', JSON.stringify(lu));
  const sansSuffixe = lireNomIdentite('symbole.svg');
  vrai(sansSuffixe?.variante === null, JSON.stringify(sansSuffixe));
  vrai(lireNomIdentite('symbole.jpg') === null, 'un format refusé est lu comme une identité');
  vrai(lireNomIdentite('README.md') === null, 'le fichier d’accueil est lu comme une identité');
  vrai(lireNomIdentite('symbole-gris.svg') === null, 'une variante inconnue est lue');
});

await test('le paquet exporte la règle, à sa racine et sous /identite', async () => {
  const racine = await import('@ssk-it/canon-check');
  const module = await import('@ssk-it/canon-check/identite');
  vrai(racine.checkIdentite === checkIdentite, 'checkIdentite absent de la racine du paquet');
  vrai(module.FORMATS_IDENTITE === FORMATS_IDENTITE, 'FORMATS_IDENTITE absent de /identite');
  const paquet = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  for (const f of ['src/identite.mjs', 'src/identite.d.ts'])
    vrai(paquet.files.includes(f), `${f} n’est pas publié`);
});

// --- dans la vérification d'un référentiel ---

const vide = () => ({
  domains: new Map(),
  features: new Map(),
  rules: new Map(),
  cadrages: new Map(),
  errors: [],
});

await test('checkRepo contrôle l’identité qu’on lui passe', () => {
  const { errors, warnings } = checkRepo({
    ...vide(),
    identite: [petit('symbol.svg'), petit('logotype-clair.svg')],
  });
  vrai(errors.some((e) => e.includes('identite/symbol.svg')), `erreurs : ${errors.join(' | ')}`);
  vrai(warnings.some((w) => w.includes('logotype-sombre')), `avertissements : ${warnings.join(' | ')}`);
});

await test('checkRepo sans identité ne dit rien de l’identité', () => {
  const { errors, warnings } = checkRepo(vide());
  vrai(!errors.length && !warnings.length, [...errors, ...warnings].join(' | '));
});

function depot(fn) {
  const racine = mkdtempSync(join(tmpdir(), 'pc-identite-'));
  try {
    writeFileSync(join(racine, 'ssk-canon.yml'), 'schema_version: 1\n');
    return fn(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

await test('le chargement lit le répertoire avec le poids de chaque fichier', () =>
  depot((racine) => {
    mkdirSync(join(racine, 'identite'));
    writeFileSync(join(racine, 'identite', 'symbole.svg'), '<svg/>');
    writeFileSync(join(racine, 'identite', 'logotype.png'), Buffer.alloc(400 * 1024));
    const { identite } = loadRepo(racine);
    const parChemin = new Map(identite.map((f) => [f.chemin, f.taille]));
    vrai(parChemin.get('symbole.svg') === 6, JSON.stringify(identite));
    vrai(parChemin.get('logotype.png') === 400 * 1024, JSON.stringify(identite));

    const { errors } = check(racine, { livres: new Set() });
    vrai(errors.some((e) => e.includes('identite/logotype.png') && e.includes('100 Kio')), errors.join(' | '));
  }));

await test('un sous-répertoire est lu, pour être refusé', () =>
  depot((racine) => {
    mkdirSync(join(racine, 'identite', 'anciens'), { recursive: true });
    writeFileSync(join(racine, 'identite', 'anciens', 'symbole.svg'), '<svg/>');
    const { identite } = loadRepo(racine);
    vrai(identite.some((f) => f.chemin === 'anciens/symbole.svg'), JSON.stringify(identite));
  }));

await test('le Markdown d’identite/ n’est pas lu comme une entité', () =>
  depot((racine) => {
    mkdirSync(join(racine, 'identite'));
    writeFileSync(join(racine, 'identite', 'README.md'), '# Identité\n\nLe symbole de Skaron.\n');
    writeFileSync(join(racine, 'identite', 'notes.md'), 'Sans frontmatter.\n');
    const { errors } = check(racine, { livres: new Set() });
    vrai(!errors.some((e) => /frontmatter/.test(e)), `lu comme une entité : ${errors.join(' | ')}`);
    vrai(errors.some((e) => e.includes('identite/notes.md')), `notes.md admis : ${errors.join(' | ')}`);
  }));

await test('un référentiel sans identité n’en dit rien', () =>
  depot((racine) => {
    const repo = loadRepo(racine);
    vrai(Array.isArray(repo.identite) && !repo.identite.length, JSON.stringify(repo.identite));
    vrai(!repo.errors.length, repo.errors.join(' | '));
  }));

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
