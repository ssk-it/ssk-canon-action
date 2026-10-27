// Tests des workflows modèles et de l'action qui les relie.
//
// Ce qu'ils protègent : une demande de propagation ouverte par le jeton de
// l'automatisation ne déclenche aucun workflow — GitHub n'en crée pour aucun
// événement de ce jeton, sauf `workflow_dispatch`. Sans vérification, le
// contrôle requis manque, et la demande reste bloquée jusqu'à ce qu'on la ferme
// puis la rouvre à la main. L'action lance donc la vérification elle-même ; le
// défaut ne se verrait sinon qu'à la livraison suivante d'un cadrage.
//
//   node test/modeles.test.mjs

import { readFileSync } from 'node:fs';
import { load as loadYaml } from 'js-yaml';
import { MESSAGES } from '../src/messages.mjs';

let reussis = 0;
const echecs = [];

function test(nom, fn) {
  try {
    fn();
    reussis += 1;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  }
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const verification = loadYaml(lire('modeles/verification-depot-cadre.yml'));
const propagation = loadYaml(lire('modeles/propagation-depot-cadre.yml'));
const action = lire('action.yml');

test('la vérification se lance aussi à la demande, seul événement que le jeton de l’automatisation peut créer', () => {
  vrai('workflow_dispatch' in verification.on, 'le modèle de vérification ne déclare pas `workflow_dispatch`');
  vrai('pull_request' in verification.on, 'le modèle de vérification ne vérifie plus les demandes de fusion');
});

test('la propagation a le droit de lancer un workflow', () => {
  vrai(propagation.permissions?.actions === 'write', 'le modèle de propagation ne déclare pas `actions: write`');
});

test("l'action lance la vérification sur la branche de la demande qu'elle vient d'ouvrir", () => {
  const ouverture = action.indexOf('gh pr create');
  const lancement = action.search(/gh workflow run "\$\{\{ inputs\.verification \}\}" --ref "\$BRANCHE"/);
  vrai(ouverture > 0, "l'action n'ouvre plus de demande de propagation");
  vrai(lancement > ouverture, "l'action ne lance pas la vérification après avoir ouvert la demande");
});

const pistes = loadYaml(lire('modeles/pistes-depot-cadre.yml'));
const RUNNER = "${{ vars.SSK_RUNNER_PRIVE && fromJSON(vars.SSK_RUNNER_PRIVE) || 'ubuntu-latest' }}";

test("chaque job des modèles prend le runner que l'organisation réserve à ses dépôts privés, ubuntu-latest sinon", () => {
  for (const [nom, modele] of [['vérification', verification], ['propagation', propagation], ['pistes', pistes]])
    for (const [job, def] of Object.entries(modele.jobs))
      vrai(def['runs-on'] === RUNNER, `${nom}, job ${job} : runs-on vaut ${JSON.stringify(def['runs-on'])}`);
});

test("chaque message que dit l'action est au catalogue", () => {
  const dits = [...action.matchAll(/\bdire ([a-z][a-z0-9-]*)/g)].map((m) => m[1]);
  vrai(dits.length > 3, `trop peu de messages trouvés (${dits.length}) : la recherche est-elle juste ?`);
  for (const code of dits) vrai(code in MESSAGES.fr, `« ${code} » dit par l'action mais absent du catalogue`);
});

for (const e of echecs) console.error(`✗ ${e}`);
console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
if (echecs.length) process.exit(1);
