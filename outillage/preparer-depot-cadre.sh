#!/bin/bash
#
# Sets up a scoping repo so that the propagation can write and open its pull
# request, and merged branches do not pile up there — README, « Installation
# dans un dépôt cadré ».
#
#   1. workflows' default permissions read and write, and GitHub Actions
#      allowed to create pull requests — if the organisation does not forbid it;
#   2. deletion of a pull request's branch when it is merged;
#   3. automatic merge allowed, which the propagation asks for on its pull request;
#   4. the propagation workflow passes the identity of the automation's app
#      (SSK_CANON_APP_ID, SSK_CANON_APP_CLE) to the action — by a pull request, the
#      main branch refusing direct pushes;
#   5. read-only: the settings are in place.
#
# Without the app's identity, the propagation opens its pull request with the
# workflow token, whose checks wait for a human's approval: on ssk-terrarium-cadrage,
# #24 and #25 waited on 8 November 2026 — RG-propagation-identite-dediee. The app,
# its variable and its secret are posted once by outillage/application-propagation.sh.
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

# --- 3. Automatic merge -----------------------------------------------------------------

auto_merge() {
    gh api "repos/${REPO}" -q .allow_auto_merge 2>/dev/null \
        || ko "réglages de ${REPO} illisibles"
}

echo "3. Fusion automatique"
# The propagation asks for the automatic merge of its pull request, which the platform
# makes once the required checks are green, and never before — RG-propagation-verifiee.
AUTO_MERGE="$(auto_merge)"
say "autoriser la fusion automatique : ${AUTO_MERGE}"
if [ "${AUTO_MERGE}" = true ]; then
    ok "déjà en place : laissé tel quel"
else
    say "à écrire : autoriser la fusion automatique des demandes de fusion"
    say "les contrôles requis restent requis : une demande ne fusionne qu'une fois verte"
    if confirm "régler ${REPO} ainsi ?"; then
        jq -n '{ allow_auto_merge: true }' \
            | gh api -X PATCH "repos/${REPO}" --input - >/dev/null \
            || ko "écriture refusée — droits d'administration de ${REPO} manquants ?"
        ok "réglé"
    else
        say "laissé tel quel"
    fi
fi
echo

# --- 4. The propagation workflow passes the app -----------------------------------------

APP_LINES=(
    "application-id: \${{ vars.SSK_CANON_APP_ID }}"
    "application-cle: \${{ secrets.SSK_CANON_APP_CLE }}"
)
UPDATE_BRANCH=ssk-canon-application-propagation

# The workflow that calls the action with `appliquer` at true: the automation is
# recognised by its call, not by the name of its files — RG-installation-automatisation.
propagation_workflow() {
    local path content
    while IFS= read -r path; do
        content="$(gh api "repos/${REPO}/contents/${path}" -q .content 2>/dev/null | base64 -d 2>/dev/null)" || continue
        if grep -q 'uses: ssk-it/ssk-canon-action@' <<< "${content}" \
            && grep -Eq "appliquer: *['\"]?true" <<< "${content}"; then
            echo "${path}"
            return 0
        fi
    done < <(gh api "repos/${REPO}/contents/.github/workflows" -q '.[] | select(.type == "file") | .path' 2>/dev/null)
    return 0
}

echo "4. Identité de l'application transmise à la propagation"
WORKFLOW="$(propagation_workflow)"
if [ -z "${WORKFLOW}" ]; then
    echo "  ✗ aucun workflow n'appelle la propagation (ssk-it/ssk-canon-action, appliquer: true) — l'automatisation est-elle installée ?" >&2
