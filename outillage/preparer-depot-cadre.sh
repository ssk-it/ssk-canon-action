#!/bin/bash
#
# Sets up a scoping repo so that the propagation can write and open its pull
# request, and merged branches do not pile up there — README, « Installation
# dans un dépôt cadré ».
#
#   1. workflows' default permissions read and write, and GitHub Actions
#      allowed to create pull requests — if the organisation does not forbid it;
#   2. deletion of a pull request's branch when it is merged;
#   3. read-only: the settings are in place.
#
# Without permission to create pull requests, a protected main branch refuses the propagation's
# direct push, which then pushes its « propagation/<sha> » branch and fails on
# « GitHub Actions is not permitted to create or approve pull requests »: the merged
# scoping stays without its indexes, and nothing opens it in its place.
#
# Without deletion on merge, each scoping and each propagation leave their branch
# behind them: ssk-canon had thirty, and nothing there told apart any more the one
# that still carried a never-delivered commit. A deleted branch stays readable from
# its pull request, which keeps its commits, and is restored in one click.
#
# Usage: outillage/preparer-depot-cadre.sh <organisation>/<repo>
#
# No credential is asked for: the script goes through the gh session, which must have
# admin rights on the repo (`gh auth status`). Nothing secret is read or displayed;
# the body of the writes goes to gh through its standard input.
#
# Each write is announced and confirmed before being made; a setting already in place is
# left as is. The script can therefore be run again.
#
# Requirements: gh, jq.

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
say() { echo "  · $*"; }

confirm() {
    local answer
    read -r -p "  → $* [o/N] " answer
    [ "${answer}" = "o" ] || [ "${answer}" = "O" ]
}

for tool in gh jq; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done

REPO="${1:-}"
[[ "${REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 <organisation>/<depot>"
ORGANISATION="${REPO%%/*}"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

read_permissions() {
    gh api "repos/${REPO}/actions/permissions/workflow" 2>/dev/null \
        || ko "permissions des workflows de ${REPO} illisibles — dépôt inconnu, ou droits d'administration manquants"
}

# --- 1. Workflow permissions ------------------------------------------------------------

echo "1. Permissions des workflows de ${REPO}"
CURRENT="$(read_permissions)"
WRITE="$(jq -r .default_workflow_permissions <<< "${CURRENT}")"
PULL_REQUESTS="$(jq -r .can_approve_pull_request_reviews <<< "${CURRENT}")"
say "permissions par défaut : ${WRITE} — créer des demandes de fusion : ${PULL_REQUESTS}"

if [ "${WRITE}" = write ] && [ "${PULL_REQUESTS}" = true ]; then
    ok "déjà en place : laissé tel quel"
else
    # An organisation that forbids the setting makes it inapplicable to the repo: GitHub
    # would accept the write with no effect, or refuse it without saying why.
    ORG="$(gh api "orgs/${ORGANISATION}/actions/permissions/workflow" 2>/dev/null || true)"
    if [ -n "${ORG}" ] && [ "$(jq -r .can_approve_pull_request_reviews <<< "${ORG}")" = false ]; then
        ko "l'organisation ${ORGANISATION} interdit aux workflows de créer des demandes de fusion — à autoriser d'abord dans ses réglages"
    fi

    say "à écrire : permissions par défaut « write », créer des demandes de fusion « true »"
    say "rien d'autre : ni les actions autorisées, ni les autres dépôts"
    if confirm "régler ${REPO} ainsi ?"; then
        jq -n '{ default_workflow_permissions: "write", can_approve_pull_request_reviews: true }' \
            | gh api -X PUT "repos/${REPO}/actions/permissions/workflow" --input - >/dev/null \
            || ko "écriture refusée — droits d'administration de ${REPO} manquants ?"
        ok "réglé"
    else
        say "laissé tel quel"
    fi
fi
echo

# --- 2. Deletion of merged branches -----------------------------------------------------

branch_deletion() {
    gh api "repos/${REPO}" -q .delete_branch_on_merge 2>/dev/null \
        || ko "réglages de ${REPO} illisibles"
}

echo "2. Suppression des branches à la fusion"
# Read in an assignment, which `set -e` stops if the read fails: in a test, a failed
# read would pass for a missing setting, and offer to write it.
DELETION="$(branch_deletion)"
say "supprimer la branche à la fusion : ${DELETION}"
if [ "${DELETION}" = true ]; then
    ok "déjà en place : laissé tel quel"
else
    say "à écrire : supprimer la branche d'une demande de fusion quand elle est fusionnée"
    say "les branches déjà fusionnées ne sont pas touchées"
    if confirm "régler ${REPO} ainsi ?"; then
        jq -n '{ delete_branch_on_merge: true }' \
            | gh api -X PATCH "repos/${REPO}" --input - >/dev/null \
            || ko "écriture refusée — droits d'administration de ${REPO} manquants ?"
        ok "réglé"
    else
        say "laissé tel quel"
    fi
fi
echo

# --- 3. Read-only check -----------------------------------------------------------------

echo "3. Vérification"
MISSING=0
AFTER="$(read_permissions)"
DELETION="$(branch_deletion)"
if [ "$(jq -r .default_workflow_permissions <<< "${AFTER}")" = write ] \
    && [ "$(jq -r .can_approve_pull_request_reviews <<< "${AFTER}")" = true ]; then
    ok "la propagation peut écrire et ouvrir sa demande de fusion"
else
    echo "  ✗ réglage absent : la propagation échouera à ouvrir sa demande de fusion" >&2
    MISSING=1
fi
if [ "${DELETION}" = true ]; then
    ok "une branche fusionnée est supprimée"
else
    echo "  ✗ réglage absent : les branches fusionnées resteront" >&2
    MISSING=1
fi
[ "${MISSING}" = 0 ] || exit 1
echo
echo "Terminé."
