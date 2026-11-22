#!/bin/bash
#
# Sets on a scoping repo the SSK_CANON_JETON_CITES secret, with which its check reads the specifications it cites
# — docs/citations.md.
#
#   1. read-only: the specifications the repo declares in `referentiels_cites` of its ssk-canon.yml, on its default
#      branch, and those of them that are private;
#   2. the token, typed on the keyboard without echo, must read each of the private specifications;
#   3. the secret, set on the scoping repo;
#   4. read-only check (also alone, --constat): the secret is in place.
#
# It does not create the token — that is done by hand on GitHub, see below — and deletes nothing.
#
# A workflow's token reads only its own repo: without another token, a private cited specification cannot be read,
# and its citations are reported as unchecked — a warning, nothing fails, but nothing is checked either. A public
# cited specification is read without a token: if they all are, the script says so and writes nothing.
#
# The token is created by hand, once, on GitHub — Settings → Developer settings → Fine-grained tokens: resource
# owner, the organisation of the cited specifications; access to the cited repos only; Contents permission
# read-only, nothing else. A fine-grained token covers a single owner: cited specifications under two owners
# require another means (docs/citations.md).
#
# Usage: outillage/jeton-referentiels-cites.sh --depot <propriétaire>/<dépôt-cadré>
#            [--noconfirm] [--dry-run] [--constat] [--aide]
#        DEPOT= also, or the repo alone as first argument. At the end of a pipe, the token is read on standard input.
#
# Reading and writing the secret go through the gh session, which must be able to administer the scoping repo. The
# token is never displayed nor passed as an argument: it goes to gh through its standard input and through the
# environment of a single command. A banner says what the script acts on before anything is written, then each
# write is announced and confirmed. GitHub never returns a secret's value: an already set secret is replaced, or
# left. The script can therefore be run again, when the token is renewed for example.
#
# Requirements: gh, node, and `npm ci` done in this repo (the script reads the configuration with the library,
# like the check).

set -euo pipefail
TOOLS="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ecritures-confirmees.sh
. "${TOOLS}/lib/ecritures-confirmees.sh"

parametre DEPOT ""
NAME=SSK_CANON_JETON_CITES
ROOT="$(cd "${TOOLS}/.." && pwd)"
CHECK_ONLY=0

aide() {
    sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    echo "  --depot <propriétaire>/<dépôt-cadré>  le référentiel qui cite (DEPOT=)"
    echo "  --constat                             seulement le constat, en lecture seule"
    aide_commune
}
while [ $# -gt 0 ]; do
    case "$1" in
        --depot)   fixer DEPOT "${2:?--depot demande <propriétaire>/<dépôt-cadré>}"; shift 2 ;;
        --constat) CHECK_ONLY=1; shift ;;
        --aide|-h) aide; exit 0 ;;
        -*)        option_commune "$1" || ko "option inconnue : $1 (--aide)"; shift ;;
        *)         fixer DEPOT "$1"; shift ;;
    esac
done

