// Tests of the visual identity check — RG-identite-du-projet.
//
// What they protect: the identity is declared nowhere, the file names are what
// counts. A misnamed file would therefore be ignored silently, and an image
// that is too heavy would weigh on every clone of the specification. The rule
// lives in the shared library: the application takes from it the list of
// names, the formats and the order of preference.
//
//   node test/identity.test.mjs

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
import { formaterAnomalie, enTexte } from '../src/anomalies.mjs';
import { loadRepo } from '../src/parse.mjs';
import { check } from '../src/check.mjs';

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const small = (chemin) => ({ chemin, taille: 800 });

// --- the rule, on a list of files ---

await test('Skaron’s identity passes without reporting anything', () => {
  const { errors, warnings } = checkIdentite(
    ['symbole-clair.svg', 'symbole-sombre.svg', 'logotype-clair.svg', 'logotype-sombre.svg'].map(small),
  );
  assert(!errors.length, `errors: ${errors.join(' | ')}`);
  assert(!warnings.length, `warnings: ${warnings.join(' | ')}`);
});

await test('an unknown name is an error, which states the allowed names', () => {
  const { errors } = checkIdentite([small('symbol-clair.svg')]);
  assert(errors.length === 1, `${errors.length} error(s): ${errors.join(' | ')}`);
  assert(errors[0].includes('identite/symbol-clair.svg'), `the file is not named: ${errors[0]}`);
  assert(/symbole/.test(errors[0]) && /logotype/.test(errors[0]), `the allowed names are missing: ${errors[0]}`);
});

await test('the name is case-sensitive', () => {
  const { errors } = checkIdentite([small('Symbole.svg')]);
  assert(errors.length === 1, `${errors.length} error(s)`);
});

await test('a format not allowed is an error, which states the allowed formats', () => {
  const { errors } = checkIdentite([small('symbole.jpg')]);
  assert(errors.length === 1, `${errors.length} error(s): ${errors.join(' | ')}`);
  assert(/format/.test(errors[0]), `the error does not mention the format: ${errors[0]}`);
  for (const f of ['svg', 'webp', 'png'])
    assert(errors[0].includes(f), `format ${f} is not cited: ${errors[0]}`);
});

await test('a file that is too heavy is an error, which states the limit', () => {
  const { errors } = checkIdentite([{ chemin: 'logotype.png', taille: 400 * 1024 }]);
  assert(errors.length === 1, `${errors.length} error(s)`);
  assert(errors[0].includes('100 Kio'), `the limit is not stated: ${errors[0]}`);
  assert(errors[0].includes('400 Kio'), `the size is not stated: ${errors[0]}`);
});

await test('the limit is 100 KiB inclusive', () => {
  assert(POIDS_MAX_IDENTITE === 102400, `limit: ${POIDS_MAX_IDENTITE}`);
  assert(!checkIdentite([{ chemin: 'symbole.png', taille: 102400 }]).errors.length, '100 KiB refused');
  assert(checkIdentite([{ chemin: 'symbole.png', taille: 102401 }]).errors.length === 1, '100 KiB and one byte allowed');
});

await test('the landing file is allowed', () => {
  const { errors, warnings } = checkIdentite([small('README.md'), small('symbole.svg')]);
  assert(!errors.length, `errors: ${errors.join(' | ')}`);
  assert(!warnings.length, `warnings: ${warnings.join(' | ')}`);
});

await test('a subfolder is not allowed', () => {
  const { errors } = checkIdentite([small('anciens/symbole.svg')]);
  assert(errors.length === 1, `${errors.length} error(s)`);
  assert(errors[0].includes('identite/anciens/symbole.svg'), errors[0]);
});

await test('the same name in several formats warns, and states which one is used', () => {
  const { errors, warnings } = checkIdentite([small('symbole.png'), small('symbole.svg'), small('symbole.webp')]);
  assert(!errors.length, `errors: ${errors.join(' | ')}`);
  assert(warnings.length === 1, `${warnings.length} warning(s): ${warnings.join(' | ')}`);
  assert(/svg.*employé/.test(warnings[0]), `the format used is not stated: ${warnings[0]}`);
});