else
    CONTENT="$(gh api "repos/${REPO}/contents/${WORKFLOW}" -q .content | base64 -d)"
    if grep -q 'application-id:' <<< "${CONTENT}"; then
        ok "${WORKFLOW} la transmet déjà"
    elif OPEN="$(gh pr list -R "${REPO}" --head "${UPDATE_BRANCH}" --state open --json url -q '.[0].url')" && [ -n "${OPEN}" ]; then
        ok "demande déjà ouverte : ${OPEN}"
    else
        # Two lines added under the `with:` of the action's step, at the indentation
        # of its first key; nothing else in the file changes.
        UPDATED="$(awk -v l1="${APP_LINES[0]}" -v l2="${APP_LINES[1]}" '
            /uses: ssk-it\/ssk-canon-action@/ { step = 1 }
            step && /^[ \t]*with:[ \t]*$/ {
                print
                if ((getline next_line) > 0) {
                    match(next_line, /^[ \t]*/)
                    indent = substr(next_line, 1, RLENGTH)
                    print indent l1
                    print indent l2
                    print next_line
                }
                step = 0
                next
            }
            { print }' <<< "${CONTENT}")"
        if [ "$(grep -c 'application-' <<< "${UPDATED}")" != 2 ]; then
            echo "  ✗ ${WORKFLOW} : bloc « with: » de l'action introuvable — ajouter à la main :" >&2
            for line in "${APP_LINES[@]}"; do echo "      ${line}" >&2; done
        else
            say "à ajouter à ${WORKFLOW}, sous le « with: » de l'action :"
            for line in "${APP_LINES[@]}"; do say "   ${line}"; done
            say "par une demande de fusion depuis ${UPDATE_BRANCH}, fusionnée d'elle-même une fois verte"
            if confirm "ouvrir cette demande sur ${REPO} ?"; then
                DEFAULT="$(gh api "repos/${REPO}" -q .default_branch)"
                BASE="$(gh api "repos/${REPO}/git/ref/heads/${DEFAULT}" -q .object.sha)"
                if ! gh api "repos/${REPO}/git/ref/heads/${UPDATE_BRANCH}" >/dev/null 2>&1; then
                    jq -n --arg ref "refs/heads/${UPDATE_BRANCH}" --arg sha "${BASE}" '{ ref: $ref, sha: $sha }' \
                        | gh api -X POST "repos/${REPO}/git/refs" --input - >/dev/null \
                        || ko "branche ${UPDATE_BRANCH} refusée sur ${REPO}"
                fi
                SHA="$(gh api "repos/${REPO}/contents/${WORKFLOW}?ref=${UPDATE_BRANCH}" -q .sha)"
                # Writing a workflow takes the `workflow` scope of the gh session, apart
                # from the one that writes files — RG-installation-automatisation.
                jq -n --arg message "Transmettre l'application de l'automatisation à la propagation" \
                    --arg content "$(base64 <<< "${UPDATED}" | tr -d '\n')" \
                    --arg sha "${SHA}" --arg branch "${UPDATE_BRANCH}" \
                    '{ message: $message, content: $content, sha: $sha, branch: $branch }' \
                    | gh api -X PUT "repos/${REPO}/contents/${WORKFLOW}" --input - >/dev/null \
                    || ko "écriture de ${WORKFLOW} refusée — la session gh a-t-elle la portée workflow ? (gh auth refresh -s workflow)"
                URL="$(gh pr create -R "${REPO}" --base "${DEFAULT}" --head "${UPDATE_BRANCH}" \
                    --title "Transmettre l'application de l'automatisation à la propagation" \
                    --body "La propagation ouvre sa demande de fusion sous l'identité de l'application de l'automatisation, dont les contrôles se déclenchent sans approbation, et en demande la fusion automatique — RG-propagation-identite-dediee. Posé par \`outillage/preparer-depot-cadre.sh\` de ssk-it/ssk-canon-action.")"
                ok "demande ouverte : ${URL}"
                if gh pr merge "${URL}" --auto --merge >/dev/null 2>&1 \
                    || gh pr merge "${URL}" --auto --squash >/dev/null 2>&1; then
                    ok "fusion automatique demandée"
                else
                    say "fusion automatique refusée : à fusionner une fois verte"
                fi
            else
                say "laissé tel quel"
            fi
        fi
    fi
fi
echo

# --- 5. Read-only check -----------------------------------------------------------------

echo "5. Vérification"
MISSING=0
AFTER="$(read_permissions)"
DELETION="$(branch_deletion)"
AUTO_MERGE="$(auto_merge)"
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
if [ "${AUTO_MERGE}" = true ]; then
    ok "la demande de propagation peut se fusionner d'elle-même"
else
    echo "  ✗ réglage absent : la demande de propagation attendra une fusion à la main" >&2
    MISSING=1
fi
if [ -n "${WORKFLOW}" ] && gh api "repos/${REPO}/contents/${WORKFLOW}" -q .content | base64 -d | grep -q 'application-id:'; then
    ok "la propagation reçoit l'identité de l'application"
elif [ -n "$(gh pr list -R "${REPO}" --head "${UPDATE_BRANCH}" --state open --json url -q '.[0].url')" ]; then
    say "la propagation recevra l'identité de l'application une fois sa demande fusionnée"
else
    echo "  ✗ la propagation ne reçoit pas l'identité de l'application : ses demandes attendront une approbation" >&2
    MISSING=1
fi
[ "${MISSING}" = 0 ] || exit 1
echo
echo "Terminé."
