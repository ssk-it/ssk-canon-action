#!/bin/bash
#
# Prepares a scoping repo to carry its roadmap — docs/pistes.md; ssk-canon scoping 2026-058.
#
#   1. the « piste » label, which makes an issue a roadmap item — RG-piste-definition;
#   2. one « domaine/<id> » label per domain and one « fonctionnalite/<id> » per feature of the main branch —
#      RG-piste-rattachee;
#   3. the « Maintenant », « Ensuite » and « Plus tard » milestones, with no due date — RG-piste-horizon;
#   4. read-only check (also alone, --constat): everything is in place.
#
# It deletes nothing: a label that no longer designates anything is reported, never deleted — roadmap items may
# still carry it, and it is up to the writer to link them elsewhere. It changes no existing label or milestone.
#
# Without these labels, a writer types them by hand, and a typo strays the roadmap item: the check reports it, but
# after the fact. Without the milestones, everyone names their horizon, and Skanon files with the unclassified any
# milestone it does not recognise.
#
# The identifiers are read on the repo's main branch, by the same loader as the check. A domain or a feature added
# later requires running the script again.
#
# Usage: outillage/preparer-pistes.sh --depot <organisation>/<depot> [--noconfirm] [--dry-run] [--constat] [--aide]
#        DEPOT= also, or the repo alone as first argument
#
# No credential is asked for: the script goes through the gh session, which must be able to write the repo's
# issues (`gh auth status`). Nothing secret is read or displayed; the body of the writes goes to gh through its
# standard input. A banner says what the script acts on before anything is written, then each group of writes is
# announced and confirmed; what already exists is left as is. The script can therefore be run again.
#
# Requirements: gh, jq, git, node, and `npm ci` in this repo.

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

parametre DEPOT ""
CHECK_ONLY=0

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --depot <organisation>/<depot>  le référentiel de cadrage (DEPOT=)"
    echo "  --constat                       seulement le constat, en lecture seule"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --depot)   fixer DEPOT "${2:?--depot demande <organisation>/<depot>}"; shift 2 ;;
        --constat) CHECK_ONLY=1; shift ;;
        --aide|-h) aide; exit 0 ;;
        -*)        option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        *)         fixer DEPOT "$1"; shift ;;
    esac
done

