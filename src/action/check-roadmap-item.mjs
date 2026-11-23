// The step that checks the links of a roadmap item on its issue's event, and
// reports them through a comment on the issue — RG-piste-rattachee.

import { join } from 'node:path';
import { main as checkEvent } from '../check-roadmap-item.mjs';

/** @param {NodeJS.ProcessEnv} env */
export function argumentsOf(env) {
  const args = [join(env.GITHUB_WORKSPACE, env.INPUT_REFERENTIEL)];
  if (env.INPUT_EVENEMENT) args.push('--evenement', join(env.GITHUB_WORKSPACE, env.INPUT_EVENEMENT));
  if (env.INPUT_COMMENTER !== 'true') args.push('--sans-commentaire');
  return args;
}

/**
 * `GITHUB_TOKEN` is in the step's environment, from the action's `jeton` input;
 * the module writes the `ecarts` output itself.
 *
 * @param {NodeJS.ProcessEnv} env
 */
export async function main(env) {
  await checkEvent(['node', 'check-roadmap-item', ...argumentsOf(env)]);
}
