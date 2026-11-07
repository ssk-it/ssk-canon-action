#!/bin/bash
#
# Pose sur un dépôt cadré le secret SSK_CANON_JETON_CITES, avec lequel sa vérification
# lit les référentiels qu'il cite — docs/citations.md.
#
#   1. en lecture seule : les référentiels que le dépôt déclare dans `referentiels_cites`
#      de son ssk-canon.yml, sur sa branche par défaut, et ceux d'entre eux qui sont
#      privés ;
#   2. le jeton, tapé au clavier sans écho, doit lire chacun des référentiels privés ;
#   3. le secret, posé sur le dépôt cadré ;
#   4. en lecture seule : le secret est en place.
#
# Le jeton d'un workflow ne lit que son propre dépôt : sans un autre jeton, un référentiel
# cité privé ne se lit pas, et ses citations se disent non vérifiées — un avertissement,
# rien n'échoue, mais rien n'est vérifié non plus. Un référentiel cité public se lit sans
# jeton : s'ils le sont tous, le script le dit et n'écrit rien.
#
# Le jeton se crée à la main, une fois, sur GitHub — Settings → Developer settings →
# Fine-grained tokens : propriétaire de la ressource, l'organisation des référentiels
# cités ; accès aux seuls dépôts cités ; permission Contents en lecture seule, rien
# d'autre. Un jeton à grain fin ne porte que sur un propriétaire : des référentiels cités
# chez deux propriétaires demandent un autre moyen (docs/citations.md).
#
# Usage : outillage/jeton-referentiels-cites.sh <propriétaire>/<dépôt-cadré>
#
# La lecture et l'écriture du secret passent par la session de gh, qui doit pouvoir
# administrer le dépôt cadré. Le jeton n'est jamais affiché ni passé en argument : il
# va à gh par son entrée standard et par l'environnement d'une seule commande.
#
# Chaque écriture est annoncée et confirmée avant d'être faite. GitHub ne rend jamais la
# valeur d'un secret : un secret déjà posé se remplace, ou se laisse. Le script peut donc
# être relancé, au renouvellement du jeton par exemple.
#
# Prérequis : gh, node, et `npm ci` fait dans ce dépôt (le script lit la configuration
# avec la bibliothèque, comme la vérification).

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
dit() { echo "  · $*"; }

confirmer() {
    local reponse
    read -r -p "  → $* [o/N] " reponse
    [ "${reponse}" = "o" ] || [ "${reponse}" = "O" ]
}

for outil in gh node; do
    command -v "${outil}" >/dev/null || ko "${outil} introuvable"
done

DEPOT="${1:-}"
NOM=SSK_CANON_JETON_CITES
ICI="$(cd "$(dirname "$0")/.." && pwd)"
[[ "${DEPOT}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || ko "usage : $0 <propriétaire>/<dépôt-cadré>"
[ -d "${ICI}/node_modules/js-yaml" ] || ko "dépendances absentes — npm ci dans ${ICI}"
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# --- 1. Les référentiels cités ----------------------------------------------------------

echo "1. Référentiels cités par ${DEPOT}"
CONFIG="$(gh api -H 'Accept: application/vnd.github.raw' "repos/${DEPOT}/contents/ssk-canon.yml" 2>/dev/null)" \
    || ko "ssk-canon.yml de ${DEPOT} illisible"
# La lecture de la bibliothèque, pour retenir exactement ce que la vérification retiendra.
# Lancée depuis ce dépôt, pour que js-yaml s'y résolve.
CITES="$(cd "${ICI}" && node --input-type=module -e '
    const { load } = await import("js-yaml");
    const { referentielsCites } = await import(process.argv[1] + "/src/citations.mjs");
    let texte = "";
    for await (const morceau of process.stdin) texte += morceau;
    const { cites, anomalies } = referentielsCites(load(texte));
    if (anomalies.length) console.error(`  · ${anomalies.length} entrée(s) de referentiels_cites écartée(s)`);
    for (const repo of new Set(cites.values())) console.log(repo);' "${ICI}" <<< "${CONFIG}")"
[ -n "${CITES}" ] || { dit "aucun référentiel cité : rien à poser"; exit 0; }

PRIVES=()
while read -r cite; do
    if PRIVE="$(gh api "repos/${cite}" -q .private 2>/dev/null)"; then
        if [ "${PRIVE}" = true ]; then dit "${cite} : privé"; PRIVES+=("${cite}"); else ok "${cite} : public, se lit sans jeton"; fi
    else
        # Hors de portée de la session de gh : peut-être privé, peut-être inexistant.
        dit "${cite} : illisible avec la session de gh — tenu pour privé"
        PRIVES+=("${cite}")
    fi
done <<< "${CITES}"
[ "${#PRIVES[@]}" -gt 0 ] || { ok "tous publics : aucun jeton n'est nécessaire"; exit 0; }
echo

# --- 2. Le jeton ------------------------------------------------------------------------

echo "2. Jeton en lecture seule sur ${PRIVES[*]}"
read -r -s -p "  → jeton (rien ne s'affiche) : " JETON
echo
[ -n "${JETON}" ] || ko "jeton vide"
for cite in "${PRIVES[@]}"; do
    GH_TOKEN="${JETON}" gh api "repos/${cite}/contents/ssk-canon.yml" --silent 2>/dev/null \
        && ok "${cite} : lu" \
        || ko "${cite} : le jeton ne le lit pas — accès au dépôt et permission Contents en lecture ?"
done
echo

# --- 3. Le secret -----------------------------------------------------------------------

echo "3. Secret ${NOM} de ${DEPOT}"
if gh secret list --repo "${DEPOT}" --json name -q '.[].name' 2>/dev/null | grep -qx "${NOM}"; then
    dit "déjà posé ; GitHub n'en rend pas la valeur"
    QUESTION="remplacer ${NOM} par ce jeton ?"
else
    dit "absent"
    QUESTION="poser ${NOM} sur ${DEPOT} ?"
fi
if confirmer "${QUESTION}"; then
    printf '%s' "${JETON}" | gh secret set "${NOM}" --repo "${DEPOT}" >/dev/null \
        || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
    ok "posé"
else
    dit "laissé tel quel"
fi
unset JETON
echo

# --- 4. Contrôle en lecture seule -------------------------------------------------------

echo "4. Vérification"
if gh secret list --repo "${DEPOT}" --json name -q '.[].name' | grep -qx "${NOM}"; then
    ok "la vérification de ${DEPOT} lira ses référentiels cités privés"
else
    echo "  ✗ secret absent : les citations vers un référentiel privé resteront non vérifiées" >&2
    exit 1
fi
echo
echo "Terminé."
