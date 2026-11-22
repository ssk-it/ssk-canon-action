#!/bin/bash
#
# Opens GitHub Pages to the « Référence de l'API » workflow (.github/workflows/reference-api.yml), which publishes
# the reference of @ssk-it/canon-check there on every merge into main.
#
#   1. Pages is served from GitHub Actions — the workflow publishes itself, and no gh-pages branch needs to be kept;
#   2. read-only check (also alone, --constat): the configuration is in place, and the public address it gives.
#
# It never closes Pages, and touches neither its domain nor its HTTPS setting.
#
# Without this, the publication job fails on its first run on main: Pages does not exist yet for the repo.
#
# Usage: outillage/activer-pages.sh [--depot <propriétaire>/<dépôt>] [--noconfirm] [--dry-run] [--constat] [--aide]
#        (ssk-it/ssk-canon-action by default; DEPOT= also, or the repo alone as first argument)
#
# No credential is asked for: the script goes through the gh session, which must have admin rights on the repo.
# Nothing secret is read or displayed. A banner says what the script acts on before anything is written, then the
# write is announced and confirmed; a Pages already served from GitHub Actions is left as is. The script can
# therefore be run again.
#
# Requirements: gh, jq.

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

parametre DEPOT ssk-it/ssk-canon-action
CHECK_ONLY=0

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --depot <propriétaire>/<dépôt>  le dépôt dont Pages publie la référence (DEPOT=, défaut ${DEPOT})"
    echo "  --constat                       seulement le constat, en lecture seule"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --depot)   fixer DEPOT "${2:?--depot demande <propriétaire>/<dépôt>}"; shift 2 ;;
        --constat) CHECK_ONLY=1; shift ;;
        --aide|-h) aide; exit 0 ;;
        -*)        option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        *)         fixer DEPOT "$1"; shift ;;
    esac
done

[[ "${DEPOT}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || ko "--depot <propriétaire>/<dépôt> attendu (--aide)"
for tool in gh jq; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# Returns the Pages configuration as is, or nothing if Pages is not open; stops on any other error, which a test
# would mistake for an absence.
read_pages() {
    local output
    if output="$(gh api "repos/${DEPOT}/pages" 2>&1)"; then
        echo "${output}"
    elif grep -q "HTTP 404" <<< "${output}"; then
        echo ""
    else
        ko "Pages de ${DEPOT} illisible — droits d'administration manquants ? (${output})"
    fi
}

step_source() {
    etape "1. GitHub Pages de ${DEPOT}"
    local current source
    current="$(read_pages)"
    if [ -z "${current}" ]; then
        dit "fermé"
        if confirmer_ecriture "ouvrir Pages sur ${DEPOT}, servi depuis GitHub Actions"; then
            gh api -X POST "repos/${DEPOT}/pages" -f build_type=workflow >/dev/null \
                || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
            ok "ouvert"
        fi
        return 0
    fi
    source="$(jq -r .build_type <<< "${current}")"
    if [ "${source}" = workflow ]; then
        ok "déjà servi depuis GitHub Actions : laissé tel quel"
        return 0
    fi
    dit "servi depuis une branche (${source}) : le workflow n'y publierait pas"
    if confirmer_ecriture "servir Pages de ${DEPOT} depuis GitHub Actions au lieu de la branche"; then
        gh api -X PUT "repos/${DEPOT}/pages" -f build_type=workflow >/dev/null \
            || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
        ok "servi depuis GitHub Actions"
    fi
}

check() {
    etape "2. Constat, en lecture seule"
    local after
    after="$(read_pages)"
    if [ -n "${after}" ] && [ "$(jq -r .build_type <<< "${after}")" = workflow ]; then
        ok "le workflow peut publier ; adresse : $(jq -r .html_url <<< "${after}")"
    else
        echo "  ✗ Pages fermé ou servi depuis une branche : la publication échouera" >&2
        exit 1
    fi
}

cible "Dépôt" "${DEPOT}"
cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
ecrit "GitHub Pages de ${DEPOT} : ouvert, ou sa source, servi depuis GitHub Actions"
if [ "${CHECK_ONLY}" = 1 ]; then
    option_commune --dry-run
    bandeau "Constat de GitHub Pages de ${DEPOT}, en lecture seule"
else
    bandeau "Ouverture de GitHub Pages de ${DEPOT} au workflow de la référence de l'API"
    step_source
fi
check
echo
echo "Terminé."
