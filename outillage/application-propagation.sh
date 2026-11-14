#!/bin/bash
#
# Creates the GitHub App of the automation, under which the propagation opens its
# pull request, and gives its identity to the scoping repos — README, « Installation
# dans un dépôt cadré », RG-propagation-identite-dediee.
#
#   1. the app, owned by ssk-it: created from a manifest in the browser if it does not
#      exist yet — contents and pull requests in writing, nothing else, no webhook;
#   2. its client ID (variable SSK_CANON_APP_ID) and private key (secret
#      SSK_CANON_APP_CLE): an organisation variable and secret visible to its scoping
#      repos only, for ssk-it and Vanex-Proprete; a variable and a secret on each
#      scoping repo for the sskorupski account, which has no organisation;
#   3. its installation, in the browser, on the scoping repos of each account;
#   4. read-only: the variable and the secret are in place, and the app is installed.
#
# Opened with the workflow token, a propagation pull request gets its checks in an
# approval-required state, and that pending run blocks the merge even once
# `verifier` is green: on ssk-terrarium-cadrage, #24 and #25 waited for a human
# on 8 November 2026. The installation token of an app triggers the checks like
# any contributor's.
#
# The scoping repos are those of ~/.claude/cadrage-canon.json (list « projets »),
# by their origin. A repo of another account is reported, and never touched.
#
# Usage: outillage/application-propagation.sh [<configuration>]
#
# No credential is asked for: the script goes through the gh session, which must have
# admin rights on the organisations and the repos (`gh auth status`, admin:org scope).
# The private key is never displayed: it comes from GitHub when the app is created, or
# from the .pem file GitHub has the key downloaded to, and goes to gh on its standard
# input. A key that GitHub no longer gives is only asked for when a secret is missing.
#
# Each write is announced and confirmed before being made; what is already in place is
# left as is. The script can therefore be run again — after adding a specification to
# the configuration, for instance.
#
# Requirements: gh, jq, git, openssl.

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
say() { echo "  · $*"; }
warn() { echo "  ✗ $*" >&2; }

confirm() {
    local answer
    read -r -p "  → $* [o/N] " answer
    [ "${answer}" = "o" ] || [ "${answer}" = "O" ]
}

for tool in gh jq git openssl; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done

APP_OWNER=ssk-it
APP_NAME="SSK Canon propagation"
APP_SLUG=ssk-canon-propagation
VARIABLE=SSK_CANON_APP_ID
SECRET=SSK_CANON_APP_CLE
# The accounts whose scoping repos receive the app. A repo of any other account is
# reported: giving it the key is its owner's decision.
ORGANISATIONS=(ssk-it Vanex-Proprete)
PERSONAL=(sskorupski)

CONFIGURATION="${1:-${HOME}/.claude/cadrage-canon.json}"
[ -r "${CONFIGURATION}" ] || ko "configuration illisible : ${CONFIGURATION}"
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

repo_of() {
    local url
    url="$(git -C "$1" remote get-url origin 2>/dev/null)" || return 1
    url="${url%.git}"
    [[ "${url}" =~ github\.com[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)$ ]] || return 1
    echo "${BASH_REMATCH[1]}"
}

contains() {
    local needle="$1"; shift
    local item
    for item in "$@"; do [ "${item}" = "${needle}" ] && return 0; done
    return 1
}

# --- 0. The scoping repos ---------------------------------------------------------------

echo "0. Référentiels de ${CONFIGURATION}"
REPOS=()
OTHERS=()
while IFS= read -r project; do
    clone="${project/#\~/${HOME}}"
    if ! repo="$(repo_of "${clone}")"; then
        say "passé, pas de clone avec une origine GitHub : ${project}"
        continue
    fi
    owner="${repo%%/*}"
    if contains "${owner}" "${ORGANISATIONS[@]}" "${PERSONAL[@]}"; then
        REPOS+=("${repo}")
    else
        OTHERS+=("${repo}")
    fi
done < <(jq -r '.projets // [] | .[] | if type == "object" then .chemin else . end' "${CONFIGURATION}")
[ "${#REPOS[@]}" -gt 0 ] || ko "aucun référentiel de ${ORGANISATIONS[*]} ${PERSONAL[*]} dans ${CONFIGURATION}"
ok "${#REPOS[@]} référentiel(s)"
for repo in ${OTHERS[@]+"${OTHERS[@]}"}; do
    say "laissé de côté, compte hors de ${ORGANISATIONS[*]} ${PERSONAL[*]} : ${repo} — à son propriétaire de lui donner l'application"
