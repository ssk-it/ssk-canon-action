// What establishes that a scoping is delivered, and what forbids reworking it.
//
// A scoping's status is not declared in its file: it is deduced from the
// repo's state. The main branch is the only fact that establishes delivery —
// see RG-statuts-cadrage. This module is the only place that queries Git;
// `verifier.mjs` receives the result and does not know where it comes from,
// which lets it keep running in a browser.

import { execFileSync } from 'node:child_process';

/** Runs a Git command, or returns null if it fails. */
function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Identifiers of the scopings present on a Git reference.
 *
 * Returns `null` — and not an empty set — when the reference is unreachable.
 * The caller must tell "no delivered scoping" apart from "I don't know": a
 * truncated history would otherwise make the whole specification undelivered,
 * and the propagation would erase rules it believed orphaned.
 *
 * @param {string} root repo root
 * @param {string} ref Git reference, typically `origin/main`
 * @param {string} [folder] the scopings folder, under its declared name
 * @returns {Set<string> | null}
 */
export function listDeliveredScopings(root, ref = 'origin/main', folder = 'cadrages') {
  // A repo without a commit has no HEAD: nothing is delivered there, which is
  // a normal state — a specification just initialised — and not a failure.
  if (ref === 'HEAD' && git(root, ['rev-parse', '--verify', '-q', 'HEAD']) === null)
    return new Set();

  const output = git(root, ['ls-tree', '-d', '--name-only', `${ref}`, `${folder}/`]);
  if (output === null) return null;

  const ids = new Set();
  for (const line of output.split('\n')) {
    const name = line.trim().replace(/\/$/, '').split('/').pop();
    if (name) ids.add(name);
  }
  return ids;
}

/**
 * The content of a file on a reference, or `null` if it does not exist there
 * or the reference is unreachable.
 */
export function readFileAt(root, ref, path) {
  return git(root, ['show', `${ref}:${path}`]);
}

/** True if the reference carries at least one file under this folder. */
export function folderExistsAt(root, ref, folder) {
  return Boolean(git(root, ['ls-tree', '--name-only', ref, `${folder}/`])?.trim());
}

/**
 * The order in which the scopings were delivered on a reference.
 *
 * The identifier does not tell it: it is assigned at preparation, and two
 * scopings prepared in parallel are delivered in the order of their merges,
 * not of their numbers. Delivery is therefore read from the main branch's
 * history, along first parents: for a scoping delivered by a pull request, it
 * is the merge commit that introduces it, whatever the date at which it was
 * committed on its branch.
 *
 * @param {{ folder?: string, file?: string }} [names] the scopings folder
 *   and the file that carries each one, under their declared names
 * @returns {Map<string, number> | null} the delivery rank of each scoping, or
 *   null if the history could not be read
 */
export function deliveryOrder(
  root,
  ref = 'HEAD',
  { folder = 'cadrages', file = 'cadrage.md' } = {},
) {
  const output = git(root, [
    'log',
    '--first-parent',
    '--diff-merges=first-parent',
    '--diff-filter=A',
    '--reverse',
    '--format=@%H',
    '--name-only',
    ref,
    '--',
    folder,
  ]);
  if (output === null) return null;

  const ranks = new Map();
  let rank = 0;
  for (const line of output.split('\n')) {
    if (line.startsWith('@')) {
      rank += 1;
      continue;
    }
    const [top, id, name, ...rest] = line.trim().split('/');
    if (top === folder && name === file && !rest.length && !ranks.has(id)) ranks.set(id, rank);
  }
  return ranks;
}

/**
 * Files changed between a reference and the current state.
 *
 * The comparison starts from their common ancestor (`...`), not from the tip
 * of the reference: otherwise, everything that arrived on the main branch
 * since we branched off would pass for a change of the pull request.
 *
 * @returns {string[] | null} relative paths, or null if the comparison fails
 */
