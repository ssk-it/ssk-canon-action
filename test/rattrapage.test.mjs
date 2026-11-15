// Tests of the catch-up of a faulty diagram in a delivered scoping —
// RG-cadrage-livre-immuable, scoping 2026-076.
//
// What they protect: a delivered scoping no longer changes, with one exception:
// a Mermaid block that was faulty on the main branch may be rewritten, provided
// it reads afterwards and nothing else changes under the scoping's folder. The
// boundary is the renderer's, checked without judgement: a block that read, a
// word of a statement, an added file, and the pull request is refused as before.
//
//   node test/rattrapage.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { comparerBlocs, jugerRetouches } from '../src/diagrammes.mjs';
import { listerRetouches } from '../src/delivery.mjs';
import { check } from '../src/check.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

function equal(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message}\n    actual   ${a}\n    expected ${b}`);
}

function isTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const bloc = (texte) => '```mermaid\n' + texte + '\n```';
const FAUTIF = 'flowchart LR\n    A["tag &lt;sha&gt;"] --> B';
const CORRIGE = 'flowchart LR\n    A["tag ‹sha›"] --> B';
const LISIBLE = 'flowchart LR\n    C --> D';

// --- the comparison of two versions of a file ---

await test('only the blocks that changed are given, with their rank', () => {
  const avant = `Texte.\n\n${bloc(LISIBLE)}\n\nSuite.\n\n${bloc(FAUTIF)}\n`;
  const apres = `Texte.\n\n${bloc(LISIBLE)}\n\nSuite.\n\n${bloc(CORRIGE)}\n`;
  equal(comparerBlocs(avant, apres), [{ rang: 2, avant: FAUTIF, apres: CORRIGE }]);
});

await test('a change outside the blocks is not a retouch', () => {
  const avant = `Texte.\n\n${bloc(FAUTIF)}\n`;
  equal(comparerBlocs(avant, `Texte repris.\n\n${bloc(CORRIGE)}\n`), null);
});

await test('a block added or removed is not a retouch', () => {
  const avant = `Texte.\n\n${bloc(FAUTIF)}\n`;
  equal(comparerBlocs(avant, `Texte.\n\n${bloc(CORRIGE)}\n\n${bloc(LISIBLE)}\n`), null);
  equal(comparerBlocs(avant, 'Texte.\n\n\n'), null);
});

// --- the judgement of the retouched blocks, by the given parser ---

const refuseLesEntitesEtLesPointsVirgules = async (texte) => {
  if (texte.includes(';')) throw new Error('Parse error on line 2:\n...');
};

await test('a faulty block that now reads passes', async () => {
  const retouches = [{ cadrage: '2026-001', chemin: 'cadrages/2026-001/cadrage.md', rang: 1, avant: FAUTIF, apres: CORRIGE }];
  equal(await jugerRetouches(retouches, { analyser: refuseLesEntitesEtLesPointsVirgules }), []);
});

await test('a block that read is not to be retouched', async () => {
  const retouches = [{ cadrage: '2026-001', chemin: 'cadrages/2026-001/cadrage.md', rang: 1, avant: LISIBLE, apres: 'flowchart LR\n    C --> E' }];
  const anomalies = await jugerRetouches(retouches, { analyser: refuseLesEntitesEtLesPointsVirgules });
  equal(anomalies.map((a) => [a.code, a.gravite]), [['rattrapage-bloc-lisible', 'erreur']]);
  equal(anomalies[0].params, { cadrage: '2026-001', source: 'cadrages/2026-001/cadrage.md', rang: 1 });
});

await test('a retouched block still faulty blocks, with the fault', async () => {
  const retouches = [{ cadrage: '2026-001', chemin: 'cadrages/2026-001/cadrage.md', rang: 1, avant: FAUTIF, apres: 'sequenceDiagram\n    A->>B: un ; deux' }];
  const anomalies = await jugerRetouches(retouches, { analyser: refuseLesEntitesEtLesPointsVirgules });
  equal(anomalies.map((a) => [a.code, a.gravite]), [['rattrapage-encore-fautif', 'erreur']]);
  equal(anomalies[0].params.faute, 'Parse error on line 2:');
});

await test('without a parser, only the entities are judged', async () => {
  const sansEntite = [{ cadrage: '2026-001', chemin: 'c.md', rang: 1, avant: LISIBLE, apres: 'flowchart LR\n    C --> E' }];
  equal(await jugerRetouches(sansEntite), []);
  const resteEntite = [{ cadrage: '2026-001', chemin: 'c.md', rang: 1, avant: FAUTIF, apres: FAUTIF.replace('sha', 'SHA') }];
  equal((await jugerRetouches(resteEntite)).map((a) => [a.code, a.params.faute]), [['rattrapage-encore-fautif', '&lt;']]);
});

await test('the messages name the place, in both languages', () => {
  for (const code of ['rattrapage-bloc-lisible', 'rattrapage-encore-fautif']) {
    const a = { code, gravite: 'erreur', params: { cadrage: '2026-001', source: 'cadrages/2026-001/cadrage.md', rang: 2, faute: '&lt;' } };
    for (const langue of ['fr', 'en']) {
      const m = formaterAnomalie(a, langue);
      isTrue(m.includes('cadrages/2026-001/cadrage.md') && m.includes('2') && !m.includes(code), `${langue}: ${m}`);
    }
  }
});

// --- in the repo: what the immutability check lets through ---

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function depot(diagramme) {
  const root = mkdtempSync(join(tmpdir(), 'rattrapage-'));
  for (const d of ['domains', 'features', 'rules', 'cadrages/2026-001']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'ssk-canon.yml'), 'schema_version: 1\n');
  writeFileSync(join(root, 'domains/d.md'), '---\nid: d\nnom: D\n---\n\nUn domaine.\n');
  writeFileSync(join(root, 'features/f.md'), '---\nid: f\nnom: F\ndomaines: [d]\n---\n\nUne fonctionnalité.\n');
  writeFileSync(join(root, 'rules/RG-a.md'), '---\nid: RG-a\nfonctionnalites: [f]\nstatut: actif\ncree_par: 2026-001\nmodifie_par: []\n---\n\nUn énoncé.\n');
  ecrireCadrage(root, 'Un objectif.', diagramme);
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@exemple.fr']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'livraison']);
  return { root, base: git(root, ['rev-parse', 'HEAD']) };
}

function ecrireCadrage(root, objectif, diagramme) {
  writeFileSync(
    join(root, 'cadrages/2026-001/cadrage.md'),
    '---\nid: 2026-001\ntitre: Un cadrage\ndomaines: [d]\nimpacts:\n  - { regle: RG-a, operation: cree }\n---\n\n' +
      `## Objectif\n\n${objectif}\n\n${bloc(diagramme)}\n\n## Énoncés\n\n### RG-a\n\nUn énoncé.\n`,
  );
}

