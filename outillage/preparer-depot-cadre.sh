#!/bin/bash
#
# Sets up a scoping repo on GitHub so that the propagation can open its pull request, merged branches do not pile
# up there and, when asked, main only takes what the checks validated — README, « Installation dans un dépôt
# cadré ». The same script for every scoping repo: its name, description and checks are parameters.
#
#   1. the repo: if it does not exist yet and --source names its local clone, created (private by default) and
#      given the clone's main; its description, with --description;
#   2. deletion of a pull request's branch when it is merged;
#   3. GitHub Actions allowed to create pull requests — if the organisation does not forbid it;
#   4. with --controles: a ruleset on the default branch that requires these checks and refuses deletion and force
#      pushes, nobody exempted, administrators included;
#   5. read-only check (also alone, --constat): the settings are in place, seen from GitHub.
#
# It deletes nothing, never changes a repo's visibility, and leaves the workflows' default permissions as they are:
# the templates declare their own (contents and pull-requests in write for the propagation), and ssk-it forbids
# write by default at the organisation level. It does not create the roadmap labels: preparer-pistes.sh does.
#
# Usage: outillage/preparer-depot-cadre.sh --depot <organisation>/<depot> [--source <clone>]
#            [--visibilite private|public] [--description <texte>] [--controles <contrôle>[,…]] [--a-jour true|false]
#            [--noconfirm] [--dry-run] [--constat] [--aide]
#        The repo can also be given alone: outillage/preparer-depot-cadre.sh <organisation>/<depot>
#        Each option has its environment variable: DEPOT, SOURCE, VISIBILITE, DESCRIPTION, CONTROLES, A_JOUR.
#
# Without permission to create pull requests, a protected main branch refuses the propagation's direct push,
# which then pushes its « propagation/<sha> » branch and fails on « GitHub Actions is not permitted to create or
# approve pull requests »: the merged scoping stays without its indexes, and nothing opens it in its place.
#
# Without deletion on merge, each scoping and each propagation leave their branch behind them: ssk-canon had
# thirty, and nothing there told apart any more the one that still carried a never-delivered commit. A deleted
# branch stays readable from its pull request, which keeps its commits, and is restored in one click.
#
# Without required checks, the verification reports without blocking, and an inconsistent scoping can be
# delivered. --a-jour stays false by default, as on ssk-canon: the propagation opens its pull request from the
# main of the moment, and a scoping merged in the meantime would block it until an update nobody makes. A repo
# whose organisation already protects main its own way (a deploy key exempted from its rule, for instance) is
# left without --controles: this ruleset exempts nobody.
#
# No credential is asked for: the script goes through the gh session, which must have admin rights on the repo
# (`gh auth status`). Nothing secret is read or displayed; the body of the writes goes to gh through its standard
# input. A banner says what the script acts on before anything is written, then each write is announced and
# confirmed; a setting already in place is left as is. The script can therefore be run again.
#
# Requirements: gh, jq, and git with --source.

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

# --- Parameters: an environment variable, otherwise the default; an option wins ----------------------------------

parametre DEPOT ""
parametre SOURCE ""
parametre VISIBILITE private
parametre DESCRIPTION ""
parametre CONTROLES ""
parametre A_JOUR false
CHECK_ONLY=0
RULESET_NAME="Contrôles requis sur main"
# The GitHub Actions application, the only one able to report these checks.
ACTIONS_APP=15368

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --depot <organisation>/<depot>  le référentiel de cadrage (DEPOT=)"
    echo "  --source <clone>                son clone local, pour le créer s'il n'existe pas (SOURCE=)"
    echo "  --visibilite private|public     à la création seulement (VISIBILITE=, défaut ${VISIBILITE})"
    echo "  --description <texte>           la description du dépôt (DESCRIPTION=, défaut : laissée telle quelle)"
    echo "  --controles <contrôle>[,…]      les contrôles exigés sur main (CONTROLES=, défaut : règles laissées telles quelles)"
    echo "  --a-jour true|false             exiger une branche à jour avec main (A_JOUR=, défaut ${A_JOUR})"
    echo "  --constat                       seulement le constat, en lecture seule"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --depot)       fixer DEPOT "${2:?--depot demande <organisation>/<depot>}"; shift 2 ;;
        --source)      fixer SOURCE "${2:?--source demande un chemin}"; shift 2 ;;
        --visibilite)  fixer VISIBILITE "${2:?--visibilite demande private ou public}"; shift 2 ;;
        --description) fixer DESCRIPTION "${2:?--description demande un texte}"; shift 2 ;;
        --controles)   fixer CONTROLES "${2:?--controles demande une liste}"; shift 2 ;;
        --a-jour)      fixer A_JOUR "${2:?--a-jour demande true ou false}"; shift 2 ;;
        --constat)     CHECK_ONLY=1; shift ;;
        --aide|-h)     aide; exit 0 ;;
        -*)            option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        *)             fixer DEPOT "$1"; shift ;;
    esac
