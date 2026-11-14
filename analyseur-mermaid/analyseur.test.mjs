// The Action's parser, on the real Mermaid — scoping 2026-074.
//
// What it protects: the parser refuses what Skanon cannot draw — the case that
// started it all, a sequence diagram whose « &lt; » ended the statement — and
// accepts what it draws.
//
//   node analyseur-mermaid/analyseur.test.mjs   (after npm ci in analyseur-mermaid)

import { creerAnalyseur } from './analyseur.mjs';

const analyser = await creerAnalyseur();
const failures = [];
let passed = 0;

async function attendu(nom, texte, lisible) {
  let ok = true;
  try {
    await analyser(texte);
  } catch {
    ok = false;
  }
  if (ok === lisible) passed += 1;
  else failures.push(`${nom}: ${lisible ? 'refusé' : 'accepté'} à tort`);
}

await attendu('flux', 'flowchart LR\n    A["image ‹branche›"] --> B', true);
await attendu('séquence', 'sequenceDiagram\n    A->>B: publie br-‹branche›\n    B->>A: ok', true);
await attendu('séquence et entité', 'sequenceDiagram\n    A->>B: publie br-&lt;branche&gt;\n    B->>A: ok', false);
await attendu('flèche fautive', 'flowchart LR\n    A -- B', false);
await attendu('type inconnu', 'pasUnDiagramme\n    A --> B', false);

// The command line, on a specification outside Git — no scoping delivered,
// so a fault blocks —, given by its path, with and without --base.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const racine = mkdtempSync(join(tmpdir(), 'diagrammes-'));
mkdirSync(join(racine, 'cadrages', '2026-001'), { recursive: true });
writeFileSync(join(racine, 'ssk-canon.yml'), 'schema_version: 1\nprojet: { nom: essai }\n');
writeFileSync(
  join(racine, 'cadrages', '2026-001', 'cadrage.md'),
  '---\nid: 2026-001\ntitre: Essai\ndomaines: []\nimpacts: []\n---\n\n```mermaid\nflowchart LR\n    A -- B\n```\n',
);
const verifier = new URL('./verifier.mjs', import.meta.url).pathname;
for (const extra of [[], ['--base', 'origin/main']]) {
  const r = spawnSync(process.execPath, [verifier, racine, ...extra], { encoding: 'utf8' });
  if (r.status === 1 && r.stdout.includes('cadrages/2026-001/cadrage.md')) passed += 1;
  else failures.push(`ligne de commande ${extra.join(' ') || 'sans --base'} : code ${r.status}, ${r.stdout}${r.stderr}`);
}
rmSync(racine, { recursive: true, force: true });

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exit(1);
