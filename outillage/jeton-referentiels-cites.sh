#!/bin/bash
#
# Sets on a scoping repo the SSK_CANON_JETON_CITES secret, with which its check
# reads the specifications it cites — docs/citations.md.
#
#   1. read-only: the specifications the repo declares in `referentiels_cites`
#      of its ssk-canon.yml, on its default branch, and those of them that are
#      private;
#   2. the token, typed on the keyboard without echo, must read each of the private specifications;
#   3. the secret, set on the scoping repo;
#   4. read-only: the secret is in place.
#
# A workflow's token reads only its own repo: without another token, a private cited
# specification cannot be read, and its citations are reported as unchecked — a warning,
# nothing fails, but nothing is checked either. A public cited specification is read
# without a token: if they all are, the script says so and writes nothing.
#
# The token is created by hand, once, on GitHub — Settings → Developer settings →
# Fine-grained tokens: resource owner, the organisation of the cited specifications;
# access to the cited repos only; Contents permission read-only, nothing else. A
# fine-grained token covers a single owner: cited specifications under two owners
# require another means (docs/citations.md).
#
# Usage: outillage/jeton-referentiels-cites.sh <owner>/<scoping-repo>
#
# Reading and writing the secret go through the gh session, which must be able to
# administer the scoping repo. The token is never displayed nor passed as an argument:
# it goes to gh through its standard input and through the environment of a single command.
#
# Each write is announced and confirmed before being made. GitHub never returns a
# secret's value: an already set secret is replaced, or left. The script can therefore
# be run again, when the token is renewed for example.
#
# Requirements: gh, node, and `npm ci` done in this repo (the script reads the
# configuration with the library, like the check).

set -euo pipefail

ok()  { echo "  ✓ $*"; }
ko()  { echo "  ✗ $*" >&2; exit 1; }
say() { echo "  · $*"; }

confirm() {
    local answer
    read -r -p "  → $* [o/N] " answer
    [ "${answer}" = "o" ] || [ "${answer}" = "O" ]
}

for tool in gh node; do
    command -v "${tool}" >/dev/null || ko "${tool} introuvable"
done

REPO="${1:-}"
NAME=SSK_CANON_JETON_CITES
HERE="$(cd "$(dirname "$0")/.." && pwd)"
[[ "${REPO}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || ko "usage : $0 <propriétaire>/<dépôt-cadré>"
[ -d "${HERE}/node_modules/js-yaml" ] || ko "dépendances absentes — npm ci dans ${HERE}"
gh auth status >/dev/null 2>&1 || ko "gh n'est pas connecté — gh auth login"

# --- 1. The cited specifications --------------------------------------------------------

echo "1. Référentiels cités par ${REPO}"
CONFIG="$(gh api -H 'Accept: application/vnd.github.raw' "repos/${REPO}/contents/ssk-canon.yml" 2>/dev/null)" \
    || ko "ssk-canon.yml de ${REPO} illisible"
# The library's reading, to keep exactly what the check will keep.
# Run from this repo, so that js-yaml resolves there.
CITED="$(cd "${HERE}" && node --input-type=module -e '
    const { load } = await import("js-yaml");
    const { referentielsCites } = await import(process.argv[1] + "/src/citations.mjs");
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    const { cites, anomalies } = referentielsCites(load(text));
    if (anomalies.length) console.error(`  · ${anomalies.length} entrée(s) de referentiels_cites écartée(s)`);
    for (const repo of new Set(cites.values())) console.log(repo);' "${HERE}" <<< "${CONFIG}")"
[ -n "${CITED}" ] || { say "aucun référentiel cité : rien à poser"; exit 0; }

PRIVATE_REPOS=()
while read -r cited; do
    if IS_PRIVATE="$(gh api "repos/${cited}" -q .private 2>/dev/null)"; then
        if [ "${IS_PRIVATE}" = true ]; then say "${cited} : privé"; PRIVATE_REPOS+=("${cited}"); else ok "${cited} : public, se lit sans jeton"; fi
    else
        # Out of reach of the gh session: maybe private, maybe nonexistent.
        say "${cited} : illisible avec la session de gh — tenu pour privé"
        PRIVATE_REPOS+=("${cited}")
    fi
done <<< "${CITED}"
[ "${#PRIVATE_REPOS[@]}" -gt 0 ] || { ok "tous publics : aucun jeton n'est nécessaire"; exit 0; }
echo

# --- 2. The token -----------------------------------------------------------------------

echo "2. Jeton en lecture seule sur ${PRIVATE_REPOS[*]}"
read -r -s -p "  → jeton (rien ne s'affiche) : " TOKEN
echo
[ -n "${TOKEN}" ] || ko "jeton vide"
for cited in "${PRIVATE_REPOS[@]}"; do
    GH_TOKEN="${TOKEN}" gh api "repos/${cited}/contents/ssk-canon.yml" --silent 2>/dev/null \
        && ok "${cited} : lu" \
        || ko "${cited} : le jeton ne le lit pas — accès au dépôt et permission Contents en lecture ?"
done
echo

# --- 3. The secret ----------------------------------------------------------------------

echo "3. Secret ${NAME} de ${REPO}"
if gh secret list --repo "${REPO}" --json name -q '.[].name' 2>/dev/null | grep -qx "${NAME}"; then
    say "déjà posé ; GitHub n'en rend pas la valeur"
    QUESTION="remplacer ${NAME} par ce jeton ?"
else
    say "absent"
    QUESTION="poser ${NAME} sur ${REPO} ?"
fi
if confirm "${QUESTION}"; then
    printf '%s' "${TOKEN}" | gh secret set "${NAME}" --repo "${REPO}" >/dev/null \
        || ko "écriture refusée — droits d'administration de ${REPO} manquants ?"
    ok "posé"
else
    say "laissé tel quel"
fi
unset TOKEN
echo

# --- 4. Read-only check -----------------------------------------------------------------

echo "4. Vérification"
if gh secret list --repo "${REPO}" --json name -q '.[].name' | grep -qx "${NAME}"; then
    ok "la vérification de ${REPO} lira ses référentiels cités privés"
else
    echo "  ✗ secret absent : les citations vers un référentiel privé resteront non vérifiées" >&2
    exit 1
fi
echo
echo "Terminé."
