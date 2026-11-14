// Tells whether a propagation pull request is already waiting to be merged,
// and which of them the main branch has overtaken.
//
// On a protected branch, the propagation goes through a pull request whose
// branch carries a name derived from its commit (`propagation/<sha>`). It is
// also triggered on a schedule, to catch up on a push GitHub did not deliver:
// without this guard, every run that finds the same pending writes would open
// its own pull request.
//
// A pending one that a scoping merged in the meantime has overtaken waits, when
// the main branch requires an up-to-date branch, for an update nobody makes:
// the propagation updates it — RG-propagation-verifiee.
//
//   gh pr list --state open --json headRefName | node src/pending-propagation.mjs
//   → « oui » ou « non »
//   gh pr list --state open --json number,headRefName,mergeStateStatus \
//     | node src/pending-propagation.mjs --en-retard
//   → the number of each overtaken one, one per line

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The prefix of the branches the propagation opens. */
const PREFIX = 'propagation/';

const fromPropagation = (pullRequest) => pullRequest.headRefName?.startsWith(PREFIX) === true;

/** True when one of the open pull requests comes from the propagation. */
export function hasPendingPropagation(pullRequests) {
  return pullRequests.some(fromPropagation);
}

/** The numbers of the propagation pull requests behind their base branch. */
export function behindPropagations(pullRequests) {
  return pullRequests
    .filter((pullRequest) => fromPropagation(pullRequest) && pullRequest.mergeStateStatus === 'BEHIND')
    .map((pullRequest) => pullRequest.number);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pullRequests = JSON.parse(readFileSync(0, 'utf8'));
  if (process.argv.includes('--en-retard')) {
    for (const number of behindPropagations(pullRequests)) console.log(number);
  } else {
    console.log(hasPendingPropagation(pullRequests) ? 'oui' : 'non');
  }
}
