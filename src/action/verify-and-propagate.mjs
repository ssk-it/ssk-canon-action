// The step that verifies the specification and, when asked, propagates the
// impacts of the delivered scopings.
//
// What the Action writes is given in the specification's language, and read
// from the library's catalogue, like the rest — RG-langue-du-depot.

import { join } from 'node:path';
import { languageOf, runCli as runCheck } from '../check.mjs';
import { runCli as runPropagation } from '../propagate.mjs';
import { ActionError, sayIn, setOutput } from './support.mjs';

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{
 *   propagate?: typeof runPropagation,
 *   check?: typeof runCheck,
 *   log?: (line: string) => void,
 * }} [deps]
 */
export function main(env, { propagate = runPropagation, check: runCheckCli = runCheck, log = console.log } = {}) {
  const target = join(env.GITHUB_WORKSPACE, env.INPUT_REFERENTIEL);
  const language = languageOf(target);
  setOutput('langue', language, env);
  const say = sayIn(language);

  // The check clones the cited specifications with `SSK_CANON_JETON_CITES`, which
  // is in the step's environment: it is never shown, Git's output being silenced.
  let writes = 0;

  if (env.INPUT_APPLIQUER === 'true') {
    const propagation = propagate([target]);
    writes = propagation.writes;
    if (propagation.code !== 0) throw new ActionError('', { silent: true });

    // What the propagation has just written is checked nowhere else: its commit
    // is pushed by the automation's token, and a push made by that token
    // triggers no workflow. Here, in the same run, is the only moment the final
    // state can be read — RG-propagation-verifiee.
    // "HEAD" and not the default value: it is the reference the propagator
    // itself holds as the delivery, and two different notions of "delivered"
    // would contradict each other by one push.
    if (runCheckCli([target, '--base', 'HEAD']).code !== 0) throw new ActionError('', { silent: true });
  } else {
    // The check compares with the main branch: it is the only mode where the
    // immutability of a delivered scoping can be checked, the difference
    // between a pull request and its base existing nowhere else.
    const args = [target, '--base', env.INPUT_BASE];
    if (env.INPUT_IMMUABILITE !== 'true') {
      args.push('--sans-immuabilite');
      log(`::warning::${say('action-immuabilite-suspendue')}`);
    }
    // A pull request put up for review announces its delivery: from then on it
    // is asked for what the merge will require, while there is still time to
    // write it. A draft is exempt — RG-controle-de-livraison. Run on demand —
    // by the propagation on the pull request it opens, or by hand —, it judges
    // the branch as it would be merged: no draft announces itself there.
    const event = env.GITHUB_EVENT_NAME;
    if ((event === 'pull_request' && env.PR_DRAFT !== 'true') || event === 'workflow_dispatch') {
      args.push('--livraison');
    }
    if (runCheckCli(args).code !== 0) throw new ActionError('', { silent: true });
  }

  setOutput('ecritures', writes, env);
}
