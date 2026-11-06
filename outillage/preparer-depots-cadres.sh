#!/bin/bash
#
# Passe outillage/preparer-depot-cadre.sh sur chaque référentiel que déclare
# ~/.claude/cadrage-canon.json — README, « Installation dans un dépôt cadré ».
#
# Un réglage ajouté à preparer-depot-cadre.sh ne s'applique qu'aux dépôts sur lesquels on
# le relance : la suppression des branches à la fusion y est entrée après l'installation
# de la plupart des référentiels, et dix-sept d'entre eux l'avaient encore désactivée le
# 6 novembre 2026 — 244 branches fusionnées s'y étaient accumulées, que la consultation
# du référentiel prenait pour des modifications en cours.
#
# Usage : outillage/preparer-depots-cadres.sh [<configuration>]
#         (par défaut ~/.claude/cadrage-canon.json, dont seule la liste « projets » est lue)
#
# Aucun identifiant n'est demandé : chaque dépôt passe par la session de gh, comme avec
# preparer-depot-cadre.sh, qui annonce et fait confirmer chaque écriture. Un dépôt déjà
# réglé est laissé tel quel ; le script peut donc être relancé. Un clone absent ou sans
# origine GitHub est signalé et passé.
#
# Prérequis : gh, jq, et les droits d'administration de chaque dépôt.

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
dit() { echo "  · $*"; }

for outil in gh jq git; do
    command -v "${outil}" >/dev/null || ko "${outil} introuvable"
done

PREPARER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/preparer-depot-cadre.sh"
CONFIGURATION="${1:-${HOME}/.claude/cadrage-canon.json}"
[ -r "${CONFIGURATION}" ] || ko "configuration illisible : ${CONFIGURATION}"

# Lu avant la boucle : preparer-depot-cadre.sh pose ses questions sur l'entrée standard,
# qui doit rester le terminal.
PROJETS=()
while IFS= read -r projet; do
    PROJETS+=("${projet}")
done < <(jq -r '.projets // [] | .[]' "${CONFIGURATION}")
[ "${#PROJETS[@]}" -gt 0 ] || ko "aucun référentiel dans ${CONFIGURATION} (liste « projets »)"

depot_de() {
    local url
    url="$(git -C "$1" remote get-url origin 2>/dev/null)" || return 1
    url="${url%.git}"
    [[ "${url}" =~ github\.com[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)$ ]] || return 1
    echo "${BASH_REMATCH[1]}"
}

PASSES=()
ECHECS=()
REGLES=0
for projet in "${PROJETS[@]}"; do
    clone="${projet/#\~/${HOME}}"
    if ! depot="$(depot_de "${clone}")"; then
        PASSES+=("${projet}")
        continue
    fi
    echo "━━ ${depot}"
    if "${PREPARER}" "${depot}"; then
        REGLES=$((REGLES + 1))
    else
        ECHECS+=("${depot}")
    fi
done

echo "━━ Bilan"
ok "${REGLES} référentiel(s) en place"
for projet in ${PASSES[@]+"${PASSES[@]}"}; do
    dit "passé, pas de clone avec une origine GitHub : ${projet}"
done
for depot in ${ECHECS[@]+"${ECHECS[@]}"}; do
    echo "  ✗ réglage absent ou illisible : ${depot}" >&2
done
[ "${#ECHECS[@]}" = 0 ] || exit 1
