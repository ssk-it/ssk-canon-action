// Tests of the anomalies of reading the format — RG-anomalies-codees.
//
// What they protect: an unreadable or missing frontmatter, or a configuration
// that cannot be read, are reported by a code, whose message is said in
// French and in English. Yesterday's textual form, which the interface still
// reads (`splitFrontmatter(...).erreur`), must stay word for word the same.
//
//   node test/reading.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { splitFrontmatter } from '../src/format.mjs';
import { loadRepo } from '../src/parse.mjs';
import { checkRepo } from '../src/verifier.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';

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

const equal = (actual, expected) =>
  assert(JSON.stringify(actual) === JSON.stringify(expected), `\n    actual   ${JSON.stringify(actual)}\n    expected ${JSON.stringify(expected)}`);

// --- the frontmatter, without disk ---

await test('a “:” in an unquoted value has its code, and the advice about single quotes', () => {
  const read = splitFrontmatter('---\nid: x\ntitre: Choix : le bon\n---\n');
  equal(read.anomalie.code, 'frontmatter-deux-points');
  equal(read.anomalie.gravite, 'erreur');
  equal(
    read.erreur,
    'frontmatter illisible ligne 3 : bad indentation of a mapping entry — une valeur contenant « : » doit être entre apostrophes',
  );
  equal(formaterAnomalie(read.anomalie, 'fr'), read.erreur);
  equal(
    formaterAnomalie(read.anomalie, 'en'),
    'unreadable frontmatter at line 3: bad indentation of a mapping entry — a value containing “:” must be in single quotes',
  );
});

await test('a frontmatter unreadable for another cause keeps YAML’s reason', () => {
  const read = splitFrontmatter('---\nid: [x\n---\n');
  equal(read.anomalie.code, 'frontmatter-illisible');
  equal(read.erreur, 'frontmatter illisible ligne 2 : unexpected end of the stream within a flow collection');
  equal(formaterAnomalie(read.anomalie, 'fr'), read.erreur);
  equal(
    formaterAnomalie(read.anomalie, 'en'),
    'unreadable frontmatter at line 2: unexpected end of the stream within a flow collection',
  );
});

await test('without a known line, the message cites none', () => {
  const without = { code: 'frontmatter-illisible', gravite: 'erreur', params: { ligne: null, raison: 'r' } };
  equal(formaterAnomalie(without, 'fr'), 'frontmatter illisible : r');
  equal(formaterAnomalie(without, 'en'), 'unreadable frontmatter: r');
});

await test('a read or missing frontmatter has no anomaly', () => {
  equal(splitFrontmatter('pas de frontmatter'), null);
  assert(!('anomalie' in splitFrontmatter('---\nid: x\n---\ncorps')), 'anomaly on a read frontmatter');
});

// --- loading a repo ---

function repo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'canon-lecture-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function write(root, path, content) {
  const full = join(root, ...path.split('/'));
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}

const faulty = (root) => {
  write(root, 'ssk-canon.yml', 'projet: [\n');
  write(root, 'rules/RG-a.md', 'pas de frontmatter\n');
  write(root, 'rules/RG-b.md', '---\nid: RG-b\ntitre: Choix : le bon\n---\n');
  write(root, 'cadrages/2026-001/cadrage.md', '---\nid: 2026-001\n---\n');
  write(root, 'cadrages/2026-001/decisions/01-x.md', 'rien\n');
  write(root, 'cadrages/2026-001/decisions/02-y.md', '---\ntitre: a: b\n---\n');
  write(root, 'cadrages/2026-001/attachments.md', '---\nattachments: [\n---\n');
};

await test('loading errors are coded, and errors remains yesterday’s French form', () =>
  repo((root) => {
    faulty(root);
    const loaded = loadRepo(root);
    equal(
      loaded.anomalies.map((a) => a.code),
      [
        'config-illisible',
        'frontmatter-absent',
        'frontmatter-deux-points',
        'frontmatter-absent',
        'frontmatter-deux-points',
        'frontmatter-illisible',
      ],
    );
    const fr = loaded.anomalies.map((a) => formaterAnomalie(a, 'fr'));
    equal(loaded.errors, fr);
    assert(fr[0].startsWith('ssk-canon.yml : '), fr[0]);
    equal(fr.slice(1), [
      'rules/RG-a.md : frontmatter absent ou mal formé',
      'rules/RG-b.md : frontmatter illisible ligne 3 : bad indentation of a mapping entry — une valeur contenant « : » doit être entre apostrophes',
      'cadrages/2026-001/decisions/01-x.md : frontmatter absent',
      'cadrages/2026-001/decisions/02-y.md : frontmatter illisible ligne 2 : bad indentation of a mapping entry — une valeur contenant « : » doit être entre apostrophes',
      'cadrages/2026-001/attachments.md : frontmatter illisible ligne 2 : unexpected end of the stream within a flow collection',
    ]);
    // the check renders them as text, word for word
    const { errors } = checkRepo(loaded);
    for (const e of fr) assert(errors.includes(e), `${e} missing from ${errors.join(' | ')}`);
  }));

await test('loading errors are said in English', () =>
  repo((root) => {
    faulty(root);
    const en = loadRepo(root).anomalies.map((a) => formaterAnomalie(a, 'en'));
    assert(en[0].startsWith('ssk-canon.yml: unreadable — '), en[0]);
    equal(en.slice(1), [
      'rules/RG-a.md: frontmatter missing or malformed',
      'rules/RG-b.md: unreadable frontmatter at line 3: bad indentation of a mapping entry — a value containing “:” must be in single quotes',
      'cadrages/2026-001/decisions/01-x.md: frontmatter missing or malformed',
      'cadrages/2026-001/decisions/02-y.md: unreadable frontmatter at line 2: bad indentation of a mapping entry — a value containing “:” must be in single quotes',
      'cadrages/2026-001/attachments.md: unreadable frontmatter at line 2: unexpected end of the stream within a flow collection',
    ]);
  }));

await test('a missing configuration has its own code', () =>
  repo((root) => {
    write(root, 'rules/RG-a.md', '---\nid: RG-a\n---\n');
    const loaded = loadRepo(root);
    equal(loaded.anomalies.map((a) => a.code), ['config-absente']);
    assert(formaterAnomalie(loaded.anomalies[0], 'fr').startsWith('ssk-canon.yml : ENOENT'), formaterAnomalie(loaded.anomalies[0], 'fr'));
    assert(formaterAnomalie(loaded.anomalies[0], 'en').startsWith('ssk-canon.yml: not found — ENOENT'), formaterAnomalie(loaded.anomalies[0], 'en'));
  }));

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length > 0) process.exit(1);
