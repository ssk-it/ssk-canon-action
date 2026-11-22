#!/bin/bash
#
# Runs outillage/preparer-depot-cadre.sh on each specification declared by ~/.claude/cadrage-canon.json — README,
# « Installation dans un dépôt cadré ». It does nothing else: each repo's writes are announced and confirmed by
# preparer-depot-cadre.sh, after this script's single banner.
#
# It creates no repo and sets no required check: it passes neither --source nor --controles, which belong to one
# repo at a time. It deletes nothing.
#
# A setting added to preparer-depot-cadre.sh only applies to the repos it is run again on: deleting branches on
# merge entered it after most specifications were installed, and seventeen of them still had it disabled on
# 6 November 2026 — 244 merged branches had piled up there, which the specification consultation took for
# in-progress changes.
#
# Usage: outillage/preparer-depots-cadres.sh [--configuration <fichier>] [--noconfirm] [--dry-run] [--constat] [--aide]
#        (by default ~/.claude/cadrage-canon.json, of which only the « projets » list is read; CONFIGURATION= also)
#
# No credential is asked for: each repo goes through the gh session, as with preparer-depot-cadre.sh. A repo
# already set is left as is; the script can therefore be run again. A missing clone, or one without a GitHub
# origin, is reported and skipped.
#
# Requirements: gh, jq, git, and admin rights on each repo.

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

parametre CONFIGURATION "${HOME}/.claude/cadrage-canon.json"
CHECK_ONLY=0

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --configuration <fichier>  la liste des référentiels (CONFIGURATION=, défaut ${CONFIGURATION})"
    echo "  --constat                  seulement le constat de chaque référentiel, en lecture seule"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --configuration) fixer CONFIGURATION "${2:?--configuration demande un fichier}"; shift 2 ;;
        --constat)       CHECK_ONLY=1; shift ;;
        --aide|-h)       aide; exit 0 ;;
        -*)              option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        # The former positional form.
        *)               fixer CONFIGURATION "$1"; shift ;;
    esac
done

for tool in gh jq git; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done
[ -r "${CONFIGURATION}" ] || ko "configuration illisible : ${CONFIGURATION}"
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

repo_of() {
    local url
    url="$(git -C "$1" remote get-url origin 2>/dev/null)" || return 1
    url="${url%.git}"
    [[ "${url}" =~ github\.com[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)$ ]] || return 1
    echo "${BASH_REMATCH[1]}"
}

# Read before the banner, which lists them.
REPOS=()
SKIPPED=()
while IFS= read -r project; do
    if repo="$(repo_of "${project/#\~/${HOME}}")"; then
        REPOS+=("${repo}")
    else
        SKIPPED+=("${project}")
    fi
done < <(jq -r '.projets // [] | .[]' "${CONFIGURATION}")
[ "${#REPOS[@]}" -gt 0 ] || ko "aucun référentiel avec une origine GitHub dans ${CONFIGURATION} (liste « projets »)"

cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
for repo in "${REPOS[@]}"; do cible "Référentiel" "${repo}"; done
ecrit "sur chacun, ce qu'écrit preparer-depot-cadre.sh sans --source ni --controles :"
ecrit "  le réglage « supprimer la branche à la fusion »"
ecrit "  le réglage « les workflows peuvent créer des demandes de fusion »"
if [ "${CHECK_ONLY}" = 1 ]; then
    option_commune --dry-run
    bandeau "Constat des référentiels de cadrage, en lecture seule"
else
    bandeau "Préparation des référentiels de cadrage"
fi

export EC_ORCHESTRE=1
MODES=()
while IFS= read -r mode; do MODES+=("${mode}"); done < <(modes_communs)
[ "${CHECK_ONLY}" = 0 ] || MODES+=(--constat)
FAILURES=()
SET_UP=0
for repo in "${REPOS[@]}"; do
    echo
    echo "━━ ${repo}"
    if "${TOOLS}/preparer-depot-cadre.sh" ${MODES[@]+"${MODES[@]}"} --depot "${repo}"; then
        SET_UP=$((SET_UP + 1))
    else
        FAILURES+=("${repo}")
    fi
done

echo
echo "━━ Bilan"
ok "${SET_UP} référentiel(s) en place"
for project in ${SKIPPED[@]+"${SKIPPED[@]}"}; do
    dit "passé, pas de clone avec une origine GitHub : ${project}"
done
for repo in ${FAILURES[@]+"${FAILURES[@]}"}; do
    echo "  ✗ réglage absent ou illisible : ${repo}" >&2
done
[ "${#FAILURES[@]}" = 0 ] || exit 1
