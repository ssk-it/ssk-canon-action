// Tests of the guard that prevents a propagation from opening a second pull
// request.
//
// What they protect: the propagation is also triggered on a schedule, to catch
// up on a push GitHub did not deliver. On a protected branch, every run that
// finds pending writes would otherwise open its own pull request, whose branch
// carries a name derived from its commit.
//
//   node src/pending-propagation.test.mjs

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { behindPropagations, hasPendingPropagation } from './pending-propagation.mjs';

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name} : ${error.message}`);
  }
}

function equal(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
}

test('sees an already open propagation pull request', () => {
  equal(hasPendingPropagation([{ headRefName: 'propagation/1a2b3c4' }]), true);
});

test('ignores pull requests that do not come from the propagation', () => {
  equal(
    hasPendingPropagation([{ headRefName: 'cadrage-2026-020' }, { headRefName: 'propagations' }]),
    false,
  );
});

test('sees nothing without an open pull request', () => {
  equal(hasPendingPropagation([]), false);
});

test('reads the gh list on its input, and says it with oui or non', () => {
  // This is how `action.yml` calls it: `gh pr list --json headRefName | node …`.
  const script = fileURLToPath(new URL('./pending-propagation.mjs', import.meta.url));
  const output = (input) =>
    execFileSync('node', [script], { input: JSON.stringify(input) }).toString().trim();
  equal(output([{ headRefName: 'propagation/9f9f9f9' }]), 'oui');
  equal(output([]), 'non');
});

// A pending propagation pull request that the main branch has overtaken — a
// scoping merged in the meantime — would wait forever for an update nobody
// makes, when the main branch requires an up-to-date branch: the propagation
// updates it, and must therefore find it.
test('names the propagation pull requests the main branch has overtaken', () => {
  const list = [
    { number: 7, headRefName: 'propagation/1a2b3c4', mergeStateStatus: 'BEHIND' },
    { number: 8, headRefName: 'propagation/5d6e7f8', mergeStateStatus: 'BLOCKED' },
    { number: 9, headRefName: 'cadrage-2026-020', mergeStateStatus: 'BEHIND' },
  ];
  equal(behindPropagations(list).join(','), '7');
  equal(behindPropagations([]).join(','), '');
});

test('with --en-retard, prints one overtaken pull request per line', () => {
  const script = fileURLToPath(new URL('./pending-propagation.mjs', import.meta.url));
  const output = (input) =>
    execFileSync('node', [script, '--en-retard'], { input: JSON.stringify(input) }).toString().trim();
  equal(output([{ number: 12, headRefName: 'propagation/9f9f9f9', mergeStateStatus: 'BEHIND' }]), '12');
  equal(output([{ number: 12, headRefName: 'propagation/9f9f9f9', mergeStateStatus: 'CLEAN' }]), '');
});

console.log(`${passed} passed, ${failures.length} failed`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length > 0) process.exit(1);
