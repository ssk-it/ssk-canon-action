#!/bin/bash
#
# Brings the workflows of specification repos back to the templates of modeles/ — README, « Remettre un dépôt
# cadré à niveau ».
#
# For each repo, one pull request that replaces its three workflows with the templates of this clone, under their
# current names (verification.yml, or verification-depot-cadre.yml in an older install): the check is the workflow
# named « Vérification du référentiel », the propagation the one that calls the action with « commiter: 'true' »,
# the roadmap items the one that calls ssk-canon-action/pistes. A missing workflow is added under its default name.
# A repo already in line with the templates is left alone.
#
# It never pushes to main nor merges anything: each repo gets a branch and a pull request that its owner merges.
# It touches no file outside .github/workflows, and deletes no workflow.
#
# Installing is a one-off copy: a change to a template only reaches the repos that copy it again. On
# 14 November 2026, the twelve Vanex-Proprete specification repos installed before 27 October were still on
# ubuntu-latest, while the templates had taken their runner from SSK_RUNNER_PRIVE for three weeks — and GitHub had
# stopped serving the organisation's hosted runners.
#
# Usage: outillage/mettre-a-niveau-modeles.sh [--depot <organisation>/<depot>]… [--configuration <fichier>]
#            [--pied <texte>] [--noconfirm] [--dry-run] [--aide]
#        The repos can also be given alone: outillage/mettre-a-niveau-modeles.sh <organisation>/<depot> …
#        By default, each specification declared by ~/.claude/cadrage-canon.json (CONFIGURATION= also).
#        --dry-run shows the differences without pushing or opening anything (A_BLANC=1, its former name, also).
#        --pied: an optional last paragraph for the pull request body (PIED= also).
#
# Run it from an up-to-date main: the templates are those of this clone. No credential is asked for: the repos go
# through the gh session, which must be able to push a branch and open a pull request on each. A banner says what
# the script acts on before anything is written, then each repo's push and pull request are announced and
# confirmed.
#
# Requirements: gh, git, jq.

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

parametre CONFIGURATION "${HOME}/.claude/cadrage-canon.json"
parametre PIED ""
ROOT="$(cd "${TOOLS}/.." && pwd)"
BRANCH=modeles-ssk-canon
TITLE="Reprendre les workflows des modèles SSK Canon"
REPOS=()

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --depot <organisation>/<depot>  un référentiel à remettre à niveau, répétable (défaut : ceux de la configuration)"
    echo "  --configuration <fichier>       la liste des référentiels (CONFIGURATION=, défaut ${CONFIGURATION})"
    echo "  --pied <texte>                  un dernier paragraphe pour le corps des demandes de fusion (PIED=)"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --depot)         REPOS+=("${2:?--depot demande <organisation>/<depot>}"); shift 2 ;;
        --configuration) fixer CONFIGURATION "${2:?--configuration demande un fichier}"; shift 2 ;;
        --pied)          fixer PIED "${2:?--pied demande un texte}"; shift 2 ;;
        --aide|-h)       aide; exit 0 ;;
        -*)              option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        *)               REPOS+=("$1"); shift ;;
    esac
done
# The former name of --dry-run.
[ -z "${A_BLANC:-}" ] || option_commune --dry-run

for tool in gh git jq; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

