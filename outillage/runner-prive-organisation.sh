#!/bin/bash
#
# Sets on an organisation the SSK_RUNNER_PRIVE variable, which the template workflows
# read to choose their runner — README, « Installation dans un dépôt cadré ».
#
#   1. the variable, visible to the organisation's private repos only, designates its
#      self-hosted runners by their labels;
#   2. read-only: at least one online runner carries these labels, and its group
#      refuses public repos;
#   3. read-only: the variable is in place.
#
# Without it, every run of a private repo — the check of every pull request, the
# propagation of every delivery and its hourly scheduled retry — runs on GitHub's
# runners and is counted against the organisation's plan. On 27 October 2026,
# ssk-it had used up its 3,000 minutes, and no job started any more. Visible to
# private repos only, it leaves a public repo on ubuntu-latest, free for it, and
# which the runner group refuses anyway.
#
# Usage: outillage/runner-prive-organisation.sh <organisation> ['["self-hosted","macOS","ARM64"]']
#
# No credential is asked for: the script goes through the gh session, which must have
# admin rights on the organisation (`gh auth status`, admin:org scope).
# Nothing secret is read or displayed; the body of the writes goes to gh through its
# standard input.
#
# Each write is announced and confirmed before being made; a variable already in
# place with the right value is left as is, and replacing it is a separate write.
# The script can therefore be run again.
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

ORGANISATION="${1:-}"
LABELS="${2:-[\"self-hosted\",\"macOS\",\"ARM64\"]}"
NAME=SSK_RUNNER_PRIVE
[[ "${ORGANISATION}" =~ ^[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 <organisation> ['[\"self-hosted\",\"macOS\",\"ARM64\"]']"
# The workflows apply `fromJSON(...)` to it: a value that is not an array of labels
# would make every job fail at start, without saying why.
jq -e 'type == "array" and length > 0 and all(type == "string")' <<< "${LABELS}" >/dev/null 2>&1 \
    || ko "labels : un tableau JSON de chaînes est attendu, reçu ${LABELS}"
LABELS="$(jq -c . <<< "${LABELS}")"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# Returns the variable as is, or nothing if it does not exist; stops on any other
# error, which a test would mistake for an absence.
read_variable() {
    local output
    if output="$(gh api "orgs/${ORGANISATION}/actions/variables/${NAME}" 2>&1)"; then
        echo "${output}"
    elif grep -q "HTTP 404" <<< "${output}"; then
        echo ""
    else
        ko "variables de ${ORGANISATION} illisibles — droits d'administration manquants ? (${output})"
    fi
}

write_variable() {
    local method="$1" path="$2"
    jq -n --arg name "${NAME}" --arg value "${LABELS}" \
        '{ name: $name, value: $value, visibility: "private" }' \
        | gh api -X "${method}" "${path}" --input - >/dev/null \
        || ko "écriture refusée — droits d'administration de ${ORGANISATION} manquants ?"
}

# --- 1. The variable --------------------------------------------------------------------

echo "1. Variable ${NAME} de ${ORGANISATION}"
CURRENT="$(read_variable)"
if [ -z "${CURRENT}" ]; then
    say "absente"
    say "à créer : ${NAME} = ${LABELS}, visible des seuls dépôts privés"
    if confirm "créer ${NAME} ainsi ?"; then
        write_variable POST "orgs/${ORGANISATION}/actions/variables"
        ok "créée"
    else
        say "laissée absente"
    fi
else
    VALUE="$(jq -r .value <<< "${CURRENT}")"
    VISIBILITY="$(jq -r .visibility <<< "${CURRENT}")"
    say "en place : ${VALUE}, visibilité ${VISIBILITY}"
    if [ "$(jq -c . <<< "${VALUE}" 2>/dev/null || true)" = "${LABELS}" ] && [ "${VISIBILITY}" = private ]; then
        ok "déjà en place : laissée telle quelle"
    else
        say "à remplacer par : ${LABELS}, visible des seuls dépôts privés"
        if confirm "remplacer ${NAME} ?"; then
            write_variable PATCH "orgs/${ORGANISATION}/actions/variables/${NAME}"
            ok "remplacée"
        else
            say "laissée telle quelle"
        fi
    fi
fi
echo

# --- 2. The runners ---------------------------------------------------------------------

echo "2. Runners portant ${LABELS}"
RUNNERS="$(gh api --paginate "orgs/${ORGANISATION}/actions/runners" -q '.runners[]' 2>/dev/null)" \
    || ko "runners de ${ORGANISATION} illisibles"
ONLINE="$(jq -s --argjson labels "${LABELS}" \
    '[ .[] | select(.status == "online") | select([.labels[].name] as $l | all($labels[]; . as $x | $l | index($x))) ] | length' \
    <<< "${RUNNERS}")"
if [ "${ONLINE}" -gt 0 ]; then
    ok "${ONLINE} runner(s) en ligne"
else
    echo "  ✗ aucun runner en ligne ne porte ces labels : les jobs des dépôts privés attendront" >&2
fi
PUBLIC_GROUPS="$(gh api "orgs/${ORGANISATION}/actions/runner-groups" \
    -q '[.runner_groups[] | select(.allows_public_repositories)] | length' 2>/dev/null || echo "?")"
if [ "${PUBLIC_GROUPS}" = 0 ]; then
    ok "aucun groupe de runners n'accepte de dépôt public"
else
    say "groupes acceptant des dépôts publics : ${PUBLIC_GROUPS} — un dépôt public exécuterait le code de ses contributeurs sur ces machines"
fi
echo

# --- 3. Read-only check -----------------------------------------------------------------

echo "3. Vérification"
AFTER="$(read_variable)"
if [ -n "${AFTER}" ] \
    && [ "$(jq -r .value <<< "${AFTER}" | jq -c . 2>/dev/null || true)" = "${LABELS}" ] \
    && [ "$(jq -r .visibility <<< "${AFTER}")" = private ]; then
    ok "les dépôts privés de ${ORGANISATION} prennent leurs runners auto-hébergés"
else
    echo "  ✗ variable absente ou différente : les dépôts privés restent sur les runners de GitHub" >&2
    exit 1
fi
echo
echo "Terminé."
