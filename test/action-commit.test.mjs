// Tests of the Action's commit step: what it does with the writes the
// propagation has just made.
//
// What they protect: this step decides whether the writes reach the main
// branch directly, through a pull request, or not at all. A regression is
// silent — a duplicated pull request each hour, or a propagation that waits
// for a merge nobody asked for — so each way out is run against real Git
// repos, with a throwaway `origin`. `gh`, which talks to the platform, is the
// only fake.
//
//   node test/action-commit.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/action/commit-writes.mjs';

let passed = 0;
const failures = [];

function isTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/** A work copy with an `origin`; `refuseMain` makes the origin refuse pushes to `main`. */
function scenario({ refuseMain = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'action-commit-'));
  const origin = join(root, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const work = join(root, 'work');
  execFileSync('git', ['clone', '-q', origin, work], { stdio: 'ignore' });
  writeFileSync(join(work, 'rule.md'), 'v1\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'init');
  git(work, 'push', '-q', 'origin', 'HEAD:main');
  git(work, 'branch', '-q', '--set-upstream-to=origin/main');
  if (refuseMain) {
    const hook = join(origin, 'hooks', 'pre-receive');
    mkdirSync(join(origin, 'hooks'), { recursive: true });
    writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do [ "$ref" = refs/heads/main ] && exit 1; done\nexit 0\n');
    chmodSync(hook, 0o755);
    // a machine-wide `core.hooksPath` would otherwise shadow the origin's own hooks
    execFileSync('git', ['-C', origin, 'config', 'core.hooksPath', join(origin, 'hooks')]);
  }
  return { root, origin, work };
}

/** A `gh` that records its calls and answers what the case says. */
function fakeGh({ pending = '[]', workflowFails = false } = {}) {
  const calls = [];
  return {
    calls,
    gh(args) {
      calls.push(args);
      if (args[0] === 'pr' && args[1] === 'list') return pending;
      if (args[0] === 'workflow' && workflowFails) throw new Error('HTTP 404');
      return '';
    },
  };
}

function run(name, options, fn) {
  const s = scenario(options);
  try {
    fn(s);
    passed += 1;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  } finally {
    rmSync(s.root, { recursive: true, force: true });
  }
}

const ENV = (work, extra = {}) => ({
  GITHUB_WORKSPACE: work,
  GITHUB_REF_NAME: 'main',
  INPUT_MESSAGE: 'Propagation des impacts au référentiel',
  INPUT_VERIFICATION: 'Vérification du référentiel',
  LANGUE: 'fr',
  ...extra,
});

const lines = () => {
  const out = [];
  return { out, log: (l) => out.push(l) };
};

run('nothing to commit: nothing is committed, and it is said', {}, ({ work }) => {
  const { gh, calls } = fakeGh();
  const { out, log } = lines();
  main(ENV(work), { gh, log, cwd: work });
  isTrue(git(work, 'log', '--oneline').split('\n').length === 1, 'a commit was made');
  isTrue(out.includes('Référentiel déjà à jour — rien à commiter.'), `said: ${JSON.stringify(out)}`);
  isTrue(calls.length === 0, 'gh was called');
});

run('writes are pushed directly when the branch accepts them', {}, ({ work, origin }) => {
  writeFileSync(join(work, 'rule.md'), 'v2\n');
  const { gh, calls } = fakeGh();
  const { out, log } = lines();
  main(ENV(work), { gh, log, cwd: work });
  isTrue(git(origin, 'log', '-1', '--format=%s', 'main') === 'Propagation des impacts au référentiel', 'subject');
  isTrue(
    git(origin, 'log', '-1', '--format=%b', 'main') === 'Écritures calculées à partir des cadrages livrés.',
    'the body is the catalogue’s',
  );
  isTrue(git(origin, 'log', '-1', '--format=%an', 'main') === 'github-actions[bot]', 'author');
  isTrue(out.includes('Écritures poussées sur la branche principale.'), `said: ${JSON.stringify(out)}`);
  isTrue(calls.length === 0, 'a pull request was opened though the push passed');
});

run('a refused push opens a pull request and launches the check on its branch', { refuseMain: true }, ({ work, origin }) => {
  writeFileSync(join(work, 'rule.md'), 'v2\n');
  const { gh, calls } = fakeGh();
  const { out, log } = lines();
  main(ENV(work), { gh, log, cwd: work });

  const branch = `propagation/${git(work, 'rev-parse', '--short', 'HEAD')}`;
  isTrue(git(origin, 'branch', '--list', branch).includes(branch), 'the branch was not pushed');
  isTrue(out.includes(`::notice::Push direct refusé — la propagation passe par « ${branch} ».`), `said: ${JSON.stringify(out)}`);

  const create = calls.find((c) => c[0] === 'pr' && c[1] === 'create');
  isTrue(create, 'no pull request opened');
  const opt = (name) => create[create.indexOf(name) + 1];
  isTrue(opt('--base') === 'main' && opt('--head') === branch, `base/head: ${create}`);
  isTrue(opt('--title') === 'Propagation des impacts au référentiel', `title: ${opt('--title')}`);
  isTrue(opt('--body').length > 0, 'empty body');

  const launch = calls.find((c) => c[0] === 'workflow' && c[1] === 'run');
  isTrue(launch, 'the check was not launched');
  isTrue(launch[2] === 'Vérification du référentiel' && launch.join(' ').endsWith(`--ref ${branch}`), `launch: ${launch}`);
  isTrue(calls.indexOf(launch) > calls.indexOf(create), 'the check was launched before the pull request exists');
  isTrue(out.includes('Vérification lancée sur la demande de propagation.'), `said: ${JSON.stringify(out)}`);
});

run('a propagation pull request already open stops a second one', { refuseMain: true }, ({ work, origin }) => {
  writeFileSync(join(work, 'rule.md'), 'v2\n');
  const { gh, calls } = fakeGh({ pending: JSON.stringify([{ headRefName: 'propagation/abc1234' }]) });
  const { out, log } = lines();
  main(ENV(work), { gh, log, cwd: work });
  isTrue(!calls.some((c) => c[1] === 'create'), 'a second pull request was opened');
  isTrue(git(origin, 'branch', '--list', 'propagation/*') === '', 'a branch was pushed');
  isTrue(out.some((l) => l.startsWith('::notice::') && l.includes('attend déjà sa fusion')), `said: ${JSON.stringify(out)}`);
});

run('a check that cannot be launched is a warning, not a failure', { refuseMain: true }, ({ work }) => {
  writeFileSync(join(work, 'rule.md'), 'v2\n');
  const { gh } = fakeGh({ workflowFails: true });
  const { out, log } = lines();
  main(ENV(work), { gh, log, cwd: work });
  isTrue(out.some((l) => l.startsWith('::warning::') && l.includes('Vérification du référentiel')), `said: ${JSON.stringify(out)}`);
});

run('the message and the workflow name are taken verbatim, whatever they hold', { refuseMain: true }, ({ work }) => {
  writeFileSync(join(work, 'rule.md'), 'v2\n');
  const message = 'Propagation "des" $(touch piege) `x` impacts';
  const { gh, calls } = fakeGh();
  main(ENV(work, { INPUT_MESSAGE: message, INPUT_VERIFICATION: 'a "b" $c' }), { gh, log: () => {}, cwd: work });
  isTrue(git(work, 'log', '-1', '--format=%s') === message, 'the commit subject changed');
  const create = calls.find((c) => c[1] === 'create');
  isTrue(create[create.indexOf('--title') + 1] === message, 'the title changed');
  isTrue(calls.find((c) => c[0] === 'workflow')[2] === 'a "b" $c', 'the workflow name changed');
});

run('what is said follows the repo’s language', {}, ({ work }) => {
  const { out, log } = lines();
  main(ENV(work, { LANGUE: 'en' }), { gh: fakeGh().gh, log, cwd: work });
  isTrue(out.includes('Specification already up to date — nothing to commit.'), `said: ${JSON.stringify(out)}`);
});

for (const e of failures) console.error(`✗ ${e}`);
console.log(`${passed} passed, ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