if [ "${#REPOS[@]}" = 0 ]; then
    [ -r "${CONFIGURATION}" ] || ko "configuration illisible : ${CONFIGURATION}"
    while IFS= read -r project; do
        url="$(git -C "${project/#\~/${HOME}}" remote get-url origin 2>/dev/null)" || { dit "${project} : pas de clone, ignoré"; continue; }
        url="${url%.git}"
        [[ "${url}" =~ github\.com[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)$ ]] || { dit "${project} : origine hors GitHub, ignoré"; continue; }
        REPOS+=("${BASH_REMATCH[1]}")
    done < <(jq -r '.projets // [] | .[]' "${CONFIGURATION}")
fi
[ "${#REPOS[@]}" -gt 0 ] || ko "aucun dépôt"

TEMPLATES="$(git -C "${ROOT}" rev-parse --short HEAD)"
cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
cible "Modèles" "${ROOT}/modeles, à ${TEMPLATES} ($(git -C "${ROOT}" rev-parse --abbrev-ref HEAD))"
for repo in "${REPOS[@]}"; do cible "Référentiel" "${repo}"; done
ecrit "sur chaque référentiel qui s'écarte des modèles : la branche ${BRANCH}, poussée, et une demande de fusion « ${TITLE} »"
bandeau "Remise à niveau des workflows des référentiels de cadrage"

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# The workflow of the clone $1 whose content matches the extended regex $2, if any.
workflow_matching() {
    local file
    for file in "$1"/.github/workflows/*.yml "$1"/.github/workflows/*.yaml; do
        [ -f "${file}" ] || continue
        if grep -Eq "$2" "${file}"; then
            echo ".github/workflows/$(basename "${file}")"
            return
        fi
    done
}

OPENED=()
FAILURES=()
for repo in "${REPOS[@]}"; do
    etape "${repo}"
    [[ "${repo}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { FAILURES+=("${repo} (nom invalide)"); continue; }
    clone="${WORK}/${repo//\//_}"
    if ! gh repo clone "${repo}" "${clone}" -- --depth 1 --quiet 2>/dev/null; then
        echo "  ✗ clonage impossible" >&2; FAILURES+=("${repo} (clonage)"); continue
    fi

    for entry in \
        "verification-depot-cadre.yml|verification.yml|^name: *['\"]?Vérification du référentiel" \
        "propagation-depot-cadre.yml|propagation.yml|commiter: *['\"]?true" \
        "pistes-depot-cadre.yml|pistes.yml|ssk-canon-action/pistes@"; do
        IFS='|' read -r template default pattern <<< "${entry}"
        target="$(workflow_matching "${clone}" "${pattern}")"
        target="${target:-.github/workflows/${default}}"
        mkdir -p "${clone}/.github/workflows"
        cp "${ROOT}/modeles/${template}" "${clone}/${target}"
    done

    if [ -z "$(git -C "${clone}" status --porcelain)" ]; then
        ok "déjà conforme aux modèles"; continue
    fi
    git -C "${clone}" add -A .github/workflows
    git -C "${clone}" diff --cached --stat | sed 's/^/    /'

    if git -C "${clone}" ls-remote --exit-code --heads origin "${BRANCH}" >/dev/null 2>&1; then
        echo "  ✗ la branche ${BRANCH} existe déjà : demande de fusion en cours ?" >&2
        FAILURES+=("${repo} (branche ${BRANCH} déjà là)"); continue
    fi
    confirmer_ecriture "pousser la branche ${BRANCH} sur ${repo} et y ouvrir la demande de fusion « ${TITLE} »" || continue

    git -C "${clone}" switch -q -c "${BRANCH}"
    git -C "${clone}" commit -q -m "${TITLE}" -m "Copie des modèles de ssk-it/ssk-canon-action (${TEMPLATES}), par outillage/mettre-a-niveau-modeles.sh."
    git -C "${clone}" push -q -u origin "${BRANCH}"
    BODY="Remet les workflows de ce référentiel sur les modèles de [ssk-it/ssk-canon-action](https://github.com/ssk-it/ssk-canon-action/tree/main/modeles) (${TEMPLATES}), copiés tels quels par \`outillage/mettre-a-niveau-modeles.sh\`.

Ce que les modèles apportent à un référentiel installé avant eux : le runner lu dans la variable d'organisation \`SSK_RUNNER_PRIVE\` (auto-hébergé pour un dépôt privé, \`ubuntu-latest\` sinon), et le push de la propagation par la clé de déploiement de l'environnement que nomme \`SSK_CANON_ENVIRONNEMENT\`, quand l'organisation en a une."
    [ -n "${PIED}" ] && BODY="${BODY}

${PIED}"
    url="$(gh pr create -R "${repo}" --head "${BRANCH}" --title "${TITLE}" --body "${BODY}")" \
        || { echo "  ✗ demande de fusion refusée" >&2; FAILURES+=("${repo} (demande de fusion)"); continue; }
    ok "${url}"
    OPENED+=("${url}")
done

etape "Bilan"
echo "Demandes de fusion ouvertes : ${#OPENED[@]}"
for url in ${OPENED[@]+"${OPENED[@]}"}; do echo "  ${url}"; done
if [ "${#FAILURES[@]}" -gt 0 ]; then
    echo "À reprendre :" >&2
    for failure in "${FAILURES[@]}"; do echo "  ${failure}" >&2; done
    exit 1
fi
