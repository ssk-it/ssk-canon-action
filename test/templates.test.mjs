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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

// The order of the calls — pull request opened, then the check launched on its
// branch — is run against real repos in `action-commit.test.mjs`. What is tested
// here is the wiring: the step is given the name of the workflow to launch.
test('the commit step is given the workflow to launch on the pull request it opens', () => {
  const step = loadYaml(action).runs.steps.find((s) => s.name === 'Commiter les écritures');
  isTrue(step, 'the action no longer has a commit step');
  isTrue(step.env.INPUT_VERIFICATION === '${{ inputs.verification }}', `env: ${JSON.stringify(step.env)}`);
  isTrue(step.env.GH_TOKEN === '${{ github.token }}', 'the step does not receive the token `gh` needs');
});

const roadmapItems = loadYaml(read('modeles/pistes-depot-cadre.yml'));
const RUNNER = "${{ vars.SSK_RUNNER_PRIVE && fromJSON(vars.SSK_RUNNER_PRIVE) || 'ubuntu-latest' }}";

test('each job of the templates takes the runner the organisation reserves for its private repos, ubuntu-latest otherwise', () => {
  for (const [name, template] of [['verification', verification], ['propagation', propagation], ['roadmap items', roadmapItems]])
    for (const [job, def] of Object.entries(template.jobs))
      isTrue(def['runs-on'] === RUNNER, `${name}, job ${job}: runs-on is ${JSON.stringify(def['runs-on'])}`);
});

// A new push to a pull request cancels the check still running on the previous
// one: on the self-hosted runners shared by a private organisation, an outdated
// run holds a runner for nothing. A run started by hand or by the propagation
// (`workflow_dispatch`) is never cancelled: it lands in the group of its branch,
// apart from the pull request's.
test('the check cancels the outdated run of a pull request, and only that one', () => {
  isTrue(verification.concurrency, 'the check template has no `concurrency` block');
  isTrue(
    verification.concurrency.group === '${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}',
    `group is ${JSON.stringify(verification.concurrency.group)}`,
  );
  isTrue(
    verification.concurrency['cancel-in-progress'] === "${{ github.event_name == 'pull_request' }}",
    `cancel-in-progress is ${JSON.stringify(verification.concurrency['cancel-in-progress'])}`,
  );
});

test('the propagation pushes with the deploy key of the environment the organisation names, with the token otherwise', () => {
  const job = propagation.jobs.propager;
  isTrue(job.environment === "${{ vars.SSK_CANON_ENVIRONNEMENT || '' }}", `environment is ${JSON.stringify(job.environment)}`);
  const checkout = job.steps.find((s) => s.uses?.startsWith('actions/checkout@'));
  isTrue(checkout?.with?.['ssh-key'] === '${{ secrets.MAIN_DEPLOY_KEY }}', 'the checkout does not receive MAIN_DEPLOY_KEY');
  const ssh = job.steps.find((s) => /openssh-client/.test(s.run ?? ''));
  isTrue(ssh, 'no step installs the SSH client the key needs');
  isTrue(job.steps.indexOf(ssh) < job.steps.indexOf(checkout), 'the SSH client is installed after the checkout');
  // Linux only: the line is shell, which Windows would not run, and a Mac or a Windows machine has an SSH client
  isTrue(
    ssh.if === "vars.SSK_CANON_ENVIRONNEMENT != '' && runner.os == 'Linux'",
    `the SSH client step runs on ${JSON.stringify(ssh.if)}`,
  );
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

const modules = readdirSync(new URL('../src/action/', import.meta.url))
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => [name, read(`src/action/${name}`)]);

test('each message the action says is in the catalogue', () => {
  const said = modules.flatMap(([, text]) => [...text.matchAll(/\bsay\('([a-z][a-z0-9-]*)'/g)].map((m) => m[1]));
  isTrue(said.length > 3, `too few messages found (${said.length}): is the search right?`);
  for (const code of said) isTrue(code in MESSAGES.fr, `“${code}” said by the action but missing from the catalogue`);
});

// A step in a shell of the platform runs only where that shell is: a self-hosted
// Windows runner has bash only if its service's PATH says so. A step that is a
// Node script runs wherever the action already needs Node.
const ACTIONS = [
  ['action.yml', 'ssk-canon-action'],
  ['pistes/action.yml', 'ssk-canon-pistes'],
];

test('every step of the actions is a Node script, with no shell of the platform', () => {
  for (const [file] of ACTIONS)
    for (const step of loadYaml(read(file)).runs.steps.filter((s) => s.run !== undefined))
      isTrue(step.shell === 'node {0}', `${file}, “${step.name}”: shell is ${JSON.stringify(step.shell)}`);
});

test('nothing an input holds is pasted into a script: it reaches the step as an environment value', () => {
  for (const [file] of ACTIONS)
    for (const step of loadYaml(read(file)).runs.steps.filter((s) => s.run !== undefined))
      isTrue(!/\$\{\{/.test(step.run), `${file}, “${step.name}”: an expression inside the script`);
});

test('each step hands over to a module that exists, through the launcher', () => {
  for (const [file, copy] of ACTIONS)
    for (const step of loadYaml(read(file)).runs.steps.filter((s) => s.run !== undefined)) {
      const call = step.run.match(/launcher\.cjs'\)\)\('([a-z-]+)'/);
      isTrue(call, `${file}, “${step.name}”: no call to the launcher`);
      isTrue(existsSync(new URL(`../src/action/${call[1]}.mjs`, import.meta.url)), `${file}: no module “${call[1]}”`);
      // the steps after the first run from the copy the first one made
      if (!step.run.includes('ACTION_PATH'))
        isTrue(step.run.includes(`'${copy}'`), `${file}, “${step.name}”: does not run from the copy “${copy}”`);
    }
});

test('the templates paste no expression into a script either', () => {
  for (const [name, template] of [['verification', verification], ['propagation', propagation], ['roadmap items', roadmapItems]])
    for (const step of Object.values(template.jobs).flatMap((j) => j.steps).filter((s) => s.run !== undefined))
      isTrue(!/\$\{\{/.test(step.run), `${name}, “${step.name}”: an expression inside the script`);
});

for (const e of failures) console.error(`✗ ${e}`);
console.log(`${passed} passed, ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
