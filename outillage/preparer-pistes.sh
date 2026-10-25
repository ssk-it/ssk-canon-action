#!/bin/bash
#
# Prépare un dépôt cadré à porter sa roadmap — README, « Rattachement des pistes » ;
# cadrage ssk-canon 2026-058.
#
#   1. l'étiquette « piste », qui fait d'une issue une piste — RG-piste-definition ;
#   2. une étiquette « domaine/<id> » par domaine et « fonctionnalite/<id> » par
#      fonctionnalité de la branche principale — RG-piste-rattachee ;
#   3. les jalons « Maintenant », « Ensuite » et « Plus tard », sans échéance —
#      RG-piste-horizon ;
#   4. en lecture seule : tout est en place.
#
# Sans ces étiquettes, un rédacteur les saisit à la main, et une faute de frappe égare
# la piste : la vérification la signale, mais après coup. Sans les jalons, chacun nomme
# son horizon, et Skanon range avec les non classées tout jalon qu'il ne reconnaît pas.
#
# Les identifiants sont lus sur la branche principale du dépôt, comme la vérification
# les lit. Un domaine ou une fonctionnalité ajouté plus tard demande de relancer le
# script. Une étiquette qui ne désigne plus rien est signalée, jamais supprimée : des
# pistes la portent peut-être encore, et c'est au rédacteur de les rattacher ailleurs.
#
# Usage : outillage/preparer-pistes.sh <organisation>/<depot>
#
# Aucun identifiant n'est demandé : le script passe par la session de gh, qui doit pouvoir
# écrire les issues du dépôt (`gh auth status`). Rien de secret n'est lu ni affiché ; le
# corps des écritures passe à gh par son entrée standard.
#
# Chaque groupe d'écritures est annoncé et confirmé avant d'être fait ; ce qui existe déjà
# est laissé tel quel. Le script peut donc être relancé.
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

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

BRANCHE="$(gh api "repos/${DEPOT}" -q .default_branch 2>/dev/null)" \
    || ko "dépôt ${DEPOT} illisible — nom inconnu, ou hors de portée de la session gh"

# Les identifiants d'une collection : un fichier Markdown à plat, hors fichier d'accueil
# (RG-documentation-non-entite). Lus dans une affectation, que `set -e` arrête si la
# lecture échoue : une lecture en échec ne doit pas passer pour un référentiel vide.
ARBRE="$(gh api "repos/${DEPOT}/git/trees/${BRANCHE}?recursive=1" 2>/dev/null)" \
    || ko "arborescence de ${DEPOT}@${BRANCHE} illisible"
[ "$(jq -r .truncated <<< "${ARBRE}")" = false ] \
    || ko "arborescence de ${DEPOT} tronquée par GitHub — identifiants incomplets, rien n'est écrit"

identifiants() {
    jq -r --arg dossier "$1" '
        .tree[]
        | select(.type == "blob")
        | .path
        | select(startswith($dossier + "/"))
        | ltrimstr($dossier + "/")
        | select(test("^[^/]+\\.md$"))
        | select(ascii_downcase != "readme.md")
        | rtrimstr(".md")
    ' <<< "${ARBRE}" | sort
}

DOMAINES="$(identifiants domains)"
FONCTIONNALITES="$(identifiants features)"
[ -n "${DOMAINES}${FONCTIONNALITES}" ] \
    || ko "${DEPOT}@${BRANCHE} ne porte ni domains/ ni features/ — est-ce un dépôt cadré ?"

etiquettes_existantes() {
    gh api --paginate "repos/${DEPOT}/labels?per_page=100" -q '.[].name' 2>/dev/null \
        || ko "étiquettes de ${DEPOT} illisibles"
}

jalons_existants() {
    gh api --paginate "repos/${DEPOT}/milestones?state=all&per_page=100" -q '.[].title' 2>/dev/null \
        || ko "jalons de ${DEPOT} illisibles"
}

EXISTANTES="$(etiquettes_existantes)"

existe() { grep -Fxq -- "$1" <<< "$2"; }

# Crée les étiquettes manquantes d'un groupe, après confirmation.
#   $1 titre du groupe   $2 couleur   $3 description   $4… noms
creer_etiquettes() {
    local titre="$1" couleur="$2" description="$3"
    shift 3
    local manquantes=()
    local nom
    for nom in ${@+"$@"}; do
        if existe "${nom}" "${EXISTANTES}"; then
            ok "${nom} : existe, laissée telle quelle"
        else
            manquantes+=("${nom}")
        fi
    done
    if [ "${#manquantes[@]}" = 0 ]; then
        return
    fi
    dit "à créer (${titre}, couleur #${couleur}) : ${manquantes[*]}"
    if ! confirmer "créer ces ${#manquantes[@]} étiquette(s) dans ${DEPOT} ?"; then
        dit "laissé tel quel"
        return
    fi
    for nom in "${manquantes[@]}"; do
        jq -n --arg name "${nom}" --arg color "${couleur}" \
              --arg description "${description//\{id\}/${nom#*/}}" \
              '{ name: $name, color: $color, description: $description }' \
            | gh api -X POST "repos/${DEPOT}/labels" --input - >/dev/null \
            || ko "création de ${nom} refusée — droit d'écrire les issues de ${DEPOT} manquant ?"
        ok "${nom} : créée"
    done
}

