#!/bin/bash
#
# Sets on an organisation the SSK_RUNNER_PRIVE variable, which the template workflows read to choose their runner —
# README, « Installation dans un dépôt cadré ».
#
#   1. the variable, visible to the organisation's private repos only, designates its self-hosted runners by their
#      labels;
#   2. read-only: at least one online runner carries these labels, and its group refuses public repos;
#   3. read-only check (also alone, --constat): the variable is in place.
#
# It registers no runner and changes no runner group: it only reports what it sees. It deletes nothing.
#
# Without it, every run of a private repo — the check of every pull request, the propagation of every delivery and
# its hourly scheduled retry — runs on GitHub's runners and is counted against the organisation's plan. On
# 27 October 2026, ssk-it had used up its 3,000 minutes, and no job started any more. Visible to private repos only,
# it leaves a public repo on ubuntu-latest, free for it, and which the runner group refuses anyway.
#
# Usage: outillage/runner-prive-organisation.sh --organisation <organisation> [--labels '["self-hosted","macOS","ARM64"]']
#            [--noconfirm] [--dry-run] [--constat] [--aide]
#        ORGANISATION= and LABELS= also, or both alone: <organisation> ['<labels>']
#
# No credential is asked for: the script goes through the gh session, which must have admin rights on the
# organisation (`gh auth status`, admin:org scope). Nothing secret is read or displayed; the body of the writes goes
# to gh through its standard input. A banner says what the script acts on before anything is written, then each
# write is announced and confirmed; a variable already in place with the right value is left as is, and replacing
# it is a separate write. The script can therefore be run again.
#
# Requirements: gh, jq.

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

parametre ORGANISATION ""
parametre LABELS '["self-hosted","macOS","ARM64"]'
NAME=SSK_RUNNER_PRIVE
CHECK_ONLY=0
POSITIONAL=()

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --organisation <nom>  l'organisation GitHub (ORGANISATION=)"
    echo "  --labels <json>       les labels de ses runners auto-hébergés, en tableau JSON (LABELS=, défaut ${LABELS})"
    echo "  --constat             seulement le constat, en lecture seule"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --organisation) fixer ORGANISATION "${2:?--organisation demande un nom}"; shift 2 ;;
        --labels)       fixer LABELS "${2:?--labels demande un tableau JSON}"; shift 2 ;;
        --constat)      CHECK_ONLY=1; shift ;;
        --aide|-h)      aide; exit 0 ;;
        -*)             option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        *)              POSITIONAL+=("$1"); shift ;;
    esac
done
# The former positional form: <organisation> ['<labels>'].
[ "${#POSITIONAL[@]}" -le 2 ] || ko "trop d'arguments (--aide)"
[ "${#POSITIONAL[@]}" -lt 1 ] || fixer ORGANISATION "${POSITIONAL[0]}"
[ "${#POSITIONAL[@]}" -lt 2 ] || fixer LABELS "${POSITIONAL[1]}"

[[ "${ORGANISATION}" =~ ^[A-Za-z0-9_.-]+$ ]] || ko "--organisation attendue (--aide)"
for tool in gh jq; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done
# The workflows apply `fromJSON(...)` to it: a value that is not an array of labels would make every job fail at
# start, without saying why.
jq -e 'type == "array" and length > 0 and all(type == "string")' <<< "${LABELS}" >/dev/null 2>&1 \
    || ko "labels : un tableau JSON de chaînes est attendu, reçu ${LABELS}"
LABELS="$(jq -c . <<< "${LABELS}")"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# Returns the variable as is, or nothing if it does not exist; stops on any other error, which a test would
# mistake for an absence.
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

step_variable() {
    etape "1. Variable ${NAME} de ${ORGANISATION}"
    local current value visibility
    current="$(read_variable)"
    if [ -z "${current}" ]; then
        dit "absente"
        if confirmer_ecriture "créer ${NAME} = ${LABELS} dans ${ORGANISATION}, visible des seuls dépôts privés"; then
            write_variable POST "orgs/${ORGANISATION}/actions/variables"
            ok "créée"
        fi
        return 0
    fi
    value="$(jq -r .value <<< "${current}")"
    visibility="$(jq -r .visibility <<< "${current}")"
    dit "en place : ${value}, visibilité ${visibility}"
    if [ "$(jq -c . <<< "${value}" 2>/dev/null || true)" = "${LABELS}" ] && [ "${visibility}" = private ]; then
        ok "déjà en place : laissée telle quelle"
    elif confirmer_ecriture "remplacer ${NAME} par ${LABELS}, visible des seuls dépôts privés"; then
        write_variable PATCH "orgs/${ORGANISATION}/actions/variables/${NAME}"
        ok "remplacée"
    fi
}

step_runners() {
    etape "2. Runners portant ${LABELS}"
    local runners online public_groups
    runners="$(gh api --paginate "orgs/${ORGANISATION}/actions/runners" -q '.runners[]' 2>/dev/null)" \
        || ko "runners de ${ORGANISATION} illisibles"
    online="$(jq -s --argjson labels "${LABELS}" \
        '[ .[] | select(.status == "online") | select([.labels[].name] as $l | all($labels[]; . as $x | $l | index($x))) ] | length' \
        <<< "${runners}")"
    if [ "${online}" -gt 0 ]; then
        ok "${online} runner(s) en ligne"
    else
        echo "  ✗ aucun runner en ligne ne porte ces labels : les jobs des dépôts privés attendront" >&2
    fi
    public_groups="$(gh api "orgs/${ORGANISATION}/actions/runner-groups" \
        -q '[.runner_groups[] | select(.allows_public_repositories)] | length' 2>/dev/null || echo "?")"
    if [ "${public_groups}" = 0 ]; then
        ok "aucun groupe de runners n'accepte de dépôt public"
    else
        dit "groupes acceptant des dépôts publics : ${public_groups} — un dépôt public exécuterait le code de ses contributeurs sur ces machines"
    fi
}

check() {
    etape "3. Constat, en lecture seule"
    local after
    after="$(read_variable)"
    if [ -n "${after}" ] \
        && [ "$(jq -r .value <<< "${after}" | jq -c . 2>/dev/null || true)" = "${LABELS}" ] \
        && [ "$(jq -r .visibility <<< "${after}")" = private ]; then
        ok "les dépôts privés de ${ORGANISATION} prennent leurs runners auto-hébergés"
    else
        echo "  ✗ variable absente ou différente : les dépôts privés restent sur les runners de GitHub" >&2
        exit 1
    fi
}

cible "Organisation" "${ORGANISATION}"
cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
ecrit "la variable d'organisation ${NAME} = ${LABELS}, visible des seuls dépôts privés"
if [ "${CHECK_ONLY}" = 1 ]; then
    option_commune --dry-run
    bandeau "Constat de ${NAME} dans ${ORGANISATION}, en lecture seule"
else
    bandeau "Runners auto-hébergés des dépôts privés de ${ORGANISATION}"
    step_variable
fi
step_runners
check
echo
echo "Terminé."