done
echo

repos_of() {
    local owner="$1" repo
    for repo in "${REPOS[@]}"; do
        [ "${repo%%/*}" = "${owner}" ] && echo "${repo}"
    done
    return 0
}

# Fills OWNED with the scoping repos of an account. macOS's bash, 3.2, has no mapfile.
OWNED=()
load_owned() {
    local repo
    OWNED=()
    while IFS= read -r repo; do
        [ -n "${repo}" ] && OWNED+=("${repo}")
    done < <(repos_of "$1")
    return 0
}

# --- 1. The app -------------------------------------------------------------------------

echo "1. Application ${APP_SLUG}, propriété de ${APP_OWNER}"
CLIENT_ID=""
PEM=""
if APP="$(gh api "apps/${APP_SLUG}" 2>/dev/null)"; then
    CLIENT_ID="$(jq -r .client_id <<< "${APP}")"
    ok "déjà créée : $(jq -r .html_url <<< "${APP}") — identifiant client ${CLIENT_ID}"
else
    say "absente"
    say "à créer dans le navigateur, à partir d'un manifeste : publique — installable sur"
    say "Vanex-Proprete et sskorupski —, contenu et demandes de fusion en écriture, rien d'autre, sans webhook"
    if ! confirm "ouvrir la création de l'application dans le navigateur ?"; then
        ko "application absente : rien d'autre ne peut être posé"
    fi
    STATE="$(openssl rand -hex 12)"
    # The browser comes back to this address with the code in its URL: nothing listens
    # there, and the page that fails to load still shows the code in the address bar.
    MANIFEST="$(jq -n --arg name "${APP_NAME}" '{
        name: $name,
        url: "https://github.com/ssk-it/ssk-canon-action",
        description: "Ouvre et fusionne la demande de propagation des référentiels SSK Canon.",
        public: true,
        redirect_url: "http://localhost:9/",
        hook_attributes: { url: "https://github.com/ssk-it/ssk-canon-action", active: false },
        default_permissions: { contents: "write", pull_requests: "write", metadata: "read" },
        default_events: []
    }')"
    FORM="$(mktemp -d)/application.html"
    # The manifest goes in a form posted by the browser: GitHub only accepts it that way.
    MANIFEST_HTML="$(sed -e 's/&/\&amp;/g' -e 's/"/\&quot;/g' -e 's/</\&lt;/g' <<< "${MANIFEST}")"
    cat > "${FORM}" <<HTML
<!doctype html><html lang="fr"><meta charset="utf-8"><title>Créer ${APP_NAME}</title>
<form method="post" action="https://github.com/organizations/${APP_OWNER}/settings/apps/new?state=${STATE}">
<input type="hidden" name="manifest" value="${MANIFEST_HTML}">
<p><button type="submit">Créer l'application ${APP_NAME} sur ${APP_OWNER}</button></p>
</form></html>
HTML
    open "${FORM}" 2>/dev/null || say "ouvrir à la main : ${FORM}"
    say "après « Create GitHub App », le navigateur part vers localhost:9 et n'y trouve rien :"
    say "copier la valeur de « code » dans sa barre d'adresse"
    read -r -s -p "  → code : " CODE
    echo
    [[ "${CODE}" =~ ^[A-Za-z0-9_-]+$ ]] || ko "code attendu, reçu une valeur vide ou malformée"
    rm -f "${FORM}"
    # The conversion gives the private key once: it is kept in memory for the secrets,
    # never written or displayed.
    CONVERSION="$(gh api -X POST "app-manifests/${CODE}/conversions")" \
        || ko "conversion refusée — code expiré (une heure) ou déjà employé : relancer le script"
    CLIENT_ID="$(jq -r .client_id <<< "${CONVERSION}")"
    PEM="$(jq -r .pem <<< "${CONVERSION}")"
    APP_SLUG="$(jq -r .slug <<< "${CONVERSION}")"
    unset CONVERSION
    ok "créée : https://github.com/apps/${APP_SLUG} — identifiant client ${CLIENT_ID}"
fi
echo