await test('WebP wins over PNG', () => {
  const { warnings } = checkIdentite([small('logotype-sombre.png'), small('logotype-sombre.webp'), small('logotype-clair.svg')]);
  const duplicate = warnings.find((w) => w.includes('logotype-sombre'));
  assert(/webp.*employé/.test(duplicate ?? ''), `warning: ${duplicate}`);
});

await test('a variant without its twin warns', () => {
  const { errors, warnings } = checkIdentite([small('symbole-clair.svg')]);
  assert(!errors.length, `errors: ${errors.join(' | ')}`);
  assert(warnings.length === 1, `${warnings.length} warning(s)`);
  assert(warnings[0].includes('symbole-sombre'), `the twin is not named: ${warnings[0]}`);
});

await test('a version without suffix covers the other background', () => {
  const { warnings } = checkIdentite([small('symbole-clair.svg'), small('symbole.svg')]);
  assert(!warnings.length, `warnings: ${warnings.join(' | ')}`);
});

await test('the twin may be in another format', () => {
  const { warnings } = checkIdentite([small('symbole-clair.svg'), small('symbole-sombre.png')]);
  assert(!warnings.length, `warnings: ${warnings.join(' | ')}`);
});

await test('a refused file does not count as a twin', () => {
  const { warnings } = checkIdentite([small('symbole-clair.svg'), small('symbole-sombre.jpg')]);
  assert(warnings.some((w) => w.includes('symbole-sombre')), `warnings: ${warnings.join(' | ')}`);
});

// --- coded anomalies — RG-anomalies-codees ---

await test('each cause has its code, and errors and warnings remain their French form', () => {
  const r = checkIdentite([
    { chemin: 'logotype.png', taille: 400 * 1024 },
    small('symbol.svg'),
    small('symbole.jpg'),
    small('logotype.svg'),
    small('symbole-clair.svg'),
  ]);
  const codes = r.anomalies.map((a) => `${a.gravite}:${a.code}`);
  assert(
    codes.join() ===
      'erreur:identite-trop-lourde,erreur:identite-nom-non-admis,erreur:identite-format-non-admis,' +
        'avertissement:identite-plusieurs-formats,avertissement:identite-variante-seule',
    codes.join(),
  );
  const fr = enTexte(r.anomalies, 'fr');
  assert(JSON.stringify(fr.errors) === JSON.stringify(r.errors), r.errors.join(' | '));
  assert(JSON.stringify(fr.warnings) === JSON.stringify(r.warnings), r.warnings.join(' | '));
});

await test('the identity messages are said in English', () => {
  const r = checkIdentite([
    { chemin: 'logotype.png', taille: 400 * 1024 },
    small('symbol.svg'),
    small('symbole.jpg'),
    small('logotype.svg'),
    small('symbole-clair.svg'),
  ], 'marque');
  const en = r.anomalies.map((a) => formaterAnomalie(a, 'en'));
  const expected = [
    'marque/logotype.png: 400 KiB, above the limit of 100 KiB per file',
    'marque/symbol.svg: name not allowed — expected symbole or logotype, optionally followed by -clair or -sombre, or README.md',
    'marque/symbole.jpg: format not allowed — expected svg, webp or png',
    'marque/logotype: present as svg and png — the svg is used',
    'marque/symbole-clair: no symbole-sombre nor symbole without suffix — on a dark background, the application shows its fallback',
  ];
  assert(JSON.stringify(en) === JSON.stringify(expected), en.join(' | '));
});

// --- what the application takes ---

await test('the library exposes the names, the variants and the formats in order', () => {
  assert(REPERTOIRE_IDENTITE === 'identite', REPERTOIRE_IDENTITE);
  assert(JSON.stringify(ELEMENTS_IDENTITE) === '["symbole","logotype"]', JSON.stringify(ELEMENTS_IDENTITE));
  assert(JSON.stringify(VARIANTES_IDENTITE) === '["clair","sombre"]', JSON.stringify(VARIANTES_IDENTITE));
  assert(JSON.stringify(FORMATS_IDENTITE) === '["svg","webp","png"]', JSON.stringify(FORMATS_IDENTITE));
});

