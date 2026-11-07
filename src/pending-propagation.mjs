// Tells whether a propagation pull request is already waiting to be merged.
//
// On a protected branch, the propagation goes through a pull request whose
// branch carries a name derived from its commit (`propagation/<sha>`). It is
// also triggered on a schedule, to catch up on a push GitHub did not deliver:
// without this guard, every run that finds the same pending writes would open
// its own pull request.
//
//   gh pr list --state open --json headRefName | node src/pending-propagation.mjs
//   → « oui » ou « non »

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The prefix of the branches the propagation opens. */
const PREFIX = 'propagation/';

/** True when one of the open pull requests comes from the propagation. */
export function hasPendingPropagation(pullRequests) {
  return pullRequests.some((pullRequest) => pullRequest.headRefName?.startsWith(PREFIX) === true);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pullRequests = JSON.parse(readFileSync(0, 'utf8'));
  console.log(hasPendingPropagation(pullRequests) ? 'oui' : 'non');
}
