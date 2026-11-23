// What the steps of the composite actions share.

import { appendFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { formaterAnomalie } from '../anomalies.mjs';

/**
 * A failure of a step. `silent` says that its cause has already been printed —
 * by a child process, for instance — and that the launcher has nothing to add.
 */
export class ActionError extends Error {
  constructor(message, { silent = false } = {}) {
    super(message);
    this.silent = silent;
  }
}

/** Sets an output of the step: `GITHUB_OUTPUT` is a file the platform reads after it. */
export function setOutput(name, value, env = process.env) {
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

/**
 * What the Action says, in the repo's language, from the catalogue —
 * RG-langue-du-depot.
 *
 * @param {string} [language]
 * @returns {(code: string, params?: object) => string}
 */
export function sayIn(language) {
  return (code, params = {}) => formaterAnomalie({ code, params }, language || undefined);
}

/**
 * Runs `npm` in a folder, its output shown.
 *
 * On Windows `npm` is `npm.cmd`, which Node refuses to start without a shell
 * since 20.12 (EINVAL). The arguments are constants, never taken from an
 * input: the shell has nothing to interpret.
 *
 * @param {string[]} args
 * @param {string} cwd
 */
export function runNpm(args, cwd) {
  if (process.platform === 'win32') {
    execSync(`npm ${args.join(' ')}`, { cwd, stdio: 'inherit' });
    return;
  }
  execFileSync('npm', args, { cwd, stdio: 'inherit' });
}