done

[[ "${DEPOT}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || ko "--depot <organisation>/<depot> attendu (--aide)"
ORGANISATION="${DEPOT%%/*}"
case "${VISIBILITE}" in private|public) ;; *) ko "--visibilite vaut private ou public, pas « ${VISIBILITE} »" ;; esac
case "${A_JOUR}" in true|false) ;; *) ko "--a-jour vaut true ou false, pas « ${A_JOUR} »" ;; esac
if [ -n "${SOURCE}" ]; then
    [ -d "${SOURCE}" ] || ko "--source : ${SOURCE} n'est pas un dossier"
    SOURCE="$(cd "${SOURCE}" && pwd)"
fi
# The checks, one per line, without blanks or empty entries.
CHECKS="$(printf '%s' "${CONTROLES}" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' || true)"
[ -z "${CONTROLES}" ] || [ -n "${CHECKS}" ] || ko "--controles : aucun contrôle dans « ${CONTROLES} »"

for tool in gh jq; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done
[ -z "${SOURCE}" ] || command -v git >/dev/null || ko "git introuvable"
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# --- Reads -------------------------------------------------------------------------------------------------------

# The repo as is, or nothing if it does not exist; stops on any other error, which a test would mistake for an
# absence.
read_repo() {
    local output
    if output="$(gh api "repos/${DEPOT}" 2>&1)"; then
        echo "${output}"
    elif grep -q "HTTP 404" <<< "${output}"; then
        echo ""
    else
        ko "${DEPOT} illisible — droits manquants ? (${output})"
    fi
}
read_permissions() {
    gh api "repos/${DEPOT}/actions/permissions/workflow" 2>/dev/null \
        || ko "permissions des workflows de ${DEPOT} illisibles — droits d'administration manquants"
}
# The ruleset this script sets, as GitHub expects it.
expected_ruleset() {
    jq -n --arg name "${RULESET_NAME}" --arg checks "${CHECKS}" --argjson up_to_date "${A_JOUR}" \
        --argjson app "${ACTIONS_APP}" '{
        name: $name, target: "branch", enforcement: "active", bypass_actors: [],
        conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
        rules: [
            { type: "deletion" },
            { type: "non_fast_forward" },
            { type: "required_status_checks", parameters: {
                do_not_enforce_on_create: false,
                strict_required_status_checks_policy: $up_to_date,
                required_status_checks: ($checks | split("\n") | map({ context: ., integration_id: $app })) } }
        ] }'
}
# Lines joined by commas, « aucun » for none.
joined() { local j; j="$(paste -sd, - | sed 's/,/, /g')"; printf '%s' "${j:-aucun}"; }
normalise_ruleset() { jq -S '{name, target, enforcement, bypass_actors, conditions, rules: (.rules | sort_by(.type))}'; }
# The checks required on the default branch, by every rule that applies to it, one per line.
required_checks() {
    gh api "repos/${DEPOT}/rules/branches/$1" \
        -q '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context' \
        2>/dev/null || ko "règles de la branche $1 de ${DEPOT} illisibles"
}

# --- Steps -------------------------------------------------------------------------------------------------------

