// Tests of the script that prepares a scoping's workspace.
//
// What they protect: the proposed identifier is never already taken. The
// writer's clone is often behind origin — a scoping was delivered there
// since, its remote branch deleted on merge — and it keeps local branches
// that nothing pushes. Judging on the working copy alone proposed a delivered
// number, and `git worktree add` failed on the leftover local branch.
//
// Each case builds its specification: a bare origin, and a clone left
// behind.
//
//   node test/prepare.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../skills/cadrage-canon/scripts/preparer.mjs', import.meta.url));
const YEAR = new Date().getFullYear();
const id = (n) => `${YEAR}-${String(n).padStart(3, '0')}`;

let passed = 0;
const failures = [];
const folders = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function equal(actual, expected, what = '') {
  if (actual !== expected) throw new Error(`${what} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const git = (folder, ...a) =>
  execFileSync('git', ['-C', folder, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();

function deliver(folder, number) {
  mkdirSync(join(folder, 'cadrages', id(number)), { recursive: true });
  writeFileSync(join(folder, 'cadrages', id(number), 'cadrage.md'), `---\nid: ${id(number)}\n---\n`);
  git(folder, 'add', '.');
  git(folder, 'commit', '-q', '-m', `Cadrage ${id(number)}`);
}

/**
 * An origin carrying scopings 1 and 2, and the writer's clone left at
 * scoping 1. Scoping 2 was delivered by another copy, and its remote branch
 * deleted on merge; the clone keeps its local branch.
 */
function specificationBehind() {
  const tmp = mkdtempSync(join(tmpdir(), 'preparer-'));
  folders.push(tmp);
  const origin = join(tmp, 'origine.git');
  const other = join(tmp, 'autre');
  const clone = join(tmp, 'referentiel');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);

  execFileSync('git', ['clone', '-q', origin, other], { stdio: 'ignore' });
  writeFileSync(join(other, 'ssk-canon.yml'), 'projet:\n  nom: Test\n');
  deliver(other, 1);
  git(other, 'push', '-q', 'origin', 'HEAD:main');

  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'ignore' });
  git(clone, 'branch', `cadrage-${id(2)}`);

  deliver(other, 2);
  git(other, 'push', '-q', 'origin', 'HEAD:main');
  return clone;
}

function prepare(root, ...args) {
  try {
    return execFileSync('node', [SCRIPT, root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return e.stdout;
  }
}

const line = (output, key) => output.split('\n').find((l) => l.startsWith(`${key} `))?.slice(key.length + 1);

test('a scoping delivered on origin since the last fetch is taken', () => {
  const output = prepare(specificationBehind());
  equal(line(output, 'ECHEC'), undefined, 'failure');
  equal(line(output, 'CADRAGE'), id(3), 'identifier');
});

test('a local branch with no remote makes its identifier taken', () => {
  const clone = specificationBehind();
  git(clone, 'branch', `cadrage-${id(5)}`);
  equal(line(prepare(clone), 'CADRAGE'), id(6), 'identifier');
});

test('a forced identifier already delivered on origin is refused', () => {
  equal(line(prepare(specificationBehind(), id(2)), 'IDENTIFIANT_PRIS'), id(2), 'refusal');
});

for (const d of folders) rmSync(d, { recursive: true, force: true });

if (failures.length) {
  console.error(`✗ prepare: ${failures.length} failure(s), ${passed} passed`);
  for (const e of failures) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ prepare: ${passed} test(s)`);