await test('a name is read as element, variant and format', () => {
  const read = lireNomIdentite('logotype-sombre.webp');
  assert(read?.element === 'logotype' && read.variante === 'sombre' && read.format === 'webp', JSON.stringify(read));
  const withoutSuffix = lireNomIdentite('symbole.svg');
  assert(withoutSuffix?.variante === null, JSON.stringify(withoutSuffix));
  assert(lireNomIdentite('symbole.jpg') === null, 'a refused format is read as an identity');
  assert(lireNomIdentite('README.md') === null, 'the landing file is read as an identity');
  assert(lireNomIdentite('symbole-gris.svg') === null, 'an unknown variant is read');
});

await test('the package exports the rule, at its root and under /identite', async () => {
  const root = await import('@ssk-it/canon-check');
  const module = await import('@ssk-it/canon-check/identite');
  assert(root.checkIdentite === checkIdentite, 'checkIdentite missing from the package root');
  assert(module.FORMATS_IDENTITE === FORMATS_IDENTITE, 'FORMATS_IDENTITE missing from /identite');
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  for (const f of ['src/identite.mjs', 'src/identite.d.ts'])
    assert(pkg.files.includes(f), `${f} is not published`);
});

// --- in the check of a specification ---

const empty = () => ({
  domains: new Map(),
  features: new Map(),
  rules: new Map(),
  cadrages: new Map(),
  errors: [],
});

await test('checkRepo checks the identity it is given', () => {
  const { errors, warnings } = checkRepo({
    ...empty(),
    identite: [small('symbol.svg'), small('logotype-clair.svg')],
  });
  assert(errors.some((e) => e.includes('identite/symbol.svg')), `errors: ${errors.join(' | ')}`);
  assert(warnings.some((w) => w.includes('logotype-sombre')), `warnings: ${warnings.join(' | ')}`);
});

await test('checkRepo without identity says nothing about the identity', () => {
  const { errors, warnings } = checkRepo(empty());
  assert(!errors.length && !warnings.length, [...errors, ...warnings].join(' | '));
});

function repo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'pc-identite-'));
  try {
    writeFileSync(join(root, 'ssk-canon.yml'), 'schema_version: 1\n');
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

await test('loading reads the folder with the size of each file', () =>
  repo((root) => {
    mkdirSync(join(root, 'identite'));
    writeFileSync(join(root, 'identite', 'symbole.svg'), '<svg/>');
    writeFileSync(join(root, 'identite', 'logotype.png'), Buffer.alloc(400 * 1024));
    const { identite } = loadRepo(root);
    const byPath = new Map(identite.map((f) => [f.chemin, f.taille]));
    assert(byPath.get('symbole.svg') === 6, JSON.stringify(identite));
    assert(byPath.get('logotype.png') === 400 * 1024, JSON.stringify(identite));

    const { errors } = check(root, { livres: new Set() });
    assert(errors.some((e) => e.includes('identite/logotype.png') && e.includes('100 Kio')), errors.join(' | '));
  }));

await test('a subfolder is read, to be refused', () =>
  repo((root) => {
    mkdirSync(join(root, 'identite', 'anciens'), { recursive: true });
    writeFileSync(join(root, 'identite', 'anciens', 'symbole.svg'), '<svg/>');
    const { identite } = loadRepo(root);
    assert(identite.some((f) => f.chemin === 'anciens/symbole.svg'), JSON.stringify(identite));
  }));

await test('the Markdown of identite/ is not read as an entity', () =>
  repo((root) => {
    mkdirSync(join(root, 'identite'));
    writeFileSync(join(root, 'identite', 'README.md'), '# Identité\n\nLe symbole de Skaron.\n');
    writeFileSync(join(root, 'identite', 'notes.md'), 'Sans frontmatter.\n');
    const { errors } = check(root, { livres: new Set() });
    assert(!errors.some((e) => /frontmatter/.test(e)), `read as an entity: ${errors.join(' | ')}`);
    assert(errors.some((e) => e.includes('identite/notes.md')), `notes.md allowed: ${errors.join(' | ')}`);
  }));

await test('a specification without identity says nothing about it', () =>
  repo((root) => {
    const loaded = loadRepo(root);
    assert(Array.isArray(loaded.identite) && !loaded.identite.length, JSON.stringify(loaded.identite));
    assert(!loaded.errors.length, loaded.errors.join(' | '));
  }));

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length > 0) process.exit(1);
