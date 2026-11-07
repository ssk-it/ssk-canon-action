// Tests of the skills on a specification that names its folders — RG-noms-declares.
//
// What they protect: the skills' scripts run with nothing installed, copied
// alone into the skills folder. They cannot import the library: they carry a
// copy of the names resolution, and a dependency-free reading of
// `ssk-canon.yml`. A copy that diverges, or a reading that understands
// something other than YAML, would prepare a scoping in a folder the check
// does not read.
//
//   node test/skills-names.test.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { resoudreNoms } from '../src/noms.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKILLS_WITH_NAMES = ['cadrage-canon', 'consulter-referentiel'];
const PREPARE = join(ROOT, 'skills/cadrage-canon/scripts/preparer.mjs');
const CONSULT = join(ROOT, 'skills/consulter-referentiel/scripts/consulter.mjs');
const YEAR = new Date().getFullYear();
const id = (n) => `${YEAR}-${String(n).padStart(3, '0')}`;

let passed = 0;
const failures = [];
const temporaries = [];

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

// --- the copies ---

for (const skill of SKILLS_WITH_NAMES) {
  await test(`${skill} carries the library's resolution, identical`, () => {
    const copy = join(ROOT, 'skills', skill, 'scripts/noms.mjs');
    assert(existsSync(copy), `${copy} missing`);
    assert(
      readFileSync(copy, 'utf8') === readFileSync(join(ROOT, 'src/noms.mjs'), 'utf8'),
      'the copy diverges from src/noms.mjs — copy it again',
    );
  });
}

await test('both skills carry the same reading of the configuration', () => {
  const [a, b] = SKILLS_WITH_NAMES.map((s) =>
    readFileSync(join(ROOT, 'skills', s, 'scripts/config-noms.mjs'), 'utf8'),
  );
  assert(a === b, 'config-noms.mjs differs from one skill to the other');
});

// --- the dependency-free reading understands what YAML understands ---

const { lireNoms } = await import(join(ROOT, 'skills/cadrage-canon/scripts/config-noms.mjs'));

for (const [label, text] of [
  ['nothing declared', 'schema_version: 1\nprojet:\n  nom: Test\n'],
  ['an indented block', 'dossiers:\n  regles: exigences\n  cadrages: evolutions\nfichiers:\n  cadrage: evolution.md\n'],
  ['quotes and a comment', "dossiers:\n  regles: 'exigences'  # le lexique du client\n  domaines: \"domaines\"\n"],
  ['an inline block', 'dossiers: { regles: exigences, cadrages: evolutions }\n'],
  ['a block followed by other keys', 'dossiers:\n    regles: exigences\n\ntags_liens:\n  - carte_trello\nfichiers:\n    pieces_jointes: pj.md\n'],
  ['a faulty entry', "dossiers:\n  regles: ''\n  cadrages: features\n"],
  ['Windows line endings', 'dossiers:\r\n  regles: exigences\r\n'],
]) {
  await test(`reads like YAML: ${label}`, () => {
    const expected = resoudreNoms(load(text));
    const actual = lireNoms(text);
    assert(
      JSON.stringify({ d: actual.dossiers, f: actual.fichiers }) ===
        JSON.stringify({ d: expected.dossiers, f: expected.fichiers }),
      `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
  });
}

// --- a specification under a client's names ---

const CONFIG =
  'projet:\n  nom: Test\n' +
  'dossiers:\n  domaines: domaines\n  fonctionnalites: fonctionnalites\n  regles: exigences\n' +
  '  cadrages: evolutions\n  decisions_cadrage: arbitrages\n' +
  'fichiers:\n  cadrage: evolution.md\n';

const git = (folder, ...a) =>
  execFileSync('git', ['-C', folder, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();

function write(root, path, content) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
}

/** An origin carrying a delivered scoping and an in-progress scoping, and its clone. */
function clientSpecification() {
  const tmp = mkdtempSync(join(tmpdir(), 'skills-names-'));
  temporaries.push(tmp);
  const origin = join(tmp, 'origine.git');
  const work = join(tmp, 'travail');
  const clone = join(tmp, 'referentiel');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['clone', '-q', origin, work], { stdio: 'ignore' });

  write(work, 'ssk-canon.yml', CONFIG);
  write(work, 'domaines/d.md', '---\nid: d\nnom: Le domaine\n---\n\nUn domaine.\n');
  write(work, 'fonctionnalites/f.md', '---\nid: f\nnom: La fonctionnalité\ndomaines: [d]\n---\n\nF.\n');
  write(
    work,
    'exigences/RG-a.md',
    '---\nid: RG-a\nfonctionnalites: [f]\nstatut: actif\ncree_par: ' + id(1) + '\nmodifie_par: []\n---\n\nUne exigence de lexique.\n',
  );
  write(
    work,
    `evolutions/${id(1)}/evolution.md`,
    `---\nid: ${id(1)}\ntitre: Une évolution livrée\ndomaines: [d]\nliens:\n  - { tag: issue_github, url: 'https://github.com/org/code/issues/7' }\nimpacts:\n  - { regle: RG-a, operation: cree }\n---\n\n## Objectif\n\nUn objectif.\n`,
  );
  write(
    work,
    `evolutions/${id(1)}/arbitrages/01-x.md`,
    '---\nid: 01-x\ntitre: Une question tranchée\nstatut: retenue\noption_retenue: a\n---\n\n## Description\n\nCe qui était ouvert.\n',
  );
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'livraison');
  git(work, 'push', '-q', 'origin', 'HEAD:main');

  git(work, 'checkout', '-q', '-b', `cadrage-${id(2)}`);
  write(
    work,
    `evolutions/${id(2)}/evolution.md`,
    `---\nid: ${id(2)}\ntitre: Une évolution en cours\ndomaines: [d]\nimpacts:\n  - { regle: RG-a, operation: modifie }\n---\n\n## Objectif\n\nEn cours.\n`,
  );
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'en cours');
  git(work, 'push', '-q', 'origin', `cadrage-${id(2)}`);

  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'ignore' });
  return clone;
}

