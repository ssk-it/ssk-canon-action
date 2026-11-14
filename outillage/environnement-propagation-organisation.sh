#!/bin/bash
#
# Sets on an organisation the SSK_CANON_ENVIRONNEMENT variable, which the propagation
# template reads to push with a deploy key — README, « Branche protégée : la clé de
# déploiement ».
#
#   1. the variable, visible to the organisation's private repos only, names the
#      environment whose MAIN_DEPLOY_KEY secret the propagation receives;
#   2. read-only: the variable is in place.
#
# The environment, its secret and the exemption of the key in the branch rule are
# the organisation's own: this script does not create them. A repo whose
# environment is missing would get one created by its first run, open to every
# branch, with no key: the propagation would then fall back to a pull request.
#
# Usage: outillage/environnement-propagation-organisation.sh <organisation> <environnement>
#
# No credential is asked for: the script goes through the gh session, which must have
# admin rights on the organisation (admin:org scope). Each write is announced and
# confirmed; a variable already in place with the right value is left as is.
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
ENVIRONMENT="${2:-}"
NAME=SSK_CANON_ENVIRONNEMENT
[[ "${ORGANISATION}" =~ ^[A-Za-z0-9_.-]+$ ]] && [[ "${ENVIRONMENT}" =~ ^[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 <organisation> <environnement>"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

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
    jq -n --arg name "${NAME}" --arg value "${ENVIRONMENT}" \
        '{ name: $name, value: $value, visibility: "private" }' \
        | gh api -X "$1" "$2" --input - >/dev/null \
        || ko "écriture refusée — droits d'administration de ${ORGANISATION} manquants ?"
}

echo "1. Variable ${NAME} de ${ORGANISATION}"
CURRENT="$(read_variable)"
if [ -z "${CURRENT}" ]; then
    say "absente"
    if confirm "créer ${NAME} = ${ENVIRONMENT}, visible des seuls dépôts privés ?"; then
        write_variable POST "orgs/${ORGANISATION}/actions/variables"
        ok "créée"
    else
        say "laissée absente"
    fi
elif [ "$(jq -r .value <<< "${CURRENT}")" = "${ENVIRONMENT}" ] && [ "$(jq -r .visibility <<< "${CURRENT}")" = private ]; then
    ok "déjà en place : laissée telle quelle"
else
    say "en place : $(jq -r '.value + ", visibilité " + .visibility' <<< "${CURRENT}")"
    if confirm "remplacer par ${ENVIRONMENT}, visible des seuls dépôts privés ?"; then
        write_variable PATCH "orgs/${ORGANISATION}/actions/variables/${NAME}"
        ok "remplacée"
    else
        say "laissée telle quelle"
    fi
fi
echo

echo "2. Vérification"
AFTER="$(read_variable)"
if [ -n "${AFTER}" ] && [ "$(jq -r .value <<< "${AFTER}")" = "${ENVIRONMENT}" ] \
    && [ "$(jq -r .visibility <<< "${AFTER}")" = private ]; then
    ok "la propagation des dépôts privés de ${ORGANISATION} tourne dans l'environnement ${ENVIRONMENT}"
else
    echo "  ✗ variable absente ou différente : la propagation pousse avec le jeton de l'automatisation" >&2
    exit 1
fi
echo
echo "Terminé."