[[ "${DEPOT}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || ko "--depot <organisation>/<depot> attendu (--aide)"
# The rest of the script names it REPO.
REPO="${DEPOT}"

for tool in gh jq git node; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done

# The loader lives in this repo, and needs its dependencies.
TOOL_REPO="$(cd "${TOOLS}/.." && pwd)"
[ -d "${TOOL_REPO}/node_modules/js-yaml" ] || ko "dépendances absentes — npm ci dans ${TOOL_REPO}"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

cible "Dépôt" "${REPO}"
cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
ecrit "l'étiquette « piste », et une étiquette « domaine/<id> » ou « fonctionnalite/<id> » par entité manquante"
ecrit "les jalons « Maintenant », « Ensuite » et « Plus tard », sans échéance"
if [ "${CHECK_ONLY}" = 1 ]; then
    option_commune --dry-run
    bandeau "Constat des pistes de ${REPO}, en lecture seule"
else
    bandeau "Préparation des pistes de ${REPO}"
fi

BRANCH="$(gh api "repos/${REPO}" -q .default_branch 2>/dev/null)" \
    || ko "dépôt ${REPO} illisible — nom inconnu, ou hors de portée de la session gh"

# The identifiers are read by the shared loader, on a shallow clone of the main
# branch — RG-parseur-partage: those of the frontmatter, which the check accepts,
# not the file names. Read in an assignment, which `set -e` stops if the read
# fails: a failed read must not pass for an empty specification.
CLONE="$(mktemp -d)"
trap 'rm -rf "${CLONE}"' EXIT
gh repo clone "${REPO}" "${CLONE}" -- --depth 1 --branch "${BRANCH}" --quiet >/dev/null 2>&1 \
    || ko "clone de ${REPO}@${BRANCH} impossible"
EXPECTED="$(node "${TOOL_REPO}/src/roadmap-item-labels.mjs" "${CLONE}" 2>&1)" \
    || ko "${REPO}@${BRANCH} : ${EXPECTED#"${CLONE}" : }"

identifiers() { grep "^$1/" <<< "${EXPECTED}" | sed "s#^$1/##" || true; }

DOMAINS="$(identifiers domaine)"
FEATURES="$(identifiers fonctionnalite)"

existing_labels() {
    gh api --paginate "repos/${REPO}/labels?per_page=100" -q '.[].name' 2>/dev/null \
        || ko "étiquettes de ${REPO} illisibles"
}

existing_milestones() {
    gh api --paginate "repos/${REPO}/milestones?state=all&per_page=100" -q '.[].title' 2>/dev/null \
        || ko "jalons de ${REPO} illisibles"
}

EXISTING_LABELS="$(existing_labels)"

exists() { grep -Fxq -- "$1" <<< "$2"; }

# Creates a group's missing labels, after confirmation.
#   $1 group title   $2 colour   $3 description   $4… names
create_labels() {
    local title="$1" colour="$2" description="$3"
    shift 3
    local missing=()
    local name
    for name in ${@+"$@"}; do
        if exists "${name}" "${EXISTING_LABELS}"; then
            ok "${name} : existe, laissée telle quelle"
        else
            missing+=("${name}")
        fi
    done
    if [ "${#missing[@]}" = 0 ]; then
        return 0
    fi
    dit "à créer (${title}, couleur #${colour}) : ${missing[*]}"
    confirmer_ecriture "créer ces ${#missing[@]} étiquette(s) dans ${REPO}" || return 0
    for name in "${missing[@]}"; do
        jq -n --arg name "${name}" --arg color "${colour}" \
              --arg description "${description//\{id\}/${name#*/}}" \
              '{ name: $name, color: $color, description: $description }' \
            | gh api -X POST "repos/${REPO}/labels" --input - >/dev/null \
            || ko "création de ${name} refusée — droit d'écrire les issues de ${REPO} manquant ?"
        ok "${name} : créée"
    done
}

# The link labels the specification no longer knows.
report_orphans() {
    local prefix="$1" known="$2" name
    while IFS= read -r name; do
        [ -n "${name}" ] || continue
        if [[ "${name}" == "${prefix}"* ]] && ! exists "${name#"${prefix}"}" "${known}"; then
            echo "  ✗ ${name} ne désigne plus rien sur ${BRANCH} — laissée en place : rattacher ailleurs les pistes qui la portent, puis la supprimer à la main" >&2
        fi
    done <<< "${EXISTING_LABELS}"
}

# Without mapfile: /bin/bash is version 3.2 on macOS.
DOMAIN_LABELS=()
FEATURE_LABELS=()
while IFS= read -r id; do [ -n "${id}" ] && DOMAIN_LABELS+=("domaine/${id}"); done <<< "${DOMAINS}"
while IFS= read -r id; do [ -n "${id}" ] && FEATURE_LABELS+=("fonctionnalite/${id}"); done <<< "${FEATURES}"
MILESTONES=("Maintenant" "Ensuite" "Plus tard")

# --- 1. The piste label -----------------------------------------------------------------

step_piste() {
    etape "1. L'étiquette qui fait d'une issue une piste, dans ${REPO}"
    create_labels "piste" "ededed" \
        "Ce qu'on envisage pour le produit — rien n'y est décidé (cadrage 2026-058)" \
        piste
}

# --- 2. The link labels -----------------------------------------------------------------

step_links() {
    etape "2. Les étiquettes de rattachement, d'après ${BRANCH}"
    dit "${#DOMAIN_LABELS[@]} domaine(s), ${#FEATURE_LABELS[@]} fonctionnalité(s)"
    # « ${t[@]+…} »: under bash 3.2, an empty array expanded alone is an unset variable for `set -u`.
    create_labels "domaines" "bfd4f2" "Piste rattachée au domaine {id}" ${DOMAIN_LABELS[@]+"${DOMAIN_LABELS[@]}"}
    create_labels "fonctionnalités" "d4c5f9" "Piste rattachée à la fonctionnalité {id}" ${FEATURE_LABELS[@]+"${FEATURE_LABELS[@]}"}
    report_orphans "domaine/" "${DOMAINS}"
    report_orphans "fonctionnalite/" "${FEATURES}"
}

# --- 3. The milestones ------------------------------------------------------------------

step_milestones() {
    etape "3. Les horizons, en jalons sans échéance"
    local existing title missing=()
    existing="$(existing_milestones)"
    for title in "${MILESTONES[@]}"; do
        if exists "${title}" "${existing}"; then
            ok "${title} : existe, laissé tel quel"
        else
            missing+=("${title}")
        fi
    done
    [ "${#missing[@]}" -gt 0 ] || return 0
    dit "à créer : ${missing[*]} — sans échéance : un horizon n'est pas une date"
    confirmer_ecriture "créer ces ${#missing[@]} jalon(s) dans ${REPO}" || return 0
    for title in "${missing[@]}"; do
        jq -n --arg title "${title}" \
              '{ title: $title, description: "Horizon des pistes — un ordre relatif, sans date (RG-piste-horizon)." }' \
            | gh api -X POST "repos/${REPO}/milestones" --input - >/dev/null \
            || ko "création du jalon ${title} refusée — droit d'écrire les issues de ${REPO} manquant ?"
        ok "${title} : créé"
    done
}

# --- 4. Read-only check -----------------------------------------------------------------

check() {
    etape "4. Constat, en lecture seule"
    local labels milestones name title absent=0
    labels="$(existing_labels)"
    milestones="$(existing_milestones)"
    for name in piste ${DOMAIN_LABELS[@]+"${DOMAIN_LABELS[@]}"} ${FEATURE_LABELS[@]+"${FEATURE_LABELS[@]}"}; do
        exists "${name}" "${labels}" || { echo "  ✗ étiquette absente : ${name}" >&2; absent=1; }
    done
    for title in "${MILESTONES[@]}"; do
        exists "${title}" "${milestones}" || { echo "  ✗ jalon absent : ${title}" >&2; absent=1; }
    done
    [ "${absent}" = 0 ] || exit 1
    ok "une piste peut être étiquetée, rattachée à tout domaine et toute fonctionnalité, et rangée par horizon"
}

if [ "${CHECK_ONLY}" = 0 ]; then
    step_piste
    step_links
    step_milestones
fi
check
echo
echo "Terminé."
