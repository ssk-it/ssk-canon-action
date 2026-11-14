#!/bin/bash
#
# Brings the workflows of specification repos back to the templates of modeles/ —
# README, « Remettre un dépôt cadré à niveau ».
#
# Installing is a one-off copy: a change to a template only reaches the repos that
# copy it again. On 14 November 2026, the twelve Vanex-Proprete specification repos
# installed before 27 October were still on ubuntu-latest, while the templates had
# taken their runner from SSK_RUNNER_PRIVE for three weeks — and GitHub had stopped
# serving the organisation's hosted runners.
#
# For each repo, one pull request that replaces its three workflows with the
# templates of this clone, under their current names (verification.yml, or
# verification-depot-cadre.yml in an older install): the check is the workflow
# named « Vérification du référentiel », the propagation the one that calls the
# action with « commiter: 'true' », the roadmap items the one that calls
# ssk-canon-action/pistes. A missing workflow is added under its default name.
# A repo already in line with the templates is left alone.
#
# Usage: outillage/mettre-a-niveau-modeles.sh [<organisation>/<depot> …]
#        (by default, each specification declared by ~/.claude/cadrage-canon.json)
#        A_BLANC=1 shows the differences without pushing or opening anything.
#        PIED: an optional last paragraph for the pull request body.
#
# Run it from an up-to-date main: the templates are those of this clone.
# No credential is asked for: the repos go through the gh session, which must be
# able to push a branch and open a pull request on each.
#
# Requirements: gh, git, jq.

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
say() { echo "  · $*"; }

for tool in gh git jq; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH=modeles-ssk-canon
TITLE="Reprendre les workflows des modèles SSK Canon"

REPOS=()
if [ "$#" -gt 0 ]; then
    REPOS=("$@")
else
    CONFIGURATION="${HOME}/.claude/cadrage-canon.json"
    [ -r "${CONFIGURATION}" ] || ko "configuration illisible : ${CONFIGURATION}"
    while IFS= read -r project; do
        url="$(git -C "${project/#\~/${HOME}}" remote get-url origin 2>/dev/null)" || { say "${project} : pas de clone, ignoré"; continue; }
        url="${url%.git}"
        [[ "${url}" =~ github\.com[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)$ ]] || { say "${project} : origine hors GitHub, ignoré"; continue; }
        REPOS+=("${BASH_REMATCH[1]}")
    done < <(jq -r '.projets // [] | .[]' "${CONFIGURATION}")
fi
[ "${#REPOS[@]}" -gt 0 ] || ko "aucun dépôt"

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
    echo "${repo}"
    [[ "${repo}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { FAILURES+=("${repo} (nom invalide)"); echo; continue; }
    clone="${WORK}/${repo//\//_}"
    if ! gh repo clone "${repo}" "${clone}" -- --depth 1 --quiet 2>/dev/null; then
        echo "  ✗ clonage impossible" >&2; FAILURES+=("${repo} (clonage)"); echo; continue
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
        ok "déjà conforme aux modèles"; echo; continue
    fi
    git -C "${clone}" add -A .github/workflows
    git -C "${clone}" diff --cached --stat | sed 's/^/    /'

    if [ -n "${A_BLANC:-}" ]; then
        say "à blanc : rien poussé"; echo; continue
    fi
    if git -C "${clone}" ls-remote --exit-code --heads origin "${BRANCH}" >/dev/null 2>&1; then
        echo "  ✗ la branche ${BRANCH} existe déjà : demande de fusion en cours ?" >&2
        FAILURES+=("${repo} (branche ${BRANCH} déjà là)"); echo; continue
    fi

    git -C "${clone}" switch -q -c "${BRANCH}"
    git -C "${clone}" commit -q -m "${TITLE}" -m "Copie des modèles de ssk-it/ssk-canon-action ($(git -C "${ROOT}" rev-parse --short HEAD)), par outillage/mettre-a-niveau-modeles.sh."
    git -C "${clone}" push -q -u origin "${BRANCH}"
    BODY="Remet les workflows de ce référentiel sur les modèles de [ssk-it/ssk-canon-action](https://github.com/ssk-it/ssk-canon-action/tree/main/modeles) ($(git -C "${ROOT}" rev-parse --short HEAD)), copiés tels quels par \`outillage/mettre-a-niveau-modeles.sh\`.

Ce que les modèles apportent à un référentiel installé avant eux : le runner lu dans la variable d'organisation \`SSK_RUNNER_PRIVE\` (auto-hébergé pour un dépôt privé, \`ubuntu-latest\` sinon), et le push de la propagation par la clé de déploiement de l'environnement que nomme \`SSK_CANON_ENVIRONNEMENT\`, quand l'organisation en a une."
    [ -n "${PIED:-}" ] && BODY="${BODY}

${PIED}"
    url="$(gh pr create -R "${repo}" --head "${BRANCH}" --title "${TITLE}" --body "${BODY}")" \
        || { echo "  ✗ demande de fusion refusée" >&2; FAILURES+=("${repo} (demande de fusion)"); echo; continue; }
    ok "${url}"
    OPENED+=("${url}")
    echo
done

echo "Demandes de fusion ouvertes : ${#OPENED[@]}"
for url in ${OPENED[@]+"${OPENED[@]}"}; do echo "  ${url}"; done
if [ "${#FAILURES[@]}" -gt 0 ]; then
    echo "À reprendre :" >&2
    for failure in "${FAILURES[@]}"; do echo "  ${failure}" >&2; done
    exit 1
fi
