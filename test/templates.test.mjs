// Tests of the template workflows and of the action that links them.
//
// What they protect: a propagation pull request opened with the automation's
// token triggers no workflow — GitHub creates none for any event of that
// token, except `workflow_dispatch`. Without a check, the required status is
// missing, and the pull request stays blocked until someone closes it and
// reopens it by hand. The action therefore runs the check itself; otherwise the
// defect would only show at the next delivery of a scoping.
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

test('each message the action says is in the catalogue', () => {
  const said = [...action.matchAll(/(?:\$\(|^[ \t]+)say ([a-z][a-z0-9-]*)/gm)].map((m) => m[1]);
  isTrue(said.length > 3, `too few messages found (${said.length}): is the search right?`);
  for (const code of said) isTrue(code in MESSAGES.fr, `“${code}” said by the action but missing from the catalogue`);
});

for (const e of failures) console.error(`✗ ${e}`);
console.log(`${passed} passed, ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
