#!/bin/bash
#
# Opens GitHub Pages to the « Référence de l'API » workflow
# (.github/workflows/reference-api.yml), which publishes the reference of
# @ssk-it/canon-check there on every merge into main.
#
#   1. Pages is served from GitHub Actions — the workflow publishes itself, and
#      no gh-pages branch needs to be kept;
#   2. read-only: the configuration is in place, and the public address it
#      gives.
#
# Without this, the publication job fails on its first run on main: Pages does
# not exist yet for the repo.
#
# Usage: outillage/activer-pages.sh [<owner>/<repo>]   (ssk-it/ssk-canon-action by default)
#
# No credential is asked for: the script goes through the gh session, which must have
# admin rights on the repo. Nothing secret is read or displayed.
#
# The write is announced and confirmed before being made; a Pages already served from
# GitHub Actions is left as is. The script can therefore be run again.
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

REPO="${1:-ssk-it/ssk-canon-action}"
[[ "${REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 [<propriétaire>/<dépôt>]"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# Returns the Pages configuration as is, or nothing if Pages is not open;
# stops on any other error, which a test would mistake for an absence.
read_pages() {
    local output
    if output="$(gh api "repos/${REPO}/pages" 2>&1)"; then
        echo "${output}"
    elif grep -q "HTTP 404" <<< "${output}"; then
        echo ""
    else
        ko "Pages de ${REPO} illisible — droits d'administration manquants ? (${output})"
    fi
}

# --- 1. The Pages source ----------------------------------------------------------------

echo "1. GitHub Pages de ${REPO}"
CURRENT="$(read_pages)"
if [ -z "${CURRENT}" ]; then
    say "fermé"
    if confirm "ouvrir Pages, servi depuis GitHub Actions ?"; then
        gh api -X POST "repos/${REPO}/pages" -f build_type=workflow >/dev/null \
            || ko "écriture refusée — droits d'administration de ${REPO} manquants ?"
        ok "ouvert"
    else
        say "laissé fermé"
    fi
else
    SOURCE="$(jq -r .build_type <<< "${CURRENT}")"
    if [ "${SOURCE}" = workflow ]; then
        ok "déjà servi depuis GitHub Actions : laissé tel quel"
    else
        say "servi depuis une branche (${SOURCE}) : le workflow n'y publierait pas"
        if confirm "le servir depuis GitHub Actions ?"; then
            gh api -X PUT "repos/${REPO}/pages" -f build_type=workflow >/dev/null \
                || ko "écriture refusée — droits d'administration de ${REPO} manquants ?"
            ok "servi depuis GitHub Actions"
        else
            say "laissé tel quel"
        fi
    fi
fi
echo

# --- 2. Read-only check -----------------------------------------------------------------

echo "2. Vérification"
AFTER="$(read_pages)"
if [ -n "${AFTER}" ] && [ "$(jq -r .build_type <<< "${AFTER}")" = workflow ]; then
    ok "le workflow peut publier ; adresse : $(jq -r .html_url <<< "${AFTER}")"
else
    echo "  ✗ Pages fermé ou servi depuis une branche : la publication échouera" >&2
    exit 1
fi
echo
echo "Terminé."
