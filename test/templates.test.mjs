// Tests of the template workflows and of the action that links them.
//
// What they protect: a propagation pull request opened with the workflow's
// token gets its `pull_request` runs only once a human approves them, and that
// pending run hides from the pull request the check `workflow_dispatch` ran.
// The action therefore opens it under the identity of the automation's app,
// and, without it, still runs the check itself so that its result can be read;
// otherwise the defect would only show at the next delivery of a scoping.
//
//   node test/templates.test.mjs

import { readFileSync } from 'node:fs';
import { load as loadYaml } from 'js-yaml';
import { MESSAGES } from '../src/messages.mjs';

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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const verification = loadYaml(read('modeles/verification-depot-cadre.yml'));
const propagation = loadYaml(read('modeles/propagation-depot-cadre.yml'));
const action = read('action.yml');

test('the check also runs on demand, the only event the automation’s token can create', () => {
  isTrue('workflow_dispatch' in verification.on, 'the check template does not declare `workflow_dispatch`');
  isTrue('pull_request' in verification.on, 'the check template no longer checks pull requests');
});

test('the propagation is allowed to run a workflow', () => {
  isTrue(propagation.permissions?.actions === 'write', 'the propagation template does not declare `actions: write`');
});

test('the action runs the check on the branch of the pull request it has just opened', () => {
  const opening = action.indexOf('gh pr create');
  const launch = action.search(/gh workflow run "\$\{\{ inputs\.verification \}\}" --ref "\$BRANCH"/);
  isTrue(opening > 0, 'the action no longer opens a propagation pull request');
  isTrue(launch > opening, 'the action does not run the check after opening the pull request');
});

const roadmapItems = loadYaml(read('modeles/pistes-depot-cadre.yml'));
const RUNNER = "${{ vars.SSK_RUNNER_PRIVE && fromJSON(vars.SSK_RUNNER_PRIVE) || 'ubuntu-latest' }}";

test('each job of the templates takes the runner the organisation reserves for its private repos, ubuntu-latest otherwise', () => {
  for (const [name, template] of [['verification', verification], ['propagation', propagation], ['roadmap items', roadmapItems]])
    for (const [job, def] of Object.entries(template.jobs))
      isTrue(def['runs-on'] === RUNNER, `${name}, job ${job}: runs-on is ${JSON.stringify(def['runs-on'])}`);
});

test('the propagation pushes with the deploy key of the environment the organisation names, with the token otherwise', () => {
  const job = propagation.jobs.propager;
  isTrue(job.environment === "${{ vars.SSK_CANON_ENVIRONNEMENT || '' }}", `environment is ${JSON.stringify(job.environment)}`);
  const checkout = job.steps.find((s) => s.uses?.startsWith('actions/checkout@'));
  isTrue(checkout?.with?.['ssh-key'] === '${{ secrets.MAIN_DEPLOY_KEY }}', 'the checkout does not receive MAIN_DEPLOY_KEY');
  const ssh = job.steps.find((s) => /openssh-client/.test(s.run ?? ''));
  isTrue(ssh, 'no step installs the SSH client the key needs');
  isTrue(job.steps.indexOf(ssh) < job.steps.indexOf(checkout), 'the SSH client is installed after the checkout');
  isTrue(ssh.if === "vars.SSK_CANON_ENVIRONNEMENT != ''", `the SSH client step runs on ${JSON.stringify(ssh.if)}`);
});

// Dependabot only updates `.github/workflows/`: the templates would fall behind
// unseen, and a repo brought back to them would go back a version.
test('the templates check out with the version this repo’s own workflows use', () => {
  const own = read('.github/workflows/ci.yml').match(/actions\/checkout@(v\d+)/)?.[1];
  isTrue(own, 'no actions/checkout in ci.yml');
  for (const [name, template] of [['verification', verification], ['propagation', propagation], ['roadmap items', roadmapItems]])
    for (const step of Object.values(template.jobs).flatMap((j) => j.steps).filter((s) => s.uses?.startsWith('actions/checkout@')))
      isTrue(step.uses === `actions/checkout@${own}`, `${name}: ${step.uses}, ci.yml has ${own}`);
});

