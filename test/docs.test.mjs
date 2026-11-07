// Tests of the documentation: relative links and the two languages.
//
// What they protect: a moved page or a reworded heading silently breaks the
// links that led to it — GitHub shows a 404 or stays at the top of the page,
// and nothing reports it. The English version, for its part, is only worth
// something if it follows the French one: a page added on one side only must show.
//
//   node test/docs.test.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const pagesOf = (folder) =>
  readdirSync(join(root, folder)).filter((name) => name.endsWith('.md')).sort();

const PAGES = [
  'README.md',
  'README.en.md',
  ...pagesOf('docs').map((name) => `docs/${name}`),
  ...pagesOf('docs/en').map((name) => `docs/en/${name}`),
  ...readdirSync(join(root, 'skills')).map((skill) => `skills/${skill}/SKILL.md`),
];

// The text outside code blocks: an example link there is not a link.
const outsideCode = (text) => text.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');

// The anchor GitHub gives a heading: lowercase, without punctuation, spaces
// turned into hyphens; accented letters remain.
function anchor(heading) {
  return heading
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function anchorsOf(path) {
  const seen = new Map();
  const anchors = new Set();
  for (const [, heading] of read(path).replace(/^```[\s\S]*?^```/gm, '').matchAll(/^#{1,6} +(.+?) *$/gm)) {
    const base = anchor(heading);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n ? `${base}-${n}` : base);
  }
  return anchors;
}

for (const page of PAGES) {
  test(`${page}: each relative link leads to a file, and to a heading when it carries an anchor`, () => {
    const broken = [];
    for (const [, target] of outsideCode(read(page)).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z][a-z+.-]*:/i.test(target)) continue;
      const [path, fragment] = target.split('#');
      const file = path ? relative(root, join(root, dirname(page), path)) : page;
      if (!existsSync(join(root, file))) {
        broken.push(`${target} (missing file)`);
        continue;
      }
      if (fragment && file.endsWith('.md') && !anchorsOf(file).has(decodeURIComponent(fragment)))
        broken.push(`${target} (no heading has this anchor)`);
    }
    isTrue(!broken.length, broken.join(' | '));
  });
}

test('each page of docs/ has its translation under docs/en/, and vice versa', () => {
  const fr = pagesOf('docs');
  const en = pagesOf('docs/en');
  const alone = [
    ...fr.filter((name) => !en.includes(name)).map((name) => `docs/${name} without docs/en/${name}`),
    ...en.filter((name) => !fr.includes(name)).map((name) => `docs/en/${name} without docs/${name}`),
  ];
  isTrue(!alone.length, alone.join(' | '));
});

test('each page links to its translation at the top', () => {
  const pairs = [
    ['README.md', 'README.en.md', 'README.en.md'],
    ['README.en.md', 'README.md', 'README.md'],
    ...pagesOf('docs').flatMap((name) => [
      [`docs/${name}`, `en/${name}`],
      [`docs/en/${name}`, `../${name}`],
    ]),
  ];
  const without = pairs
    .filter(([page, link]) => !read(page).split('\n')[0].includes(`](${link})`))
    .map(([page, link]) => `${page} does not link to ${link} on its first line`);
  isTrue(!without.length, without.join(' | '));
});

test('the two tables of contents list the same pages', () => {
  const links = (path) =>
    [...read(path).matchAll(/\]\(docs\/(?:en\/)?([^)#]+\.md)/g)].map(([, name]) => name);
  const fr = [...new Set(links('README.md'))];
  const en = [...new Set(links('README.en.md'))];
  isTrue(JSON.stringify(fr) === JSON.stringify(en), `README.md: ${fr.join(', ')}; README.en.md: ${en.join(', ')}`);
  const missing = pagesOf('docs').filter((name) => !fr.includes(name));
  isTrue(!missing.length, `pages missing from the table of contents: ${missing.join(', ')}`);
});

// The README anchors that other repos cite: ssk-it/ssk-canon links to
// `#le-skill-de-cadrage`. No test here would see that link break.
test('the README anchors cited by other repos still exist', () => {
  const anchors = anchorsOf('README.md');
  const missing = ['le-skill-de-cadrage', 'installation-dans-un-dépôt-cadré'].filter((a) => !anchors.has(a));
  isTrue(!missing.length, `anchors gone: ${missing.join(', ')}`);
});

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const e of failures) console.error(`  ✗ ${e}`);
process.exit(failures.length ? 1 : 0);