# Asked for only when a secret has to be written and the key is not in memory: GitHub
# gives it once, at creation, and otherwise lets it be downloaded as a new key.
key() {
    [ -n "${PEM}" ] && return 0
    say "la clé privée n'est plus donnée par GitHub : en générer une dans les réglages de l'application"
    say "(https://github.com/organizations/${APP_OWNER}/settings/apps/${APP_SLUG}, « Generate a private key »)"
    local file
    read -r -p "  → chemin du fichier .pem téléchargé : " file
    file="${file/#\~/${HOME}}"
    [ -r "${file}" ] || ko "fichier illisible : ${file}"
    grep -q "PRIVATE KEY" "${file}" || ko "${file} n'est pas une clé privée"
    PEM="$(cat "${file}")"
    if confirm "supprimer ${file}, désormais inutile ?"; then
        rm -f "${file}"
        ok "supprimé"
    fi
}

# --- 2. The variable and the secret -----------------------------------------------------

echo "2. Variable ${VARIABLE} et secret ${SECRET}"
for organisation in "${ORGANISATIONS[@]}"; do
    load_owned "${organisation}"
    [ "${#OWNED[@]}" -gt 0 ] || continue
    ORG_REPOS=("${OWNED[@]}")
    NAMES="$(printf '%s\n' "${ORG_REPOS[@]}" | sed 's#.*/##' | paste -sd, -)"
    IDS="$(for repo in "${ORG_REPOS[@]}"; do gh api "repos/${repo}" -q .id; done | jq -sc .)"
    echo "  ━━ ${organisation} — visibles de : ${NAMES}"

    CURRENT="$(gh api "orgs/${organisation}/actions/variables/${VARIABLE}" 2>/dev/null || true)"
    CURRENT_REPOS="$(gh api "orgs/${organisation}/actions/variables/${VARIABLE}/repositories" \
        -q '[.repositories[].id] | sort' 2>/dev/null || echo '[]')"
    if [ -n "${CURRENT}" ] && [ "$(jq -r .value <<< "${CURRENT}")" = "${CLIENT_ID}" ] \
        && [ "$(jq -c 'sort' <<< "${IDS}")" = "$(jq -c . <<< "${CURRENT_REPOS}")" ]; then
        ok "${VARIABLE} déjà en place"
    elif confirm "poser ${VARIABLE} = ${CLIENT_ID} sur ${organisation}, visible de ses ${#ORG_REPOS[@]} référentiel(s) ?"; then
        gh variable set "${VARIABLE}" --org "${organisation}" --body "${CLIENT_ID}" --repos "${NAMES}" >/dev/null \
            || ko "écriture refusée — droits d'administration de ${organisation} manquants ?"
        ok "${VARIABLE} posée"
    else
        say "${VARIABLE} laissée telle quelle"
    fi

    if gh api "orgs/${organisation}/actions/secrets/${SECRET}" >/dev/null 2>&1 && [ -z "${PEM}" ]; then
        # The value cannot be read back: only the repos that see it are compared.
        CURRENT_REPOS="$(gh api "orgs/${organisation}/actions/secrets/${SECRET}/repositories" \
            -q '[.repositories[].id] | sort')"
        if [ "$(jq -c 'sort' <<< "${IDS}")" = "${CURRENT_REPOS}" ]; then
            ok "${SECRET} déjà en place"
        elif confirm "rendre ${SECRET} visible des seuls ${#ORG_REPOS[@]} référentiel(s) de ${organisation} ?"; then
            jq -n --argjson ids "${IDS}" '{ selected_repository_ids: $ids }' \
                | gh api -X PUT "orgs/${organisation}/actions/secrets/${SECRET}/repositories" --input - >/dev/null \
                || ko "écriture refusée — droits d'administration de ${organisation} manquants ?"
            ok "${SECRET} visible des référentiels"
        fi
    elif confirm "poser la clé privée en ${SECRET} sur ${organisation}, visible de ses ${#ORG_REPOS[@]} référentiel(s) ?"; then
        key
        gh secret set "${SECRET}" --org "${organisation}" --repos "${NAMES}" <<< "${PEM}" >/dev/null \
            || ko "écriture refusée — droits d'administration de ${organisation} manquants ?"
        ok "${SECRET} posé"
    else
        say "${SECRET} laissé tel quel"
    fi
done

