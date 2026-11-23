// Tests of the check that tells whether a module is the one Node was asked to run.
//
// What they protect: a command-line tool runs its body only when it is the
// main module. The first version compared `import.meta.url` with
// `file://${process.argv[1]}`, which is false on Windows (`file:///C:/…` against
// `C:\…`), and on any path that goes through a symbolic link or holds a
// character a URL encodes. The tool then did nothing, printed nothing and
// exited 0: a check that never ran reported success.
//
//   node test/main-module.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

function isTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const HELPER = new URL('../src/main-module.mjs', import.meta.url).href;

const root = realpathSync(mkdtempSync(join(tmpdir(), 'module-principal-')));
// A folder name with a space: `import.meta.url` encodes it, `argv[1]` does not.
const folder = join(root, 'un dossier');
mkdirSync(folder);
writeFileSync(
  join(folder, 'outil.mjs'),
  `import { isMainModule } from '${HELPER}';\nconsole.log(isMainModule(import.meta.url) ? 'principal' : 'importe');\n`,
);
writeFileSync(
  join(folder, 'appelant.mjs'),
  `import './outil.mjs';\n`,
);

const run = (file) => execFileSync(process.execPath, [file], { encoding: 'utf8' }).trim();

test('a module run directly is the main module, even when its path holds a space', () => {
  isTrue(run(join(folder, 'outil.mjs')) === 'principal', 'not recognised');
});

test('a module run through a symbolic link is recognised', () => {
  const link = join(root, 'lien');
  // a junction needs no privilege on Windows, and is resolved like a link
  symlinkSync(folder, link, process.platform === 'win32' ? 'junction' : 'dir');
  isTrue(run(join(link, 'outil.mjs')) === 'principal', 'not recognised through a link');
});

test('a module imported by another is not the main module', () => {
  isTrue(run(join(folder, 'appelant.mjs')) === 'importe', 'taken for the main module');
});

test('nothing is the main module when Node runs no file', () => {
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `import { isMainModule } from '${HELPER}'; console.log(isMainModule(import.meta.url))`],
    { encoding: 'utf8' },
  ).trim();
  isTrue(out === 'false', `got ${out}`);
});

rmSync(root, { recursive: true, force: true });
for (const e of failures) console.error(`✗ ${e}`);
console.log(`${passed} passed, ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
