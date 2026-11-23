// What the Action does with the writes the propagation has just made.
//
// The propagation commit is distinct from the delivery one: the first carries
// the intent written by a human, the second the write made by the machine.
//
// Everything the step is given reaches it as a value of its environment, never
// pasted into a script: a message or a workflow name holding a quote or a
// `$(…)` is a string like any other.

import { execFileSync } from 'node:child_process';
import { hasPendingPropagation } from '../pending-propagation.mjs';
import { sayIn } from './support.mjs';

/** Runs `gh`, returns what it prints; throws if it fails. */
function defaultGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{
 *   gh?: (args: string[]) => string,
 *   log?: (line: string) => void,
 *   cwd?: string,
 * }} [deps]
 */
export function main(env, { gh = defaultGh, log = console.log, cwd = process.cwd() } = {}) {
  const say = sayIn(env.LANGUE);
  const message = env.INPUT_MESSAGE;
  const mainBranch = env.GITHUB_REF_NAME;

  /** Runs Git here; with `tolerate`, a failure is reported as `false` instead of thrown. */
  const git = (args, { tolerate = false } = {}) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', tolerate ? 'ignore' : 'inherit'] });
    } catch (error) {
      if (tolerate) return false;
      throw error;
    }
  };
  const show = (output) => {
    if (output && output.trim()) log(output.trim());
  };

  // `git diff --quiet` exits 1 when something changed
  if (git(['diff', '--quiet'], { tolerate: true }) !== false) {
    log(say('action-rien-a-commiter'));
    return;
  }

  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
  git(['add', '-A']);
  show(git(['commit', '-m', message, '-m', say('action-commit-corps')]));

  // A protected branch requires checks that a direct push never carries: the
  // propagation therefore goes through a pull request, on which it runs them.
  // The direct push is still attempted first — on an unprotected branch it
  // succeeds, and then imposes no needless review.
  if (git(['push'], { tolerate: true }) !== false) {
    log(say('action-ecritures-poussees'));
    return;
  }

  // A propagation pull request already open carries these writes, or part of
  // them: opening a second one would duplicate them, and the scheduled
  // propagation would open one per hour. We wait for its merge; the next run
  // will propagate whatever remains.
  const open = JSON.parse(gh(['pr', 'list', '--base', mainBranch, '--state', 'open', '--json', 'headRefName']));
  if (hasPendingPropagation(open)) {
    log(`::notice::${say('action-propagation-en-attente')}`);
    return;
  }

  const branch = `propagation/${git(['rev-parse', '--short', 'HEAD']).trim()}`;
  log(`::notice::${say('action-push-refuse', { branche: branch })}`);
  git(['switch', '-c', branch]);
  git(['push', '-u', 'origin', branch]);

  // What the pull request carries is named explicitly, so it can be reviewed
  // without opening it.
  show(gh(['pr', 'create', '--base', mainBranch, '--head', branch, '--title', message, '--body', say('action-demande-corps')]));

  // A pull request opened by the automation's token triggers no workflow:
  // GitHub creates none for any event of that token, except
  // `workflow_dispatch`. The check the main branch requires is therefore
  // launched from here, on the pull request's branch; without it, the pull
  // request would stay blocked until it is closed and reopened. A repo whose
  // workflows predate this launch refuses it: we say so, without failing a
  // propagation already pushed.
  try {
    show(gh(['workflow', 'run', env.INPUT_VERIFICATION, '--ref', branch]));
    log(say('action-verification-lancee'));
  } catch {
    log(`::warning::${say('action-verification-non-lancee', { workflow: env.INPUT_VERIFICATION })}`);
  }
}
