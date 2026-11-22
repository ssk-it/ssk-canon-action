#!/bin/bash
#
# Sets on an organisation the SSK_CANON_ENVIRONNEMENT variable, which the propagation template reads to push with a
# deploy key — README, « Branche protégée : la clé de déploiement ».
#
#   1. the variable, visible to the organisation's private repos only, names the environment whose MAIN_DEPLOY_KEY
#      secret the propagation receives;
#   2. read-only check (also alone, --constat): the variable is in place.
#
# The environment, its secret and the exemption of the key in the branch rule are the organisation's own: this
# script does not create them, and deletes nothing. A repo whose environment is missing would get one created by
# its first run, open to every branch, with no key: the propagation would then fall back to a pull request.
#
# Usage: outillage/environnement-propagation-organisation.sh --organisation <organisation> --environnement <nom>
#            [--noconfirm] [--dry-run] [--constat] [--aide]
#        ORGANISATION= and ENVIRONNEMENT= also, or both alone: <organisation> <environnement>
#
# No credential is asked for: the script goes through the gh session, which must have admin rights on the
# organisation (admin:org scope). A banner says what the script acts on before anything is written, then each
# write is announced and confirmed; a variable already in place with the right value is left as is, and replacing
# a different one is a write of its own.
#
# Requirements: gh, jq.

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

parametre ORGANISATION ""
parametre ENVIRONNEMENT ""
NAME=SSK_CANON_ENVIRONNEMENT
CHECK_ONLY=0
POSITIONAL=()

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --organisation <nom>   l'organisation GitHub (ORGANISATION=)"
    echo "  --environnement <nom>  l'environnement des dépôts qui porte MAIN_DEPLOY_KEY (ENVIRONNEMENT=)"
    echo "  --constat              seulement le constat, en lecture seule"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --organisation)  fixer ORGANISATION "${2:?--organisation demande un nom}"; shift 2 ;;
        --environnement) fixer ENVIRONNEMENT "${2:?--environnement demande un nom}"; shift 2 ;;
        --constat)       CHECK_ONLY=1; shift ;;
        --aide|-h)       aide; exit 0 ;;
        -*)              option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        *)               POSITIONAL+=("$1"); shift ;;
    esac
done
# The former positional form: <organisation> <environnement>.
[ "${#POSITIONAL[@]}" -le 2 ] || ko "trop d'arguments (--aide)"
[ "${#POSITIONAL[@]}" -lt 1 ] || fixer ORGANISATION "${POSITIONAL[0]}"
[ "${#POSITIONAL[@]}" -lt 2 ] || fixer ENVIRONNEMENT "${POSITIONAL[1]}"

[[ "${ORGANISATION}" =~ ^[A-Za-z0-9_.-]+$ ]] && [[ "${ENVIRONNEMENT}" =~ ^[A-Za-z0-9_.-]+$ ]] \
    || ko "--organisation et --environnement attendus (--aide)"
for tool in gh jq; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done
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
    jq -n --arg name "${NAME}" --arg value "${ENVIRONNEMENT}" \
        '{ name: $name, value: $value, visibility: "private" }' \
        | gh api -X "$1" "$2" --input - >/dev/null \
        || ko "écriture refusée — droits d'administration de ${ORGANISATION} manquants ?"
}

step_variable() {
    etape "1. Variable ${NAME} de ${ORGANISATION}"
    local current
    current="$(read_variable)"
    if [ -z "${current}" ]; then
        dit "absente"
        if confirmer_ecriture "créer ${NAME} = ${ENVIRONNEMENT} dans ${ORGANISATION}, visible des seuls dépôts privés"; then
            write_variable POST "orgs/${ORGANISATION}/actions/variables"
            ok "créée"
        fi
    elif [ "$(jq -r .value <<< "${current}")" = "${ENVIRONNEMENT}" ] && [ "$(jq -r .visibility <<< "${current}")" = private ]; then
        ok "déjà en place : laissée telle quelle"
    else
        dit "en place : $(jq -r '.value + ", visibilité " + .visibility' <<< "${current}")"
        if confirmer_ecriture "remplacer ${NAME} par ${ENVIRONNEMENT}, visible des seuls dépôts privés"; then
            write_variable PATCH "orgs/${ORGANISATION}/actions/variables/${NAME}"
            ok "remplacée"
        fi
    fi
}

check() {
    etape "2. Constat, en lecture seule"
    local after
    after="$(read_variable)"
    if [ -n "${after}" ] && [ "$(jq -r .value <<< "${after}")" = "${ENVIRONNEMENT}" ] \
        && [ "$(jq -r .visibility <<< "${after}")" = private ]; then
        ok "la propagation des dépôts privés de ${ORGANISATION} tourne dans l'environnement ${ENVIRONNEMENT}"
    else
        echo "  ✗ variable absente ou différente : la propagation pousse avec le jeton de l'automatisation" >&2
        exit 1
    fi
}

cible "Organisation" "${ORGANISATION}"
cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
ecrit "la variable d'organisation ${NAME} = ${ENVIRONNEMENT}, visible des seuls dépôts privés"
if [ "${CHECK_ONLY}" = 1 ]; then
    option_commune --dry-run
    bandeau "Constat de ${NAME} dans ${ORGANISATION}, en lecture seule"
else
    bandeau "Environnement de la propagation pour ${ORGANISATION}"
    step_variable
fi
check
echo
echo "Terminé."
