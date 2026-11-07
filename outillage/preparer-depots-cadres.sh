#!/bin/bash
#
# Runs outillage/preparer-depot-cadre.sh on each specification declared by
# ~/.claude/cadrage-canon.json — README, « Installation dans un dépôt cadré ».
#
# A setting added to preparer-depot-cadre.sh only applies to the repos it is run
# again on: deleting branches on merge entered it after most specifications were
# installed, and seventeen of them still had it disabled on 6 November 2026 — 244
# merged branches had piled up there, which the specification consultation took
# for in-progress changes.
#
# Usage: outillage/preparer-depots-cadres.sh [<configuration>]
#        (by default ~/.claude/cadrage-canon.json, of which only the « projets » list is read)
#
# No credential is asked for: each repo goes through the gh session, as with
# preparer-depot-cadre.sh, which announces and has each write confirmed. A repo
# already set is left as is; the script can therefore be run again. A missing clone,
# or one without a GitHub origin, is reported and skipped.
#
# Requirements: gh, jq, and admin rights on each repo.

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
say() { echo "  · $*"; }

for tool in gh jq git; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done

PREPARE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/preparer-depot-cadre.sh"
CONFIGURATION="${1:-${HOME}/.claude/cadrage-canon.json}"
[ -r "${CONFIGURATION}" ] || ko "configuration illisible : ${CONFIGURATION}"

# Read before the loop: preparer-depot-cadre.sh asks its questions on standard input,
# which must stay the terminal.
PROJECTS=()
while IFS= read -r project; do
    PROJECTS+=("${project}")
done < <(jq -r '.projets // [] | .[]' "${CONFIGURATION}")
[ "${#PROJECTS[@]}" -gt 0 ] || ko "aucun référentiel dans ${CONFIGURATION} (liste « projets »)"

repo_of() {
    local url
    url="$(git -C "$1" remote get-url origin 2>/dev/null)" || return 1
    url="${url%.git}"
    [[ "${url}" =~ github\.com[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)$ ]] || return 1
    echo "${BASH_REMATCH[1]}"
}

SKIPPED=()
FAILURES=()
SET_UP=0
for project in "${PROJECTS[@]}"; do
    clone="${project/#\~/${HOME}}"
    if ! repo="$(repo_of "${clone}")"; then
        SKIPPED+=("${project}")
        continue
    fi
    echo "━━ ${repo}"
    if "${PREPARE}" "${repo}"; then
        SET_UP=$((SET_UP + 1))
    else
        FAILURES+=("${repo}")
    fi
done

echo "━━ Bilan"
ok "${SET_UP} référentiel(s) en place"
for project in ${SKIPPED[@]+"${SKIPPED[@]}"}; do
    say "passé, pas de clone avec une origine GitHub : ${project}"
done
for repo in ${FAILURES[@]+"${FAILURES[@]}"}; do
    echo "  ✗ réglage absent ou illisible : ${repo}" >&2
done
[ "${#FAILURES[@]}" = 0 ] || exit 1