[[ "${DEPOT}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || ko "--depot <propriétaire>/<dépôt-cadré> attendu (--aide)"
for tool in gh node; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done
[ -d "${ROOT}/node_modules/js-yaml" ] || ko "dépendances absentes — npm ci dans ${ROOT}"
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

secret_set() {
    gh secret list --repo "${DEPOT}" --json name -q '.[].name' 2>/dev/null | grep -qx "${NAME}"
}

PRIVATE_REPOS=()
step_cited() {
    etape "1. Référentiels cités par ${DEPOT}"
    local config cited is_private
    config="$(gh api -H 'Accept: application/vnd.github.raw' "repos/${DEPOT}/contents/ssk-canon.yml" 2>/dev/null)" \
        || ko "ssk-canon.yml de ${DEPOT} illisible"
    # The library's reading, to keep exactly what the check will keep. Run from this repo, so that js-yaml
    # resolves there.
    cited="$(cd "${ROOT}" && node --input-type=module -e '
        const { load } = await import("js-yaml");
        const { referentielsCites } = await import(process.argv[1] + "/src/citations.mjs");
        let text = "";
        for await (const chunk of process.stdin) text += chunk;
        const { cites, anomalies } = referentielsCites(load(text));
        if (anomalies.length) console.error(`  · ${anomalies.length} entrée(s) de referentiels_cites écartée(s)`);
        for (const repo of new Set(cites.values())) console.log(repo);' "${ROOT}" <<< "${config}")"
    if [ -z "${cited}" ]; then
        dit "aucun référentiel cité : rien à poser"
        exit 0
    fi
    while read -r cited_repo; do
        if is_private="$(gh api "repos/${cited_repo}" -q .private 2>/dev/null)"; then
            if [ "${is_private}" = true ]; then
                dit "${cited_repo} : privé"
                PRIVATE_REPOS+=("${cited_repo}")
            else
                ok "${cited_repo} : public, se lit sans jeton"
            fi
        else
            # Out of reach of the gh session: maybe private, maybe nonexistent.
            dit "${cited_repo} : illisible avec la session de gh — tenu pour privé"
            PRIVATE_REPOS+=("${cited_repo}")
        fi
    done <<< "${cited}"
    if [ "${#PRIVATE_REPOS[@]}" = 0 ]; then
        ok "tous publics : aucun jeton n'est nécessaire"
        exit 0
    fi
}

TOKEN=""
step_token() {
    etape "2. Jeton en lecture seule sur ${PRIVATE_REPOS[*]}"
    demander_secret TOKEN "Jeton des référentiels cités" \
        "GitHub, jeton à granularité fine du propriétaire des référentiels cités" \
        "lire ${PRIVATE_REPOS[*]} depuis la vérification de ${DEPOT}, où il est posé en secret ${NAME}" \
        "permanent, jusqu'à l'expiration choisie à sa création : le script se relance à son renouvellement" \
        "Contents en lecture seule, sur les seuls dépôts cités, rien d'autre" \
        "github.com → Settings → Developer settings → Fine-grained tokens → Generate new token"
    local cited_repo
    for cited_repo in "${PRIVATE_REPOS[@]}"; do
        GH_TOKEN="${TOKEN}" gh api "repos/${cited_repo}/contents/ssk-canon.yml" --silent 2>/dev/null \
            || ko "${cited_repo} : le jeton ne le lit pas — accès au dépôt et permission Contents en lecture ?"
        ok "${cited_repo} : lu"
    done
}

step_secret() {
    etape "3. Secret ${NAME} de ${DEPOT}"
    local question
    if secret_set; then
        dit "déjà posé ; GitHub n'en rend pas la valeur"
        question="remplacer le secret ${NAME} de ${DEPOT} par ce jeton"
    else
        dit "absent"
        question="poser le secret ${NAME} sur ${DEPOT}, avec ce jeton"
    fi
    if confirmer_ecriture "${question}"; then
        printf '%s' "${TOKEN}" | gh secret set "${NAME}" --repo "${DEPOT}" >/dev/null \
            || ko "écriture refusée — droits d'administration de ${DEPOT} manquants ?"
        ok "posé"
    fi
    TOKEN=""
    unset TOKEN
}

check() {
    etape "4. Constat, en lecture seule"
    if secret_set; then
        ok "la vérification de ${DEPOT} lira ses référentiels cités privés"
    else
        echo "  ✗ secret absent : les citations vers un référentiel privé resteront non vérifiées" >&2
        exit 1
    fi
}

cible "Dépôt cadré" "${DEPOT}"
cible "Compte GitHub" "$(gh api user -q .login 2>/dev/null || echo '?')"
ecrit "le secret ${NAME} de ${DEPOT}, si un référentiel cité est privé"
if [ "${CHECK_ONLY}" = 1 ]; then
    option_commune --dry-run
    bandeau "Constat de ${NAME} sur ${DEPOT}, en lecture seule"
else
    bandeau "Jeton des référentiels cités par ${DEPOT}"
    step_cited
    if [ "${EC_A_BLANC}" = 1 ]; then
        etape "2. Jeton"
        dit "à blanc, non demandé : il ne servirait qu'à l'écriture du secret"
        etape "3. Secret ${NAME} de ${DEPOT}"
        if secret_set; then dit "déjà posé"; else dit "absent"; fi
        confirmer_ecriture "poser ou remplacer le secret ${NAME} sur ${DEPOT}" || true
    else
        step_token
        step_secret
    fi
fi
check
echo
echo "Terminé."