# Les étiquettes de rattachement que le référentiel ne connaît plus.
signaler_orphelines() {
    local prefixe="$1" connus="$2" nom
    while IFS= read -r nom; do
        [ -n "${nom}" ] || continue
        if [[ "${nom}" == "${prefixe}"* ]] && ! existe "${nom#"${prefixe}"}" "${connus}"; then
            echo "  ✗ ${nom} ne désigne plus rien sur ${BRANCHE} — laissée en place : rattacher ailleurs les pistes qui la portent, puis la supprimer à la main" >&2
        fi
    done <<< "${EXISTANTES}"
}

# --- 1. L'étiquette piste ---------------------------------------------------------------

echo "1. L'étiquette qui fait d'une issue une piste, dans ${DEPOT}"
creer_etiquettes "piste" "ededed" \
    "Ce qu'on envisage pour le produit — rien n'y est décidé (cadrage 2026-058)" \
    piste
echo

# --- 2. Les étiquettes de rattachement --------------------------------------------------

echo "2. Les étiquettes de rattachement, d'après ${BRANCHE}"
dit "$(wc -l <<< "${DOMAINES}" | tr -d ' ') domaine(s), $(wc -l <<< "${FONCTIONNALITES}" | tr -d ' ') fonctionnalité(s)"
# Sans mapfile : /bin/bash est en version 3.2 sur macOS.
NOMS_DOMAINES=()
NOMS_FONCTIONNALITES=()
while IFS= read -r id; do [ -n "${id}" ] && NOMS_DOMAINES+=("domaine/${id}"); done <<< "${DOMAINES}"
while IFS= read -r id; do [ -n "${id}" ] && NOMS_FONCTIONNALITES+=("fonctionnalite/${id}"); done <<< "${FONCTIONNALITES}"
# « ${t[@]+…} » : sous bash 3.2, un tableau vide développé seul est une variable non définie pour `set -u`.
creer_etiquettes "domaines" "bfd4f2" "Piste rattachée au domaine {id}" ${NOMS_DOMAINES[@]+"${NOMS_DOMAINES[@]}"}
creer_etiquettes "fonctionnalités" "d4c5f9" "Piste rattachée à la fonctionnalité {id}" ${NOMS_FONCTIONNALITES[@]+"${NOMS_FONCTIONNALITES[@]}"}
signaler_orphelines "domaine/" "${DOMAINES}"
signaler_orphelines "fonctionnalite/" "${FONCTIONNALITES}"
echo

# --- 3. Les jalons ----------------------------------------------------------------------

JALONS=("Maintenant" "Ensuite" "Plus tard")

echo "3. Les horizons, en jalons sans échéance"
EXISTANTS="$(jalons_existants)"
MANQUANTS=()
for titre in "${JALONS[@]}"; do
    if existe "${titre}" "${EXISTANTS}"; then
        ok "${titre} : existe, laissé tel quel"
    else
        MANQUANTS+=("${titre}")
    fi
done
if [ "${#MANQUANTS[@]}" -gt 0 ]; then
    dit "à créer : ${MANQUANTS[*]} — sans échéance : un horizon n'est pas une date"
    if confirmer "créer ces ${#MANQUANTS[@]} jalon(s) dans ${DEPOT} ?"; then
        for titre in "${MANQUANTS[@]}"; do
            jq -n --arg title "${titre}" \
                  '{ title: $title, description: "Horizon des pistes — un ordre relatif, sans date (RG-piste-horizon)." }' \
                | gh api -X POST "repos/${DEPOT}/milestones" --input - >/dev/null \
                || ko "création du jalon ${titre} refusée — droit d'écrire les issues de ${DEPOT} manquant ?"
            ok "${titre} : créé"
        done
    else
        dit "laissé tel quel"
    fi
fi
echo

# --- 4. Contrôle en lecture seule -------------------------------------------------------

echo "4. Vérification"
MANQUE=0
EXISTANTES="$(etiquettes_existantes)"
EXISTANTS="$(jalons_existants)"
for nom in piste ${NOMS_DOMAINES[@]+"${NOMS_DOMAINES[@]}"} ${NOMS_FONCTIONNALITES[@]+"${NOMS_FONCTIONNALITES[@]}"}; do
    existe "${nom}" "${EXISTANTES}" || { echo "  ✗ étiquette absente : ${nom}" >&2; MANQUE=1; }
done
for titre in "${JALONS[@]}"; do
    existe "${titre}" "${EXISTANTS}" || { echo "  ✗ jalon absent : ${titre}" >&2; MANQUE=1; }
done
[ "${MANQUE}" = 0 ] || exit 1
ok "une piste peut être étiquetée, rattachée à tout domaine et toute fonctionnalité, et rangée par horizon"
echo
echo "Terminé."