REPO_JSON=""
step_repo() {
    etape "1. Le dépôt ${DEPOT}"
    REPO_JSON="$(read_repo)"
    if [ -n "${REPO_JSON}" ]; then
        local visibility description
        visibility="$(jq -r '.visibility' <<< "${REPO_JSON}")"
        description="$(jq -r '.description // ""' <<< "${REPO_JSON}")"
        ok "existe (${visibility}) : laissé tel quel"
        if [ "${EC_ORIGINE_VISIBILITE}" != défaut ] && [ "${visibility}" != "${VISIBILITE}" ]; then
            dit "--visibilite ${VISIBILITE} ne vaut qu'à la création : sa visibilité ${visibility} reste telle quelle"
        fi
        if [ -z "${DESCRIPTION}" ]; then
            dit "description : ${description:-aucune}"
        elif [ "${description}" = "${DESCRIPTION}" ]; then
            ok "description déjà en place : laissée telle quelle"
        else
            dit "description en place : ${description:-aucune}"
            if confirmer_ecriture "remplacer la description de ${DEPOT} par « ${DESCRIPTION} »"; then
                jq -n --arg description "${DESCRIPTION}" '{ description: $description }' \
                    | gh api -X PATCH "repos/${DEPOT}" --input - >/dev/null \
                    || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
                ok "description remplacée"
            fi
        fi
        return 0
    fi

    dit "absent"
    [ -n "${SOURCE}" ] || ko "${DEPOT} n'existe pas : --source <clone> pour le créer et y pousser main"
    [ "$(git -C "${SOURCE}" symbolic-ref --short HEAD 2>/dev/null || true)" = main ] \
        || ko "${SOURCE} n'est pas sur main : c'est la branche qui sera poussée"
    if git -C "${SOURCE}" remote get-url origin >/dev/null 2>&1; then
        ko "${SOURCE} a déjà une origine ($(git -C "${SOURCE}" remote get-url origin)) : la retirer, ou vérifier le nom du dépôt"
    fi
    if confirmer_ecriture "créer le dépôt ${VISIBILITE} ${DEPOT}${DESCRIPTION:+ (« ${DESCRIPTION} »)}, en faire l'origine de ${SOURCE} et y pousser main"; then
        gh repo create "${DEPOT}" "--${VISIBILITE}" ${DESCRIPTION:+--description "${DESCRIPTION}"} \
            --source "${SOURCE}" --remote origin --push \
            || ko "création de ${DEPOT} refusée — droit de créer des dépôts dans ${ORGANISATION} ?"
        ok "créé, main poussée"
        REPO_JSON="$(read_repo)"
    fi
}

step_branch_deletion() {
    etape "2. Suppression des branches à la fusion"
    local deletion
    deletion="$(jq -r .delete_branch_on_merge <<< "${REPO_JSON}")"
    dit "supprimer la branche à la fusion : ${deletion}"
    if [ "${deletion}" = true ]; then
        ok "déjà en place : laissé tel quel"
        return 0
    fi
    dit "les branches déjà fusionnées ne sont pas touchées"
    if confirmer_ecriture "régler ${DEPOT} pour supprimer la branche d'une demande de fusion quand elle est fusionnée"; then
        jq -n '{ delete_branch_on_merge: true }' \
            | gh api -X PATCH "repos/${DEPOT}" --input - >/dev/null \
            || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
        ok "réglé"
    fi
}

step_pull_requests() {
    etape "3. Demandes de fusion ouvertes par les workflows"
    local current default pull_requests org
    current="$(read_permissions)"
    default="$(jq -r .default_workflow_permissions <<< "${current}")"
    pull_requests="$(jq -r .can_approve_pull_request_reviews <<< "${current}")"
    dit "permissions par défaut des workflows : ${default} — laissées telles quelles, les modèles déclarent les leurs"
    dit "les workflows peuvent créer des demandes de fusion : ${pull_requests}"
    if [ "${pull_requests}" = true ]; then
        ok "déjà en place : laissé tel quel"
        return 0
    fi
    # An organisation that forbids the setting makes it inapplicable to the repo: GitHub would accept the write
    # with no effect, or refuse it without saying why.
    org="$(gh api "orgs/${ORGANISATION}/actions/permissions/workflow" 2>/dev/null || true)"
    if [ -n "${org}" ] && [ "$(jq -r .can_approve_pull_request_reviews <<< "${org}")" = false ]; then
        ko "l'organisation ${ORGANISATION} interdit aux workflows de créer des demandes de fusion — autoriser « Allow GitHub Actions to create and approve pull requests » dans ses réglages d'abord"
    fi
    if confirmer_ecriture "autoriser les workflows de ${DEPOT} à créer des demandes de fusion, rien d'autre"; then
        jq -n --arg default "${default}" \
            '{ default_workflow_permissions: $default, can_approve_pull_request_reviews: true }' \
            | gh api -X PUT "repos/${DEPOT}/actions/permissions/workflow" --input - >/dev/null \
            || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
        ok "réglé"
    fi
}

