#!/bin/bash
#
# Règle un dépôt cadré pour que la propagation puisse écrire et ouvrir sa demande de
# fusion, et que les branches fusionnées ne s'y accumulent pas — README, « Installation
# dans un dépôt cadré ».
#
#   1. permissions par défaut des workflows en lecture et écriture, et GitHub Actions
#      autorisé à créer des demandes de fusion — si l'organisation ne l'interdit pas ;
#   2. suppression de la branche d'une demande de fusion à sa fusion ;
#   3. en lecture seule : les réglages sont en place.
#
# Sans l'autorisation de créer des demandes de fusion, une branche principale protégée refuse le push direct de la
# propagation, qui pousse alors sa branche « propagation/<sha> » puis échoue sur
# « GitHub Actions is not permitted to create or approve pull requests » : le cadrage
# fusionné reste sans ses index, et rien ne l'ouvre à sa place.
#
# Sans la suppression à la fusion, chaque cadrage et chaque propagation laissent leur
# branche derrière eux : ssk-canon en comptait trente, et rien n'y distinguait plus
# celle qui portait encore un commit jamais livré. Une branche supprimée reste lisible
# depuis sa demande de fusion, qui garde ses commits, et se restaure d'un clic.
#
# Usage : outillage/preparer-depot-cadre.sh <organisation>/<depot>
#
# Aucun identifiant n'est demandé : le script passe par la session de gh, qui doit avoir
# les droits d'administration du dépôt (`gh auth status`). Rien de secret n'est lu ni
# affiché ; le corps des écritures passe à gh par son entrée standard.
#
# Chaque écriture est annoncée et confirmée avant d'être faite ; un réglage déjà en place est
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

# --- 2. Suppression des branches fusionnées ---------------------------------------------

supprimees() {
    gh api "repos/${DEPOT}" -q .delete_branch_on_merge 2>/dev/null \
        || ko "réglages de ${DEPOT} illisibles"
}

echo "2. Suppression des branches à la fusion"
# Lu dans une affectation, que `set -e` arrête si la lecture échoue : dans un test, une
# lecture en échec passerait pour un réglage absent, et proposerait de l'écrire.
SUPPRESSION="$(supprimees)"
dit "supprimer la branche à la fusion : ${SUPPRESSION}"
if [ "${SUPPRESSION}" = true ]; then
    ok "déjà en place : laissé tel quel"
else
    dit "à écrire : supprimer la branche d'une demande de fusion quand elle est fusionnée"
    dit "les branches déjà fusionnées ne sont pas touchées"
    if confirmer "régler ${DEPOT} ainsi ?"; then
        jq -n '{ delete_branch_on_merge: true }' \
            | gh api -X PATCH "repos/${DEPOT}" --input - >/dev/null \
            || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
        ok "réglé"
    else
        dit "laissé tel quel"
    fi
fi
echo

# --- 3. Contrôle en lecture seule -------------------------------------------------------

echo "3. Vérification"
MANQUE=0
APRES="$(lire)"
SUPPRESSION="$(supprimees)"
if [ "$(jq -r .default_workflow_permissions <<< "${APRES}")" = write ] \
    && [ "$(jq -r .can_approve_pull_request_reviews <<< "${APRES}")" = true ]; then
    ok "la propagation peut écrire et ouvrir sa demande de fusion"
else
    echo "  ✗ réglage absent : la propagation échouera à ouvrir sa demande de fusion" >&2
    MANQUE=1
fi
if [ "${SUPPRESSION}" = true ]; then
    ok "une branche fusionnée est supprimée"
else
    echo "  ✗ réglage absent : les branches fusionnées resteront" >&2
    MANQUE=1
fi
[ "${MANQUE}" = 0 ] || exit 1
echo
echo "Terminé."
