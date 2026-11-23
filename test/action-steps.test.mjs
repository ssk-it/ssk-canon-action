// Tests of the steps of the composite actions that are not the commit: getting
// the tool, then verifying and propagating, then the roadmap items — and of the
// launcher that every step goes through.
//
// What they protect: these steps were scripts in the action's YAML, which no
// test ran: a regression showed on the next propagation of every repo, the next
// hour. Here the decisions are run with fakes for what they call, and the
// launcher is run as the platform runs it, on a script file with no extension.
//
//   node test/action-steps.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTool } from '../src/action/fetch-tool.mjs';
import { main as verify } from '../src/action/verify-and-propagate.mjs';
import { argumentsOf } from '../src/action/check-roadmap-item.mjs';

let passed = 0;
const failures = [];

function test(name, fn) {
  const root = mkdtempSync(join(tmpdir(), 'action-steps-'));
  try {
    fn(root);
    passed += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function isTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const REPO = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = join(REPO, 'test', 'fixture-repo');

// --- getting the tool ---

/** A tool folder as GitHub fetches it: the sentinel, and what must be copied. */
function toolFolder(root, sentinel) {
  const folder = join(root, 'outil');
  mkdirSync(join(folder, 'src'), { recursive: true });
  writeFileSync(join(folder, sentinel), '// outil\n');
  writeFileSync(join(folder, 'package.json'), '{}\n');
  return folder;
}

test('the tool is copied outside the calling repo, and its dependencies installed there', (root) => {
  const folder = toolFolder(root, 'src/propagate.mjs');
  const temp = join(root, 'temp');
  mkdirSync(temp);
  const calls = [];
  const destination = fetchTool('propagator', { actionPath: folder, temp, npm: (args, cwd) => calls.push({ args, cwd }) });
  isTrue(destination === join(temp, 'ssk-canon-action'), destination);
  isTrue(existsSync(join(destination, 'src', 'propagate.mjs')), 'not copied');
  isTrue(
    calls.length === 1 && calls[0].args.join(' ') === 'ci --omit=dev' && calls[0].cwd === destination,
    `npm: ${JSON.stringify(calls)}`,
  );
});

test('the roadmap items checker is the repo’s root, above the action’s own folder', (root) => {
  const folder = toolFolder(root, 'src/check-roadmap-item.mjs');
  const pistes = join(folder, 'pistes');
  mkdirSync(pistes);
  const temp = join(root, 'temp');
  mkdirSync(temp);
  const destination = fetchTool('checker', { actionPath: pistes, temp, npm: () => {} });
  isTrue(destination === join(temp, 'ssk-canon-pistes'), destination);
  isTrue(existsSync(join(destination, 'src', 'check-roadmap-item.mjs')), 'not copied');
});

test('a tool whose structure has changed is refused, and says so', (root) => {
  const folder = join(root, 'vide');
  mkdirSync(folder);
  let message;
  try {
    fetchTool('propagator', { actionPath: folder, temp: root, npm: () => {} });
  } catch (e) {
    message = e.message;
  }
  isTrue(message?.startsWith('Propagateur introuvable sous ') && message.endsWith('la structure du dépôt outil a changé.'), `${message}`);
});

// --- verifying and propagating ---

/** The step's environment, as the action's YAML gives it. */
const stepEnv = (root, extra = {}) => ({
  GITHUB_WORKSPACE: root,
  GITHUB_OUTPUT: join(root, 'sorties'),
  GITHUB_EVENT_NAME: 'push',
  INPUT_REFERENTIEL: 'ref',
  INPUT_APPLIQUER: 'false',
  INPUT_BASE: 'origin/main',
  INPUT_IMMUABILITE: 'true',
  ...extra,
});

const outputs = (root) =>
  Object.fromEntries(
    (existsSync(join(root, 'sorties')) ? readFileSync(join(root, 'sorties'), 'utf8') : '')
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('=')),
  );

/** Fakes for the two command-line tools, recording what they are asked. */
function fakes({ propagation = { code: 0, writes: 0 }, check = { code: 0 } } = {}) {
  const calls = { propagation: [], check: [] };
  return {
    calls,
    deps: {
      log: (line) => calls.logs.push(line),
      propagate: (args) => (calls.propagation.push(args), propagation),
      check: (args) => (calls.check.push(args), check),
    },
  };
}
const withLogs = (f) => ((f.calls.logs = []), f);

test('the verification alone checks against the base and writes nothing', (root) => {
  const f = withLogs(fakes());
  verify(stepEnv(root), f.deps);
  isTrue(f.calls.propagation.length === 0, 'it propagated');
  isTrue(JSON.stringify(f.calls.check) === JSON.stringify([[join(root, 'ref'), '--base', 'origin/main']]), JSON.stringify(f.calls.check));
  const out = outputs(root);
  isTrue(out.langue === 'fr' && out.ecritures === '0', JSON.stringify(out));
});

test('a pull request put up for review is asked for the delivery', (root) => {
  const f = withLogs(fakes());
  verify(stepEnv(root, { GITHUB_EVENT_NAME: 'pull_request', PR_DRAFT: 'false' }), f.deps);
  isTrue(f.calls.check[0].includes('--livraison'), JSON.stringify(f.calls.check));
});

test('a draft is exempt from the delivery check', (root) => {
  const f = withLogs(fakes());
  verify(stepEnv(root, { GITHUB_EVENT_NAME: 'pull_request', PR_DRAFT: 'true' }), f.deps);
  isTrue(!f.calls.check[0].includes('--livraison'), JSON.stringify(f.calls.check));
});

test('a run on demand judges the branch as it would be merged', (root) => {
  const f = withLogs(fakes());
  verify(stepEnv(root, { GITHUB_EVENT_NAME: 'workflow_dispatch' }), f.deps);
  isTrue(f.calls.check[0].includes('--livraison'), JSON.stringify(f.calls.check));
});

test('suspending the immutability is warned about, and passed on', (root) => {
  const f = withLogs(fakes());
  verify(stepEnv(root, { INPUT_IMMUABILITE: 'false' }), f.deps);
  isTrue(f.calls.check[0].includes('--sans-immuabilite'), JSON.stringify(f.calls.check));
  isTrue(f.calls.logs.some((l) => l.startsWith('::warning::')), JSON.stringify(f.calls.logs));
});

test('the propagation counts the writes it made, then checks what it wrote against HEAD', (root) => {
  const f = withLogs(fakes({ propagation: { code: 0, writes: 3 } }));
  verify(stepEnv(root, { INPUT_APPLIQUER: 'true' }), f.deps);
  isTrue(JSON.stringify(f.calls.propagation) === JSON.stringify([[join(root, 'ref')]]), JSON.stringify(f.calls.propagation));
  isTrue(JSON.stringify(f.calls.check) === JSON.stringify([[join(root, 'ref'), '--base', 'HEAD']]), JSON.stringify(f.calls.check));
  isTrue(outputs(root).ecritures === '3', JSON.stringify(outputs(root)));
});

test('a propagation that fails stops before the check, and fails the step', (root) => {
  const f = withLogs(fakes({ propagation: { code: 1, writes: 0 } }));
  let failed;
  try {
    verify(stepEnv(root, { INPUT_APPLIQUER: 'true' }), f.deps);
  } catch (e) {
    failed = e;
  }
  isTrue(failed?.silent === true, 'the step did not fail, or repeats what was printed');
  isTrue(f.calls.check.length === 0, 'the check ran after a failed propagation');
});

test('a check that fails fails the step', (root) => {
  const f = withLogs(fakes({ check: { code: 1 } }));
  let failed;
  try {
    verify(stepEnv(root), f.deps);
  } catch (e) {
    failed = e;
  }
  isTrue(failed?.silent === true, 'the step did not fail');
});

test('the language of the repo is read, and given to the next step', (root) => {
  mkdirSync(join(root, 'ref'));
  writeFileSync(join(root, 'ref', 'ssk-canon.yml'), 'schema_version: 1\nlangue: en\n');
  const f = withLogs(fakes());
  verify(stepEnv(root), f.deps);
  isTrue(outputs(root).langue === 'en', JSON.stringify(outputs(root)));
});

// --- the roadmap items ---

test('the roadmap item check is given the repo, the event if any, and comments only when asked', (root) => {
  const env = { GITHUB_WORKSPACE: root, INPUT_REFERENTIEL: 'ref', INPUT_EVENEMENT: '', INPUT_COMMENTER: 'true' };
  isTrue(JSON.stringify(argumentsOf(env)) === JSON.stringify([join(root, 'ref')]), JSON.stringify(argumentsOf(env)));
  const offline = argumentsOf({ ...env, INPUT_EVENEMENT: 'ev.json', INPUT_COMMENTER: 'false' });
  isTrue(
    JSON.stringify(offline) === JSON.stringify([join(root, 'ref'), '--evenement', join(root, 'ev.json'), '--sans-commentaire']),
    JSON.stringify(offline),
  );
});

test('the roadmap item step reports the discrepancies it finds, offline', (root) => {
  const r = runStep(
    root,
    {
      GITHUB_WORKSPACE: REPO,
      GITHUB_OUTPUT: join(root, 'sorties'),
      INPUT_REFERENTIEL: 'test/fixture-repo',
      INPUT_EVENEMENT: 'test/events/piste-mal-rattachee.json',
      INPUT_COMMENTER: 'false',
    },
    'check-roadmap-item',
  );
  isTrue(r.status === 0, `status ${r.status}: ${r.stdout}${r.stderr}`);
  isTrue(outputs(root).ecarts === '1', `${JSON.stringify(outputs(root))}\n${r.stdout}`);
});

// --- the launcher, run as the platform runs a step ---

/** A step's script: one line, in a file with no extension, run by `node`. */
function runStep(root, env, name, ...args) {
  const script = join(root, 'etape');
  const quoted = [name, ...args].map((a) => JSON.stringify(a)).join(', ');
  writeFileSync(
    script,
    `require(require('node:path').join(process.env.TOOL_DIR, 'src', 'action', 'launcher.cjs'))(${quoted})\n`,
  );
  return spawnSync(process.execPath, [script], { env: { ...process.env, TOOL_DIR: REPO, ...env }, encoding: 'utf8', cwd: root });
}

test('a step that fails prints an error annotation and exits non-zero', (root) => {
  const empty = join(root, 'vide');
  mkdirSync(empty);
  const r = runStep(root, { ACTION_PATH: empty, RUNNER_TEMP: root }, 'fetch-tool', 'propagator');
  isTrue(r.status === 1, `status ${r.status}`);
  isTrue(r.stderr.startsWith('::error::Propagateur introuvable sous '), r.stderr);
});

test('a step runs a module of the folder and its output reaches the platform', (root) => {
  // the fixture, made a Git repo, as the action sees a calling repo
  const repo = join(root, 'ref');
  cpSync(FIXTURE, repo, { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=T', '-c', 'user.email=t@e.fr', ...a], { stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  const r = runStep(
    root,
    { ...stepEnv(root, { INPUT_APPLIQUER: 'true' }), RUNNER_TEMP: root },
    'verify-and-propagate',
  );
  isTrue(r.status === 0, `status ${r.status}: ${r.stdout}${r.stderr}`);
  isTrue(r.stdout.includes('Référentiel déjà à jour — rien à propager.'), r.stdout);
  isTrue(r.stdout.includes('Intégrité vérifiée.'), r.stdout);
  isTrue(outputs(root).ecritures === '0' && outputs(root).langue === 'fr', JSON.stringify(outputs(root)));
});

for (const e of failures) console.error(`✗ ${e}`);
console.log(`${passed} passed, ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