export function listChangedFiles(root, ref = 'origin/main') {
  const output = git(root, ['diff', '--name-only', `${ref}...HEAD`]);
  if (output === null) return null;
  return output.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * The last commit of the current branch that a reference has already merged.
 *
 * A branch in progress branches off the main branch along its first parent:
 * their common ancestor is a commit of the main branch itself. A merged
 * branch, on the other hand, has its common ancestor on the main branch
 * through the second parent of a merge commit — it is the tip the branch had
 * when it was merged. The case arises as soon as a `fetch` follows the merge:
 * the reference then carries the branch's scoping, delivered, but not yet
 * propagated.
 *
 * A branch started from a branch merged since answers the same way, and
 * rightly so: what it still carries from its predecessor is already delivered.
 *
 * @param {string} root repo root
 * @param {string} ref comparison reference, typically `origin/main`
 * @returns {string | null} the abbreviated identifier of that commit, or null
 *   if the branch has not been merged — or if the reference is unreachable,
 *   which the other checks already report
 */
export function mergeBase(root, ref = 'origin/main') {
  const ancestor = git(root, ['merge-base', ref, 'HEAD'])?.trim();
  if (!ancestor) return null;

  const main = git(root, ['rev-list', '--first-parent', ref]);
  if (main === null || main.split('\n').includes(ancestor)) return null;

  return git(root, ['rev-parse', '--short', ancestor])?.trim() ?? ancestor;
}

/**
 * Scopings a pull request carries — those its merge would deliver.
 *
 * Returns `null` when the comparison fails, like `listChangedFiles`: not
 * knowing what the pull request carries is not to be confused with a pull
 * request that carries no scoping, where the delivery check would have
 * nothing to say.
 *
 * @param {string} root repo root
 * @param {string} ref comparison reference, typically `origin/main`
 * @param {string} [folder] the scopings folder, under its declared name
 * @returns {Set<string> | null}
 */
export function listCarriedScopings(root, ref = 'origin/main', folder = 'cadrages') {
  const files = listChangedFiles(root, ref);
  if (files === null) return null;

  const ids = new Set();
  for (const path of [...files, ...listUncommittedFiles(root)]) {
    const parts = path.split('/');
    if (parts[0] === folder && parts.length > 1) ids.add(parts[1]);
  }
  return ids;
}

/**
 * Files of the working tree that the last commit does not carry yet —
 * modified or not even tracked.
 *
 * On a continuous integration run, the tree is clean and this list is empty:
 * it only exists for the check run by hand, where the scoping just written is
 * often not committed yet. Without it, the delivery check would keep quiet at
 * the very moment it would be most useful.
 */
function listUncommittedFiles(root) {
  // `-uall`: without it, an entirely untracked directory is reported as a
  // directory — "cadrages/" rather than the scopings it contains — and the
  // first scoping of a new specification would escape the check.
  const output = git(root, ['status', '--porcelain', '-uall']);
  if (output === null) return [];

  return output
    .split('\n')
    .map((l) => l.slice(3).trim())
    // a rename is written "old -> new": the new one is what counts
    .map((l) => l.split(' -> ').pop())
    .filter(Boolean);
}

/**
 * Delivered scopings that a pull request modifies — what
 * RG-cadrage-livre-immuable forbids.
 *
 * The ban covers the scoping's whole directory, decisions included: a decision
 * added after delivery has been reviewed by no one, whereas the approval bore
 * on what was present when it was given.
 *
 * @param {string[]} files changed paths
 * @param {Set<string>} delivered identifiers present on the main branch
 * @param {string} [folder] the scopings folder, under its declared name
 * @returns {Map<string, string[]>} per scoping, the files involved
 */
export function findModifiedDeliveredScopings(files, delivered, folder = 'cadrages') {
  const touched = new Map();

  for (const path of files) {
    const parts = path.split('/');
    if (parts[0] !== folder || parts.length < 2) continue;

    const id = parts[1];
    if (!delivered.has(id)) continue;

    if (!touched.has(id)) touched.set(id, []);
    touched.get(id).push(path);
  }

  return touched;
}
