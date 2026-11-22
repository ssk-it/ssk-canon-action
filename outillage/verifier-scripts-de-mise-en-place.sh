#!/bin/bash
#
# Vérifie, sans rien lancer qui écrive, ce qui se vérifie de la pratique des scripts de mise en place (voir
# docs/pratiques.md, « Les scripts de mise en place ») : chaque .ps1 porte un BOM UTF-8 ; chaque script bash, bibliothèques
# comprises, se lit sous bash 3.2, n'emploie aucune construction propre à bash 4 et passe shellcheck ; chaque script qui
# source lib/ecritures-confirmees.sh répond à --aide sans rien demander. Il ne juge ni le bandeau ni les confirmations :
# la revue s'en charge.
#
# Usage : scripts/verifier-scripts-de-mise-en-place.sh [dossier…]   (défaut : scripts)
#
# Le bash qui lit les scripts est BASH_32 (/bin/bash par défaut, en 3.2 sur macOS) ; le contrôle refuse tout autre que
# 3.x, qui accepterait sans rien dire ce que bash 3.2 rejette. Ailleurs que sur un Mac, l'image Docker bash:3.2 le
# fournit — c'est ce que fait le job « Scripts de mise en place » du workflow des demandes de fusion :
#   docker run --rm -v "$PWD":/src -w /src bash:3.2 sh -c \
#     'apk add -q --no-cache shellcheck musl-locales && BASH_32=bash bash scripts/verifier-scripts-de-mise-en-place.sh'
# musl-locales fournit `locale`, dont lib/ecritures-confirmees.sh a besoin pour répondre à --aide.
#
# Copie du gabarit ssk-it/claude-config, skills/initialiser-projet/references/gabarits. Une correction faite ici se
# reporte au gabarit, sinon les dépôts divergent.

set -euo pipefail
export LC_ALL=C

[ $# -gt 0 ] || set -- scripts
BASH_32="${BASH_32:-/bin/bash}"
echecs=0
echec() { echo "✗ $*"; echecs=$((echecs + 1)); }

version="$("${BASH_32}" -c 'echo "${BASH_VERSION}"' 2>/dev/null)" || { echo "✗ ${BASH_32} introuvable (BASH_32)"; exit 1; }
case "${version}" in
    3.*) ;;
    *) echo "✗ ${BASH_32} n'est pas un bash 3.x (BASH_VERSION : ${version:-vide}) : il faut un bash 3.x pour éprouver les scripts (BASH_32, ou l'image bash:3.2)"; exit 1 ;;
esac
# Refuser plutôt que de taire : un contrôle qui saute quand son outil manque donne une assurance qu'il n'a pas.
command -v shellcheck >/dev/null || { echo "✗ shellcheck introuvable (brew install shellcheck, apk add shellcheck)"; exit 1; }

# Ce que bash 3.2 ne connaît pas, et que bash -n laisse passer parce qu'il ne l'évalue qu'à l'exécution : tableaux
# associatifs, références nommées, mapfile, changement de casse, redirections et motifs de case de bash 4. Hors
# commentaires.
readonly BASH_4='(declare|local|typeset|readonly) +-[a-zA-Z]*[An]|\b(mapfile|readarray|coproc)\b|\$\{[!#]?[A-Za-z_][A-Za-z_0-9]*(\[[^]]*\])?(,,?|\^\^?)|;;&|&>>|\|&'

while IFS= read -r -d '' f; do
    [ "$(head -c3 "${f}" | od -An -tx1 | tr -d ' \n')" = "efbbbf" ] || echec "${f} : pas de BOM UTF-8 (PowerShell 5.1 le lirait en ANSI)"
done < <(find "$@" -name '*.ps1' -print0)

nombre=0
while IFS= read -r -d '' f; do
    nombre=$((nombre + 1))
    "${BASH_32}" -n "${f}" || { echec "${f} : ne se lit pas sous bash ${version}"; continue; }
    # Ce script-ci porte le motif lui-même : il ne s'y cherche pas.
    if ! [ "${f}" -ef "$0" ] && lignes="$(grep -nE "${BASH_4}" "${f}" | grep -vE '^[0-9]+:[[:space:]]*#')"; then
        echec "${f} : construction propre à bash 4 —"$'\n'"${lignes}"
    fi
    shellcheck -x -P SCRIPTDIR -S warning "${f}" >/dev/null || echec "${f} : shellcheck (shellcheck -x -P SCRIPTDIR ${f})"
    case "${f}" in */lib/*) continue ;; esac
    grep -q 'lib/ecritures-confirmees.sh' "${f}" || continue
    "${BASH_32}" "${f}" --aide < /dev/null > /dev/null 2>&1 || echec "${f} : --aide échoue ou demande quelque chose"
done < <(find "$@" -name '*.sh' -print0)

[ "${echecs}" = 0 ] || exit 1
echo "✓ ${nombre} script(s) bash conformes sous bash ${version}"