step_ruleset() {
    etape "4. Contrôles exigés sur main"
    local branch expected id required
    branch="$(jq -r .default_branch <<< "${REPO_JSON}")"
    if [ -z "${CHECKS}" ]; then
        required="$(required_checks "${branch}")"
        dit "aucun contrôle demandé (--controles) : les règles de ${branch} restent telles quelles"
        dit "exigés aujourd'hui : $(joined <<< "${required}")"
        return 0
    fi
    expected="$(expected_ruleset)"
    id="$(gh api "repos/${DEPOT}/rulesets?includes_parents=false" \
        -q ".[] | select(.name == \"${RULESET_NAME}\") | .id" 2>/dev/null)" \
        || ko "règles de ${DEPOT} illisibles — droits d'administration manquants ?"
    local summary
    summary="exiger $(joined <<< "${CHECKS}") sur ${branch} (branche à jour : ${A_JOUR}), refuser suppression et poussée forcée, sans dispense"
    if [ -z "${id}" ]; then
        dit "règles « ${RULESET_NAME} » absentes"
        if confirmer_ecriture "${summary}"; then
            gh api -X POST "repos/${DEPOT}/rulesets" --input - <<< "${expected}" >/dev/null \
                || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
            ok "règles « ${RULESET_NAME} » posées"
        fi
    elif [ "$(gh api "repos/${DEPOT}/rulesets/${id}" | normalise_ruleset)" = "$(normalise_ruleset <<< "${expected}")" ]; then
        ok "règles « ${RULESET_NAME} » déjà en place : laissées telles quelles"
    else
        dit "règles « ${RULESET_NAME} » différentes de celles demandées"
        if confirmer_ecriture "les remplacer : ${summary}"; then
            gh api -X PUT "repos/${DEPOT}/rulesets/${id}" --input - <<< "${expected}" >/dev/null \
                || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
            ok "règles « ${RULESET_NAME} » remplacées"
        fi
    fi
}

check() {
    etape "5. Constat, en lecture seule"
    local repo after branch required check missing=0
    repo="$(read_repo)"
    if [ -z "${repo}" ]; then
        echo "  ✗ ${DEPOT} n'existe pas" >&2
        exit 1
    fi
    if [ -n "${DESCRIPTION}" ] && [ "$(jq -r '.description // ""' <<< "${repo}")" != "${DESCRIPTION}" ]; then
        echo "  ✗ description différente de celle demandée" >&2
        missing=1
    fi
    if [ "$(jq -r .delete_branch_on_merge <<< "${repo}")" = true ]; then
        ok "une branche fusionnée est supprimée"
    else
        echo "  ✗ réglage absent : les branches fusionnées resteront" >&2
        missing=1
    fi
    after="$(read_permissions)"
    if [ "$(jq -r .can_approve_pull_request_reviews <<< "${after}")" = true ]; then
        ok "la propagation peut ouvrir sa demande de fusion"
    else
        echo "  ✗ réglage absent : la propagation échouera à ouvrir sa demande de fusion" >&2
        missing=1
    fi
    branch="$(jq -r .default_branch <<< "${repo}")"
    required="$(required_checks "${branch}")"
    while IFS= read -r check; do
        [ -n "${check}" ] || continue
        if grep -Fxq -- "${check}" <<< "${required}"; then
            ok "${branch} exige « ${check} »"
        else
            echo "  ✗ ${branch} n'exige pas « ${check} » : la vérification signale sans bloquer" >&2
            missing=1
        fi
    done <<< "${CHECKS}"
    [ -n "${CHECKS}" ] || dit "contrôles exigés sur ${branch} : $(joined <<< "${required}")"
    [ "${missing}" = 0 ] || exit 1
}

# --- Run ---------------------------------------------------------------------------------------------------------

cible "Dépôt" "${DEPOT}"
cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
[ -z "${SOURCE}" ] || ecrit "s'il n'existe pas : le dépôt ${VISIBILITE} ${DEPOT}, origine de ${SOURCE}, et sa branche main"
[ -z "${DESCRIPTION}" ] || ecrit "la description du dépôt"
ecrit "le réglage « supprimer la branche à la fusion »"
ecrit "le réglage « les workflows peuvent créer des demandes de fusion »"
[ -z "${CHECKS}" ] || ecrit "les règles « ${RULESET_NAME} » de la branche par défaut"

if [ "${CHECK_ONLY}" = 1 ]; then
    option_commune --dry-run
    bandeau "Constat du référentiel de cadrage ${DEPOT}, en lecture seule"
else
    bandeau "Préparation du référentiel de cadrage ${DEPOT}"
    step_repo
    if [ -z "${REPO_JSON}" ]; then
        dit "à blanc, ou création refusée : les réglages se liront une fois le dépôt créé"
        exit 0
    fi
    step_branch_deletion
    step_pull_requests
    step_ruleset
fi
check
echo
echo "Terminé."
