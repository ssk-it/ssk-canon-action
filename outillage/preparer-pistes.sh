#!/bin/bash
#
# Prepares a scoping repo to carry its roadmap — docs/pistes.md;
# ssk-canon scoping 2026-058.
#
#   1. the « piste » label, which makes an issue a roadmap item — RG-piste-definition;
#   2. one « domaine/<id> » label per domain and one « fonctionnalite/<id> » per
#      feature of the main branch — RG-piste-rattachee;
#   3. the « Maintenant », « Ensuite » and « Plus tard » milestones, with no due date —
#      RG-piste-horizon;
#   4. read-only: everything is in place.
#
# Without these labels, a writer types them by hand, and a typo strays the roadmap
# item: the check reports it, but after the fact. Without the milestones, everyone names
# their horizon, and Skanon files with the unclassified any milestone it does not recognise.
#
# The identifiers are read on the repo's main branch, by the same loader as the
# check. A domain or a feature added later requires running the script again. A
# label that no longer designates anything is reported, never deleted: roadmap items
# may still carry it, and it is up to the writer to link them elsewhere.
#
# Usage: outillage/preparer-pistes.sh <organisation>/<repo>
#
# No credential is asked for: the script goes through the gh session, which must be able
# to write the repo's issues (`gh auth status`). Nothing secret is read or displayed; the
# body of the writes goes to gh through its standard input.
#
# Each group of writes is announced and confirmed before being made; what already exists
# is left as is. The script can therefore be run again.
#
# Requirements: gh, jq, git, node, and `npm ci` in this repo.

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
say() { echo "  · $*"; }

confirm() {
    local answer
    read -r -p "  → $* [o/N] " answer
    [ "${answer}" = "o" ] || [ "${answer}" = "O" ]
}

for tool in gh jq git node; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done

# The loader lives in this repo, and needs its dependencies.
TOOL_REPO="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "${TOOL_REPO}/node_modules/js-yaml" ] || ko "dépendances absentes — npm ci dans ${TOOL_REPO}"

REPO="${1:-}"
[[ "${REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || ko "usage : $0 <organisation>/<depot>"

gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

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
        return
    fi
    say "à créer (${title}, couleur #${colour}) : ${missing[*]}"
    if ! confirm "créer ces ${#missing[@]} étiquette(s) dans ${REPO} ?"; then
        say "laissé tel quel"
        return
    fi
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

# --- 1. The piste label -----------------------------------------------------------------

echo "1. L'étiquette qui fait d'une issue une piste, dans ${REPO}"
create_labels "piste" "ededed" \
    "Ce qu'on envisage pour le produit — rien n'y est décidé (cadrage 2026-058)" \
    piste
echo

# --- 2. The link labels -----------------------------------------------------------------

echo "2. Les étiquettes de rattachement, d'après ${BRANCH}"
say "$(wc -l <<< "${DOMAINS}" | tr -d ' ') domaine(s), $(wc -l <<< "${FEATURES}" | tr -d ' ') fonctionnalité(s)"
# Without mapfile: /bin/bash is version 3.2 on macOS.
DOMAIN_LABELS=()
FEATURE_LABELS=()
while IFS= read -r id; do [ -n "${id}" ] && DOMAIN_LABELS+=("domaine/${id}"); done <<< "${DOMAINS}"
while IFS= read -r id; do [ -n "${id}" ] && FEATURE_LABELS+=("fonctionnalite/${id}"); done <<< "${FEATURES}"
# « ${t[@]+…} »: under bash 3.2, an empty array expanded alone is an unset variable for `set -u`.
create_labels "domaines" "bfd4f2" "Piste rattachée au domaine {id}" ${DOMAIN_LABELS[@]+"${DOMAIN_LABELS[@]}"}
create_labels "fonctionnalités" "d4c5f9" "Piste rattachée à la fonctionnalité {id}" ${FEATURE_LABELS[@]+"${FEATURE_LABELS[@]}"}
report_orphans "domaine/" "${DOMAINS}"
report_orphans "fonctionnalite/" "${FEATURES}"
echo

# --- 3. The milestones ------------------------------------------------------------------

MILESTONES=("Maintenant" "Ensuite" "Plus tard")

echo "3. Les horizons, en jalons sans échéance"
EXISTING_MILESTONES="$(existing_milestones)"
MISSING_MILESTONES=()
for title in "${MILESTONES[@]}"; do
    if exists "${title}" "${EXISTING_MILESTONES}"; then
        ok "${title} : existe, laissé tel quel"
    else
        MISSING_MILESTONES+=("${title}")
    fi
done
if [ "${#MISSING_MILESTONES[@]}" -gt 0 ]; then
    say "à créer : ${MISSING_MILESTONES[*]} — sans échéance : un horizon n'est pas une date"
    if confirm "créer ces ${#MISSING_MILESTONES[@]} jalon(s) dans ${REPO} ?"; then
        for title in "${MISSING_MILESTONES[@]}"; do
            jq -n --arg title "${title}" \
                  '{ title: $title, description: "Horizon des pistes — un ordre relatif, sans date (RG-piste-horizon)." }' \
                | gh api -X POST "repos/${REPO}/milestones" --input - >/dev/null \
                || ko "création du jalon ${title} refusée — droit d'écrire les issues de ${REPO} manquant ?"
            ok "${title} : créé"
        done
    else
        say "laissé tel quel"
    fi
fi
echo

# --- 4. Read-only check -----------------------------------------------------------------

echo "4. Vérification"
MISSING=0
EXISTING_LABELS="$(existing_labels)"
EXISTING_MILESTONES="$(existing_milestones)"
for name in piste ${DOMAIN_LABELS[@]+"${DOMAIN_LABELS[@]}"} ${FEATURE_LABELS[@]+"${FEATURE_LABELS[@]}"}; do
    exists "${name}" "${EXISTING_LABELS}" || { echo "  ✗ étiquette absente : ${name}" >&2; MISSING=1; }
done
for title in "${MILESTONES[@]}"; do
    exists "${title}" "${EXISTING_MILESTONES}" || { echo "  ✗ jalon absent : ${title}" >&2; MISSING=1; }
done
[ "${MISSING}" = 0 ] || exit 1
ok "une piste peut être étiquetée, rattachée à tout domaine et toute fonctionnalité, et rangée par horizon"
echo
echo "Terminé."
