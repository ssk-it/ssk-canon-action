#!/bin/bash
#
# Règle les permissions des workflows d'un dépôt cadré, pour que la propagation puisse
# écrire et ouvrir sa demande de fusion — README, « Installation dans un dépôt cadré ».
#
#   1. permissions par défaut des workflows en lecture et écriture, et GitHub Actions
#      autorisé à créer des demandes de fusion — si l'organisation ne l'interdit pas ;
#   2. en lecture seule : le réglage est en place.
#
# Sans la seconde, une branche principale protégée refuse le push direct de la
# propagation, qui pousse alors sa branche « propagation/<sha> » puis échoue sur
# « GitHub Actions is not permitted to create or approve pull requests » : le cadrage
# fusionné reste sans ses index, et rien ne l'ouvre à sa place.
#
# Usage : outillage/preparer-depot-cadre.sh <organisation>/<depot>
#
# Aucun identifiant n'est demandé : le script passe par la session de gh, qui doit avoir
# les droits d'administration du dépôt (`gh auth status`). Rien de secret n'est lu ni
# affiché ; le corps des écritures passe à gh par son entrée standard.
#
# L'écriture est annoncée et confirmée avant d'être faite ; un réglage déjà en place est
# laissé tel quel. Le script peut donc être relancé.
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

DEPOT="${1:-}"
[[ "${DEPOT}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 <organisation>/<depot>"
ORGANISATION="${DEPOT%%/*}"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

lire() {
    gh api "repos/${DEPOT}/actions/permissions/workflow" 2>/dev/null \
        || ko "permissions des workflows de ${DEPOT} illisibles — dépôt inconnu, ou droits d'administration manquants"
}

# --- 1. Permissions des workflows -------------------------------------------------------

echo "1. Permissions des workflows de ${DEPOT}"
ACTUEL="$(lire)"
ECRITURE="$(jq -r .default_workflow_permissions <<< "${ACTUEL}")"
DEMANDES="$(jq -r .can_approve_pull_request_reviews <<< "${ACTUEL}")"
dit "permissions par défaut : ${ECRITURE} — créer des demandes de fusion : ${DEMANDES}"

if [ "${ECRITURE}" = write ] && [ "${DEMANDES}" = true ]; then
    ok "déjà en place : laissé tel quel"
else
    # Une organisation qui interdit le réglage le rend inapplicable au dépôt : GitHub
    # accepterait l'écriture sans effet, ou la refuserait sans dire pourquoi.
    ORG="$(gh api "orgs/${ORGANISATION}/actions/permissions/workflow" 2>/dev/null || true)"
    if [ -n "${ORG}" ] && [ "$(jq -r .can_approve_pull_request_reviews <<< "${ORG}")" = false ]; then
        ko "l'organisation ${ORGANISATION} interdit aux workflows de créer des demandes de fusion — à autoriser d'abord dans ses réglages"
    fi

    dit "à écrire : permissions par défaut « write », créer des demandes de fusion « true »"
    dit "rien d'autre : ni les actions autorisées, ni les autres dépôts"
    if confirmer "régler ${DEPOT} ainsi ?"; then
        jq -n '{ default_workflow_permissions: "write", can_approve_pull_request_reviews: true }' \
            | gh api -X PUT "repos/${DEPOT}/actions/permissions/workflow" --input - >/dev/null \
            || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
        ok "réglé"
    else
        dit "laissé tel quel"
    fi
fi
echo

# --- 2. Contrôle en lecture seule -------------------------------------------------------

echo "2. Vérification"
APRES="$(lire)"
if [ "$(jq -r .default_workflow_permissions <<< "${APRES}")" = write ] \
    && [ "$(jq -r .can_approve_pull_request_reviews <<< "${APRES}")" = true ]; then
    ok "la propagation peut écrire et ouvrir sa demande de fusion"
else
    ko "réglage absent : la propagation échouera à ouvrir sa demande de fusion"
fi
echo
echo "Terminé."
