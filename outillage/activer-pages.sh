#!/bin/bash
#
# Ouvre GitHub Pages au workflow « Référence de l'API »
# (.github/workflows/reference-api.yml), qui y publie la référence de
# @ssk-it/canon-check à chaque fusion sur main.
#
#   1. Pages est servi depuis GitHub Actions — le workflow publie lui-même, et
#      aucune branche gh-pages n'est à tenir ;
#   2. en lecture seule : la configuration est en place, et l'adresse publique
#      qu'elle donne.
#
# Sans cela, le job de publication échoue à son premier passage sur main : Pages
# n'existe pas encore pour le dépôt.
#
# Usage : outillage/activer-pages.sh [<propriétaire>/<dépôt>]   (ssk-it/ssk-canon-action par défaut)
#
# Aucun identifiant n'est demandé : le script passe par la session de gh, qui doit avoir
# les droits d'administration du dépôt. Rien de secret n'est lu ni affiché.
#
# L'écriture est annoncée et confirmée avant d'être faite ; un Pages déjà servi depuis
# GitHub Actions est laissé tel quel. Le script peut donc être relancé.
#
# Prérequis : gh, jq.

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
dit() { echo "  · $*"; }

confirmer() {
    local reponse
    read -r -p "  → $* [o/N] " reponse
    [ "${reponse}" = "o" ] || [ "${reponse}" = "O" ]
}

for outil in gh jq; do
    command -v "${outil}" >/dev/null || ko "${outil} introuvable"
done

DEPOT="${1:-ssk-it/ssk-canon-action}"
[[ "${DEPOT}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 [<propriétaire>/<dépôt>]"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# Rend la configuration de Pages telle quelle, ou rien si Pages n'est pas ouvert ;
# s'arrête sur toute autre erreur, qu'un test confondrait avec une absence.
lire() {
    local sortie
    if sortie="$(gh api "repos/${DEPOT}/pages" 2>&1)"; then
        echo "${sortie}"
    elif grep -q "HTTP 404" <<< "${sortie}"; then
        echo ""
    else
        ko "Pages de ${DEPOT} illisible — droits d'administration manquants ? (${sortie})"
    fi
}

# --- 1. La source de Pages --------------------------------------------------------------

echo "1. GitHub Pages de ${DEPOT}"
ACTUELLE="$(lire)"
if [ -z "${ACTUELLE}" ]; then
    dit "fermé"
    if confirmer "ouvrir Pages, servi depuis GitHub Actions ?"; then
        gh api -X POST "repos/${DEPOT}/pages" -f build_type=workflow >/dev/null \
            || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
        ok "ouvert"
    else
        dit "laissé fermé"
    fi
else
    SOURCE="$(jq -r .build_type <<< "${ACTUELLE}")"
    if [ "${SOURCE}" = workflow ]; then
        ok "déjà servi depuis GitHub Actions : laissé tel quel"
    else
        dit "servi depuis une branche (${SOURCE}) : le workflow n'y publierait pas"
        if confirmer "le servir depuis GitHub Actions ?"; then
            gh api -X PUT "repos/${DEPOT}/pages" -f build_type=workflow >/dev/null \
                || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
            ok "servi depuis GitHub Actions"
        else
            dit "laissé tel quel"
        fi
    fi
fi
echo

# --- 2. Contrôle en lecture seule -------------------------------------------------------

echo "2. Vérification"
APRES="$(lire)"
if [ -n "${APRES}" ] && [ "$(jq -r .build_type <<< "${APRES}")" = workflow ]; then
    ok "le workflow peut publier ; adresse : $(jq -r .html_url <<< "${APRES}")"
else
    echo "  ✗ Pages fermé ou servi depuis une branche : la publication échouera" >&2
    exit 1
fi
echo
echo "Terminé."