for account in "${PERSONAL[@]}"; do
    load_owned "${account}"
    for repo in ${OWNED[@]+"${OWNED[@]}"}; do
        echo "  ━━ ${repo} — compte personnel, sans secret d'organisation"
        if [ "$(gh variable get "${VARIABLE}" -R "${repo}" 2>/dev/null || true)" = "${CLIENT_ID}" ]; then
            ok "${VARIABLE} déjà en place"
        elif confirm "poser ${VARIABLE} = ${CLIENT_ID} sur ${repo} ?"; then
            gh variable set "${VARIABLE}" -R "${repo}" --body "${CLIENT_ID}" >/dev/null || ko "écriture refusée sur ${repo}"
            ok "${VARIABLE} posée"
        fi
        if gh api "repos/${repo}/actions/secrets/${SECRET}" >/dev/null 2>&1 && [ -z "${PEM}" ]; then
            ok "${SECRET} déjà en place"
        elif confirm "poser la clé privée en ${SECRET} sur ${repo} ?"; then
            key
            gh secret set "${SECRET}" -R "${repo}" <<< "${PEM}" >/dev/null || ko "écriture refusée sur ${repo}"
            ok "${SECRET} posé"
        fi
    done
done
unset PEM
echo

# --- 3. The installation ----------------------------------------------------------------

echo "3. Installation de l'application"
for account in "${ORGANISATIONS[@]}" "${PERSONAL[@]}"; do
    load_owned "${account}"
    [ "${#OWNED[@]}" -gt 0 ] || continue
    ACCOUNT_REPOS=("${OWNED[@]}")
    INSTALLED=""
    if contains "${account}" "${ORGANISATIONS[@]}"; then
        INSTALLED="$(gh api "orgs/${account}/installations" \
            -q ".installations[] | select(.app_slug == \"${APP_SLUG}\") | .id" 2>/dev/null || true)"
    fi
    if [ -n "${INSTALLED}" ]; then
        ok "${account} : installée — les référentiels à y retenir, s'il en manque, se règlent dans"
        say "https://github.com/organizations/${account}/settings/installations/${INSTALLED}"
        continue
    fi
    say "${account} : choisir le compte, « Only select repositories », et ces ${#ACCOUNT_REPOS[@]} référentiel(s) :"
    for repo in "${ACCOUNT_REPOS[@]}"; do say "   ${repo#*/}"; done
    if confirm "ouvrir l'installation sur ${account} dans le navigateur ?"; then
        open "https://github.com/apps/${APP_SLUG}/installations/new" 2>/dev/null \
            || say "ouvrir à la main : https://github.com/apps/${APP_SLUG}/installations/new"
        read -r -p "  → Entrée une fois l'installation faite " _
    fi
done
echo

# --- 4. Read-only check -----------------------------------------------------------------

echo "4. Vérification"
MISSING=0
for organisation in "${ORGANISATIONS[@]}"; do
    [ -n "$(repos_of "${organisation}")" ] || continue
    if [ "$(gh api "orgs/${organisation}/actions/variables/${VARIABLE}" -q .value 2>/dev/null || true)" = "${CLIENT_ID}" ] \
        && gh api "orgs/${organisation}/actions/secrets/${SECRET}" >/dev/null 2>&1; then
        ok "${organisation} : variable et secret en place"
    else
        warn "${organisation} : variable ou secret absent — ses propagations restent au jeton du workflow"
        MISSING=1
    fi
    if gh api "orgs/${organisation}/installations" -q ".installations[].app_slug" 2>/dev/null | grep -qx "${APP_SLUG}"; then
        ok "${organisation} : application installée"
    else
        warn "${organisation} : application non installée"
        MISSING=1
    fi
done
for account in "${PERSONAL[@]}"; do
    while IFS= read -r repo; do
        [ -n "${repo}" ] || continue
        if [ "$(gh variable get "${VARIABLE}" -R "${repo}" 2>/dev/null || true)" = "${CLIENT_ID}" ] \
            && gh api "repos/${repo}/actions/secrets/${SECRET}" >/dev/null 2>&1; then
            ok "${repo} : variable et secret en place"
        else
            warn "${repo} : variable ou secret absent"
            MISSING=1
        fi
    done < <(repos_of "${account}")
    # A personal account's installations are not readable with the gh session: the
    # first propagation says it, when the token is refused.
    say "${account} : installation à constater dans https://github.com/settings/installations"
done
say "chaque référentiel doit encore transmettre l'identité à sa propagation : outillage/preparer-depots-cadres.sh"
[ "${MISSING}" = 0 ] || exit 1
echo
echo "Terminé."
