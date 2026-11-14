// Checks the syntax of the diagrams of a specification — RG-verification-integrite,
// scoping 2026-074. Run by the Action in a step of its own, with no token in
// its environment (decision 03): Mermaid's parser carries known
// vulnerabilities, accepted for text written by chosen authors.
//
//   node analyseur-mermaid/verifier.mjs <specification> [--base <référence>]
//
// Only a block of a scoping not yet delivered blocks; the others are reported
// as warnings. The delivered scopings are read on the base, origin/main by
// default, as the check reads them. Exit code 1 if a diagram is refused, with
// one line per diagram at fault, in the specification's language.

import { loadRepo } from '../src/parse.mjs';
import { verifierDiagrammes } from '../src/diagrammes.mjs';
import { enTexte } from '../src/anomalies.mjs';
import { languageOf } from '../src/check.mjs';
import { listDeliveredScopings } from '../src/delivery.mjs';
import { creerAnalyseur } from './analyseur.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--base');
const base = i === -1 ? 'origin/main' : args[i + 1];
const racine = args.find((a, j) => !a.startsWith('--') && (i === -1 || j !== i + 1)) ?? '.';

const repo = loadRepo(racine);
const livres = listDeliveredScopings(racine, base, repo.noms.dossiers.cadrages) ?? new Set();
const anomalies = await verifierDiagrammes(repo, { analyser: await creerAnalyseur(), livres });
const { errors, warnings } = enTexte(anomalies, languageOf(racine));
for (const w of warnings) console.log(`  ~ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
process.exit(errors.length ? 1 : 0);
