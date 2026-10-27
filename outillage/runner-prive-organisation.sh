#!/bin/bash
#
# Pose sur une organisation la variable SSK_RUNNER_PRIVE, que les workflows modèles
# lisent pour choisir leur runner — README, « Installation dans un dépôt cadré ».
#
#   1. la variable, visible des seuls dépôts privés de l'organisation, désigne ses
#      runners auto-hébergés par leurs labels ;
#   2. en lecture seule : au moins un runner en ligne porte ces labels, et son groupe
#      refuse les dépôts publics ;
#   3. en lecture seule : la variable est en place.
#
# Sans elle, chaque exécution d'un dépôt privé — la vérification de chaque demande de
# fusion, la propagation de chaque livraison et sa reprise planifiée toutes les heures —
# tourne sur les runners de GitHub et se décompte du forfait de l'organisation. Le
# 27 octobre 2026, ssk-it en avait épuisé les 3 000 minutes, et plus aucun job ne
# démarrait. Visible des seuls dépôts privés, elle laisse un dépôt public sur
# ubuntu-latest, gratuit pour lui, et que le groupe de runners refuse de toute façon.
#
# Usage : outillage/runner-prive-organisation.sh <organisation> ['["self-hosted","macOS","ARM64"]']
#
# Aucun identifiant n'est demandé : le script passe par la session de gh, qui doit avoir
# les droits d'administration de l'organisation (`gh auth status`, portée admin:org).
# Rien de secret n'est lu ni affiché ; le corps des écritures passe à gh par son entrée
# standard.
#
# Chaque écriture est annoncée et confirmée avant d'être faite ; une variable déjà en
# place avec la bonne valeur est laissée telle quelle, et la remplacer est une écriture
# à part. Le script peut donc être relancé.
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

ORGANISATION="${1:-}"
LABELS="${2:-[\"self-hosted\",\"macOS\",\"ARM64\"]}"
NOM=SSK_RUNNER_PRIVE
[[ "${ORGANISATION}" =~ ^[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 <organisation> ['[\"self-hosted\",\"macOS\",\"ARM64\"]']"
# Les workflows en font `fromJSON(...)` : une valeur qui n'est pas un tableau de labels
# ferait échouer chaque job au démarrage, sans dire pourquoi.
jq -e 'type == "array" and length > 0 and all(type == "string")' <<< "${LABELS}" >/dev/null 2>&1 \
    || ko "labels : un tableau JSON de chaînes est attendu, reçu ${LABELS}"
LABELS="$(jq -c . <<< "${LABELS}")"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# Rend la variable telle quelle, ou rien si elle n'existe pas ; s'arrête sur toute autre
# erreur, qu'un test confondrait avec une absence.
lire() {
    local sortie
    if sortie="$(gh api "orgs/${ORGANISATION}/actions/variables/${NOM}" 2>&1)"; then
        echo "${sortie}"
    elif grep -q "HTTP 404" <<< "${sortie}"; then
        echo ""
    else
        ko "variables de ${ORGANISATION} illisibles — droits d'administration manquants ? (${sortie})"
    fi
}

ecrire() {
    local methode="$1" chemin="$2"
    jq -n --arg nom "${NOM}" --arg valeur "${LABELS}" \
        '{ name: $nom, value: $valeur, visibility: "private" }' \
        | gh api -X "${methode}" "${chemin}" --input - >/dev/null \
        || ko "écriture refusée — droits d'administration de ${ORGANISATION} manquants ?"
}

# --- 1. La variable ---------------------------------------------------------------------

echo "1. Variable ${NOM} de ${ORGANISATION}"
ACTUELLE="$(lire)"
if [ -z "${ACTUELLE}" ]; then
    dit "absente"
    dit "à créer : ${NOM} = ${LABELS}, visible des seuls dépôts privés"
    if confirmer "créer ${NOM} ainsi ?"; then
        ecrire POST "orgs/${ORGANISATION}/actions/variables"
        ok "créée"
    else
        dit "laissée absente"
    fi
else
    VALEUR="$(jq -r .value <<< "${ACTUELLE}")"
    VISIBILITE="$(jq -r .visibility <<< "${ACTUELLE}")"
    dit "en place : ${VALEUR}, visibilité ${VISIBILITE}"
    if [ "$(jq -c . <<< "${VALEUR}" 2>/dev/null || true)" = "${LABELS}" ] && [ "${VISIBILITE}" = private ]; then
        ok "déjà en place : laissée telle quelle"
    else
        dit "à remplacer par : ${LABELS}, visible des seuls dépôts privés"
        if confirmer "remplacer ${NOM} ?"; then
            ecrire PATCH "orgs/${ORGANISATION}/actions/variables/${NOM}"
            ok "remplacée"
        else
            dit "laissée telle quelle"
        fi
    fi
fi
echo

# --- 2. Les runners ---------------------------------------------------------------------

echo "2. Runners portant ${LABELS}"
RUNNERS="$(gh api --paginate "orgs/${ORGANISATION}/actions/runners" -q '.runners[]' 2>/dev/null)" \
    || ko "runners de ${ORGANISATION} illisibles"
EN_LIGNE="$(jq -s --argjson labels "${LABELS}" \
    '[ .[] | select(.status == "online") | select([.labels[].name] as $l | all($labels[]; . as $x | $l | index($x))) ] | length' \
    <<< "${RUNNERS}")"
if [ "${EN_LIGNE}" -gt 0 ]; then
    ok "${EN_LIGNE} runner(s) en ligne"
else
    echo "  ✗ aucun runner en ligne ne porte ces labels : les jobs des dépôts privés attendront" >&2
fi
PUBLICS="$(gh api "orgs/${ORGANISATION}/actions/runner-groups" \
    -q '[.runner_groups[] | select(.allows_public_repositories)] | length' 2>/dev/null || echo "?")"
if [ "${PUBLICS}" = 0 ]; then
    ok "aucun groupe de runners n'accepte de dépôt public"
else
    dit "groupes acceptant des dépôts publics : ${PUBLICS} — un dépôt public exécuterait le code de ses contributeurs sur ces machines"
fi
echo

# --- 3. Contrôle en lecture seule -------------------------------------------------------

echo "3. Vérification"
APRES="$(lire)"
if [ -n "${APRES}" ] \
    && [ "$(jq -r .value <<< "${APRES}" | jq -c . 2>/dev/null || true)" = "${LABELS}" ] \
    && [ "$(jq -r .visibility <<< "${APRES}")" = private ]; then
    ok "les dépôts privés de ${ORGANISATION} prennent leurs runners auto-hébergés"
else
    echo "  ✗ variable absente ou différente : les dépôts privés restent sur les runners de GitHub" >&2
    exit 1
fi
echo
echo "Terminé."