function commiter(root) {
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'rattrapage']);
}

async function dansUnDepot(name, fn) {
  await test(name, async () => {
    const { root, base } = depot(FAUTIF);
    try {
      await fn(root, base);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

const codes = (anomalies) => anomalies.map((a) => a.code);

await dansUnDepot('a retouch of a faulty block is not a modification of the delivered scoping', (root, base) => {
  ecrireCadrage(root, 'Un objectif.', CORRIGE);
  commiter(root);
  const { anomalies } = check(root, { base });
  isTrue(!codes(anomalies).includes('cadrage-livre-modifie'), JSON.stringify(anomalies));
  isTrue(!anomalies.some((a) => a.gravite === 'erreur'), JSON.stringify(anomalies));
  equal(listerRetouches(root, base, new Set(['2026-001'])).retouches, [
    { cadrage: '2026-001', chemin: 'cadrages/2026-001/cadrage.md', rang: 1, avant: FAUTIF, apres: CORRIGE },
  ]);
});

await dansUnDepot('a retouch that leaves an entity is refused by the check itself', (root, base) => {
  ecrireCadrage(root, 'Un objectif.', FAUTIF.replace('sha', 'SHA'));
  commiter(root);
  const a = check(root, { base }).anomalies.find((x) => x.code === 'rattrapage-encore-fautif');
  isTrue(a && a.gravite === 'erreur', JSON.stringify(check(root, { base }).anomalies));
});

await dansUnDepot('a word changed beside the block makes it a modification again', (root, base) => {
  ecrireCadrage(root, 'Un objectif repris.', CORRIGE);
  commiter(root);
  isTrue(codes(check(root, { base }).anomalies).includes('cadrage-livre-modifie'), 'the modification passed');
});

await dansUnDepot('a file added under the scoping makes it a modification again', (root, base) => {
  ecrireCadrage(root, 'Un objectif.', CORRIGE);
  mkdirSync(join(root, 'cadrages/2026-001/decisions'));
  writeFileSync(join(root, 'cadrages/2026-001/decisions/01-x.md'), '---\nid: 01-x\ntitre: X ?\nstatut: retenue\n---\n\nTexte.\n');
  commiter(root);
  const a = check(root, { base }).anomalies.find((x) => x.code === 'cadrage-livre-modifie');
  isTrue(a, 'the added file passed');
  equal(a.params.chemins, ['cadrages/2026-001/cadrage.md', 'cadrages/2026-001/decisions/01-x.md']);
});

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