const run = (script, ...args) => {
  try {
    return execFileSync('node', [script, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CONSULTER_MAX_CARACTERES: '10000000' },
    });
  } catch (e) {
    return `${e.stdout}${e.stderr}`;
  }
};
const line = (output, key) => output.split('\n').find((l) => l.startsWith(`${key} `))?.slice(key.length + 1);

await test('preparer counts the scopings and prepares the file under the declared names', () => {
  const clone = clientSpecification();
  const output = run(PREPARE, clone);
  assert(line(output, 'CADRAGE') === id(3), `identifier: ${output}`);
  const workspace = line(output, 'ESPACE');
  assert(line(output, 'FICHIER') === join(workspace, 'evolutions', id(3), 'evolution.md'), `file: ${output}`);
  assert(existsSync(join(workspace, 'evolutions', id(3), 'arbitrages')), 'decisions folder missing');
  assert(!existsSync(join(workspace, 'cadrages')), 'cadrages/ created');
  // the names to use, for the writer following the skill
  assert(/^NOMS .*dossiers\.regles=exigences/m.test(output), `names not stated: ${output}`);
});

await test('preparer resumes a workspace under the declared names', () => {
  const clone = clientSpecification();
  const first = run(PREPARE, clone);
  const resumed = run(PREPARE, clone, line(first, 'CADRAGE'));
  assert(line(resumed, 'FICHIER') === line(first, 'FICHIER'), `resumption: ${resumed}`);
});

await test('preparer states no name for a specification that declares none', () => {
  const clone = clientSpecification();
  writeFileSync(join(clone, 'ssk-canon.yml'), 'projet:\n  nom: Test\n');
  git(clone, 'commit', '-qam', 'sans noms');
  git(clone, 'push', '-q', 'origin', 'HEAD:main');
  const output = run(PREPARE, clone);
  assert(!/^NOMS /m.test(output), `names stated: ${output}`);
});

await test('consulter reads the specification, delivered and in progress, under the declared names', () => {
  const clone = clientSpecification();
  const index = run(CONSULT, '--referentiel', clone);
  assert(/TOTAUX fonctionnalites=1 regles=1 decisions=0 cadrages_livres=1/.test(index), `index: ${index}`);
  assert(index.includes(`EN_COURS ${id(2)}`), `in progress: ${index}`);
  assert(/^NOMS .*dossiers\.cadrages=evolutions/m.test(index), `names not stated: ${index}`);

  const domain = run(CONSULT, '--referentiel', clone, '--domaine', 'd');
  assert(domain.includes('REGLE RG-a'), `rule: ${domain}`);
  assert(domain.includes(`CADRAGE_LIVRE ${id(1)}`), `delivered: ${domain}`);
  assert(domain.includes(`origin/main:evolutions/${id(1)}/arbitrages/01-x.md`), `decision: ${domain}`);
});

await test('consulter gives, for an issue, the declared path of the scoping', () => {
  const clone = clientSpecification();
  const output = run(CONSULT, '--referentiel', clone, '--issue', 'code#7');
  assert(output.includes(`--lire origin/main:evolutions/${id(1)}/evolution.md`), output);
});

await test('consulter searches a term in the declared folders', () => {
  const clone = clientSpecification();
  const output = run(CONSULT, '--referentiel', clone, '--motif', 'lexique');
  assert(output.includes('exigences/RG-a.md'), output);
});

await test('consulter condenses a delivered scoping under its declared name', () => {
  const clone = clientSpecification();
  const output = run(CONSULT, '--referentiel', clone, '--lire', `origin/main:evolutions/${id(1)}/evolution.md`);
  assert(output.includes('Une évolution livrée'), output);
});

for (const t of temporaries) rmSync(t, { recursive: true, force: true });

if (failures.length) {
  console.error(`✗ skills-names: ${failures.length} failure(s), ${passed} passed`);
  for (const e of failures) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ skills-names: ${passed} test(s)`);
