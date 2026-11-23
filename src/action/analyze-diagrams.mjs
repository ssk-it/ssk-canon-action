// The diagrams, read by Mermaid at the version Skanon draws with — scoping
// 2026-074.
//
// A step of its own, with no token in its environment: Mermaid's parser carries
// known vulnerabilities, accepted for text written by chosen authors
// (ADR-langage-de-diagramme, decision 03). It runs in a child process, as it
// always did, so that nothing of the step's own process is shared with it.
// Not on the propagation, after the merge: a diagram there is already
// delivered, and refusing it would only stop the propagation.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ActionError, runNpm } from './support.mjs';

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ npm?: typeof runNpm }} [deps]
 */
export function main(env, { npm = runNpm } = {}) {
  const analyzer = join(env.RUNNER_TEMP, 'ssk-canon-action', 'analyseur-mermaid');
  npm(['ci', '--omit=dev', '--silent'], analyzer);

  const target = join(env.GITHUB_WORKSPACE, env.INPUT_REFERENTIEL);
  const result = spawnSync(process.execPath, ['verifier.mjs', target, '--base', env.INPUT_BASE], {
    cwd: analyzer,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  // the child has printed what it refuses
  if (result.status !== 0) throw new ActionError('', { silent: true });
}