test('the action reads the cited specifications with the token it is given, and the templates pass it', () => {
  const inputs = loadYaml(action).inputs;
  isTrue('jeton-referentiels-cites' in inputs, 'the action does not declare the `jeton-referentiels-cites` input');
  isTrue(inputs['jeton-referentiels-cites'].required === false, 'the token must stay optional: a public repo is read without it');
  isTrue(
    /SSK_CANON_JETON_CITES: \$\{\{ inputs\.jeton-referentiels-cites \}\}/.test(action),
    'the action does not pass the token to the check as SSK_CANON_JETON_CITES',
  );
  for (const [name, template] of [['verification', verification], ['propagation', propagation]]) {
    const steps = Object.values(template.jobs).flatMap((j) => j.steps).filter((s) => s.uses?.startsWith('ssk-it/ssk-canon-action'));
    isTrue(steps.length > 0, `${name}: the action is no longer called`);
    for (const p of steps)
      isTrue(
        p.with?.['jeton-referentiels-cites'] === '${{ secrets.SSK_CANON_JETON_CITES }}',
        `${name}: the action does not receive the SSK_CANON_JETON_CITES secret`,
      );
  }
});

// A pull request opened with the workflow's token gets its `pull_request`
// runs in an approval-required state, and that pending run blocks the merge
// even when `verifier`, run by `workflow_dispatch`, is green: on
// ssk-terrarium-cadrage, #24 and #25 waited for a human. The token of a GitHub
// App installation triggers the checks like any contributor —
// RG-propagation-identite-dediee.
test('the action takes the identity of the automation’s app, optional, and the template passes it', () => {
  const inputs = loadYaml(action).inputs;
  for (const name of ['application-id', 'application-cle']) {
    isTrue(name in inputs, `the action does not declare the \`${name}\` input`);
    isTrue(inputs[name].required === false, `\`${name}\` must stay optional: a repo without the app falls back on the workflow token`);
  }
  const step = Object.values(propagation.jobs).flatMap((j) => j.steps).find((s) => s.uses?.startsWith('ssk-it/ssk-canon-action'));
  isTrue(step.with?.['application-id'] === '${{ vars.SSK_CANON_APP_ID }}', 'the propagation template does not pass the SSK_CANON_APP_ID variable');
  isTrue(step.with?.['application-cle'] === '${{ secrets.SSK_CANON_APP_CLE }}', 'the propagation template does not pass the SSK_CANON_APP_CLE secret');
});

test('the action gets the app’s token without failing the propagation when it cannot', () => {
  const token = loadYaml(action).runs.steps.find((s) => s.uses?.startsWith('actions/create-github-app-token@'));
  isTrue(token, 'the action does not get an installation token');
  isTrue(token['continue-on-error'] === true, 'an app not installed on the repo would fail the propagation instead of falling back');
  isTrue(/inputs\.application-cle != ''/.test(token.if ?? ''), 'the token is asked for even without the key');
});

test('the action opens the pull request, then asks for its automatic merge, under the app’s identity', () => {
  const opening = action.indexOf('gh pr create');
  const merge = action.search(/gh pr merge "\$BRANCH" --auto/);
  isTrue(merge > opening, 'the action does not ask for the automatic merge after opening the pull request');
  isTrue(/PR_TOKEN="\$\{APP_TOKEN\}"/.test(action), 'the app’s token is not the one the pull request is opened with');
  isTrue(/GH_TOKEN="\$\{PR_TOKEN\}" gh pr create/.test(action), 'the pull request is not opened with the chosen token');
  isTrue(/GH_TOKEN="\$\{PR_TOKEN\}" gh pr merge/.test(action), 'the automatic merge is not asked for with the chosen token');
});

test('the action updates a pending propagation pull request the main branch has overtaken', () => {
  isTrue(/pending-propagation\.mjs" --en-retard/.test(action), 'the action does not look for an overtaken propagation pull request');
  isTrue(/gh pr update-branch/.test(action), 'the action does not update the overtaken pull request');
});

test('each message the action says is in the catalogue', () => {
  const said = [...action.matchAll(/(?:\$\(|^[ \t]+)say ([a-z][a-z0-9-]*)/gm)].map((m) => m[1]);
  isTrue(said.length > 3, `too few messages found (${said.length}): is the search right?`);
  for (const code of said) isTrue(code in MESSAGES.fr, `“${code}” said by the action but missing from the catalogue`);
});

for (const e of failures) console.error(`✗ ${e}`);
console.log(`${passed} passed, ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
