// Tests of the diagram checks — RG-verification-integrite, scoping 2026-074.
//
// What they protect: a Mermaid block that the renderer cannot read, or that
// carries an HTML entity, is refused at the check, and no longer discovered
// when Skanon displays it. The library extracts the blocks and owns the two
// anomalies; the parser itself is given by the caller — Mermaid under jsdom
// for the Action, the one Skanon already loads in the browser.
//
//   node test/diagrams.test.mjs

import { extraireDiagrammes, verifierDiagrammes } from '../src/diagrammes.mjs';
import { checkRepo } from '../src/verifier.mjs';
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
const FLUX = 'flowchart LR\n    A --> B';
const ENTITE = 'flowchart LR\n    A["image br-&lt;branche&gt;"] --> B';

/** A minimal loaded specification, as `loadRepo` returns it. */
function repo({ regle = '', cadrage = '', decision = '', architecture = '' } = {}) {
  return {
    config: {},
    domains: new Map([['d', { id: 'd' }]]),
    features: new Map([['f', { id: 'f', domaines: ['d'] }]]),
    rules: new Map([
      ['RG-a', { id: 'RG-a', statut: 'actif', fonctionnalites: ['f'], cree_par: null, modifie_par: [], path: 'rules/RG-a.md', body: regle }],
    ]),
    decisions: new Map(),
    architecture: new Map([
      ['FLX-a', { id: 'FLX-a', nature: 'flux', statut: 'actif', cree_par: null, modifie_par: [], path: 'architecture/FLX-a.md', body: architecture }],
    ]),
    cadrages: new Map([
      ['2026-001', { id: '2026-001', domaines: ['d'], impacts: [], path: 'cadrages/2026-001/cadrage.md', body: cadrage, decisions: [{ id: '01-x', body: decision }], attachments: [] }],
    ]),
    errors: [],
  };
}

const codes = (anomalies) => anomalies.map((a) => a.code);

// --- extraction ---

await test('the blocks are found in rules, architecture, scopings and their decisions', () => {
  const r = repo({
    regle: `Texte.\n\n${bloc(FLUX)}\n`,
    architecture: `${bloc(FLUX)}\n\n${bloc('sequenceDiagram\n    A->>B: x')}`,
    cadrage: `## Énoncés\n\n${bloc(FLUX)}`,
    decision: bloc(FLUX),
  });
  equal(
    extraireDiagrammes(r).map((d) => [d.source, d.rang]),
    [
      ['rules/RG-a.md', 1],
      ['architecture/FLX-a.md', 1],
      ['architecture/FLX-a.md', 2],
      ['cadrages/2026-001/cadrage.md', 1],
      ['cadrages/2026-001/cadrage.md — 01-x', 1],
    ],
  );
});

await test('a block in another language, or an indented sample, is not a diagram', () => {
  const r = repo({ regle: '```yaml\na: b\n```\n\n    ```mermaid\n    x\n    ```' });
  equal(extraireDiagrammes(r), []);
});

// --- HTML entities, checked by checkRepo itself ---

await test('an HTML entity in a scoping under review is an error of checkRepo', () => {
  const { anomalies } = checkRepo(repo({ cadrage: bloc(ENTITE) }));
  const a = anomalies.find((x) => x.code === 'diagramme-entite-html');
  isTrue(a, `no diagramme-entite-html in ${JSON.stringify(codes(anomalies))}`);
  equal(a.gravite, 'erreur');
  equal(a.params, { source: 'cadrages/2026-001/cadrage.md', rang: 1, entite: '&lt;' });
});

// A delivered scoping no longer changes, and the rule it projected only changes
// when another scoping is merged: blocking on them would refuse every pull
// request of the repo, the one that fixes them included. They are reported.
await test('in a delivered scoping, or a projected document, an entity is a warning', () => {
  const { anomalies } = checkRepo(repo({ cadrage: bloc(ENTITE), regle: bloc(ENTITE), decision: bloc(ENTITE) }), {
    livres: new Set(['2026-001']),
  });
  const trouves = anomalies.filter((x) => x.code === 'diagramme-entite-html');
  equal(trouves.map((a) => a.gravite), ['avertissement', 'avertissement', 'avertissement']);
});

await test('a decision of a scoping under review blocks too', () => {
  const { anomalies } = checkRepo(repo({ decision: bloc(ENTITE) }));
  equal(anomalies.filter((x) => x.code === 'diagramme-entite-html').map((a) => a.gravite), ['erreur']);
});

await test('an HTML entity outside a diagram is not reported', () => {
  const { anomalies } = checkRepo(repo({ regle: `Le texte peut dire &lt; ici.\n\n${bloc(FLUX)}` }));
  isTrue(!codes(anomalies).includes('diagramme-entite-html'), JSON.stringify(codes(anomalies)));
});

await test('the message names the place and the remedy, in both languages', () => {
  const a = { code: 'diagramme-entite-html', gravite: 'erreur', params: { source: 'rules/RG-a.md', rang: 2, entite: '&lt;' } };
  const fr = formaterAnomalie(a, 'fr');
  const en = formaterAnomalie(a, 'en');
  for (const m of [fr, en]) {
    isTrue(m.includes('rules/RG-a.md') && m.includes('2') && m.includes('&lt;'), m);
    isTrue(m.includes('‹') && m.includes('#60;'), `no remedy in: ${m}`);
  }
});

// --- syntax, by the parser the caller gives ---

const refuseSansFleche = async (texte) => {
  if (texte.includes('-->')) return;
  throw new Error('Parse error on line 2:\n...\nExpecting something');
};

await test('a block the parser refuses is an error, with its message', async () => {
  const anomalies = await verifierDiagrammes(repo({ cadrage: `${bloc(FLUX)}\n\n${bloc('flowchart LR\n    A -- B')}` }), { analyser: refuseSansFleche });
  equal(codes(anomalies), ['diagramme-illisible']);
  equal(anomalies[0].gravite, 'erreur');
  equal(anomalies[0].params, { source: 'cadrages/2026-001/cadrage.md', rang: 2, erreur: 'Parse error on line 2:' });
  isTrue(formaterAnomalie(anomalies[0], 'fr').includes('Parse error on line 2'), formaterAnomalie(anomalies[0], 'fr'));
});

await test('outside a scoping under review, an unreadable block is a warning', async () => {
  const anomalies = await verifierDiagrammes(repo({ regle: bloc('x'), cadrage: bloc('y') }), {
    analyser: refuseSansFleche,
    livres: new Set(['2026-001']),
  });
  equal(anomalies.map((a) => a.gravite), ['avertissement', 'avertissement']);
});

await test('without a parser, the syntax is not checked', async () => {
  equal(await verifierDiagrammes(repo({ regle: bloc('pas un diagramme') })), []);
});

await test('every block is parsed, not only up to the first refusal', async () => {
  const seen = [];
  const analyser = async (texte) => {
    seen.push(texte);
    throw new Error('non');
  };
  const anomalies = await verifierDiagrammes(repo({ regle: `${bloc('a')}\n${bloc('b')}`, decision: bloc('c') }), { analyser });
  equal(seen, ['a', 'b', 'c']);
  equal(anomalies.length, 3);
});

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exit(1);
