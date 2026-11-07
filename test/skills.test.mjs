// Tests of the shape of the distributed skills.
//
// What they protect: a frontmatter that YAML rejects makes neither the loading
// of the skill nor anything else fail. Claude Code then loads its body with
// empty metadata — without `context: fork`, without `allowed-tools`, and with
// its title as the whole description. The skill runs in the main conversation
// instead of a subagent, and triggers badly. Observed on
// 13 October 2026: an unquoted description containing “:” was enough.
//
//   node test/skills.test.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const SKILLS = fileURLToPath(new URL('../skills', import.meta.url));

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function isTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const names = readdirSync(SKILLS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(SKILLS, e.name, 'SKILL.md')))
  .map((e) => e.name)
  .sort();

test('finds the skills to check', () => {
  isTrue(names.length > 0, `no SKILL.md under ${SKILLS}`);
});

for (const name of names) {
  test(`the frontmatter of ${name} is YAML that Claude Code reads`, () => {
    // The line endings of a repo checked out under Windows must not decide
    // the result: Claude Code reads the file as it is installed.
    const text = readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const block = text.match(/^---\n([\s\S]*?)\n---\n/);
    isTrue(block, 'the file must start with a frontmatter between two --- lines');

    let fields;
    try {
      fields = load(block[1]);
    } catch (error) {
      throw new Error(`YAML rejected — ${error.reason}, line ${error.mark.line + 1}, column ${error.mark.column + 1}`);
    }
    isTrue(fields?.name === name, `name must be ${name}, got ${JSON.stringify(fields?.name)}`);
    isTrue(typeof fields.description === 'string' && fields.description.trim() !== '', 'description missing or empty');
  });
}

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length > 0) process.exit(1);
