# shellcheck shell=bash
#
# Ce que partagent les scripts de mise en place d'un dépôt : le bandeau qui dit sur quoi le script agit avant toute
# écriture, la confirmation de chaque écriture, les modes --noconfirm et --dry-run, une sortie en UTF-8, la saisie d'un
# secret expliqué, et le rangement d'un mot de passe au trousseau. À sourcer en tête d'un script, jamais à lancer :
#   . "$(dirname "$0")/lib/ecritures-confirmees.sh"
# Elle ne demande ni n'écrit rien d'elle-même. Compatible bash 3.2 (macOS).
#
# Copie du gabarit ssk-it/claude-config, skills/initialiser-projet/references/gabarits/ecritures-confirmees.sh. Une
# correction faite ici se reporte au gabarit, sinon les dépôts divergent. La pratique qu'elle sert :
# skills/initialiser-projet/references/scripts.md.

# --- Sortie stable ------------------------------------------------------------------------------------------------
# Une locale UTF-8 quelle que soit celle du terminal (ssh, cron, CI) : sans elle, les accents et les ✓ sortent brouillés
# et grep, sort, tr changent de comportement d'une machine à l'autre.
ec_locale_utf8() {
    local disponibles l
    disponibles="$(locale -a 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -d '-')"
    for l in C.UTF-8 en_US.UTF-8 fr_FR.UTF-8; do
        if printf '%s\n' "${disponibles}" | grep -qx "$(printf '%s' "${l}" | tr '[:upper:]' '[:lower:]' | tr -d '-')"; then
            printf '%s' "${l}"
            return 0
        fi
    done
    return 1
}
if EC_LOCALE="$(ec_locale_utf8)"; then
    export LC_ALL="${EC_LOCALE}"
else
    echo "  ✗ aucune locale UTF-8 sur cette machine (locale -a) : sortie illisible, arrêt" >&2
    exit 1
fi

ok()    { echo "  ✓ $*"; }
dit()   { echo "  · $*"; }
ko()    { echo "  ✗ $*" >&2; exit 1; }
etape() { echo; echo "== $*"; }

# --- Paramètres ---------------------------------------------------------------------------------------------------
# parametre NOM DEFAUT : NOM vaut la variable d'environnement si elle est posée, sinon DEFAUT. fixer NOM VALEUR : la
# valeur vient d'une option. Le bandeau dit d'où vient chaque valeur.
EC_PARAMETRES=()
parametre() {
    local nom="$1" defaut="$2"
    if [ -n "${!nom+x}" ]; then
        printf -v "EC_ORIGINE_${nom}" '%s' 'environnement'
    else
        printf -v "${nom}" '%s' "${defaut}"
        printf -v "EC_ORIGINE_${nom}" '%s' 'défaut'
    fi
    EC_PARAMETRES+=("${nom}")
}
fixer() {
    printf -v "$1" '%s' "$2"
    printf -v "EC_ORIGINE_$1" '%s' 'option'
}

# --- Modes --------------------------------------------------------------------------------------------------------
# --noconfirm : chaque confirmation répond oui d'elle-même. Réservé à un lancement décidé par l'utilisateur (par ssh,
# ou un workflow qu'il déclenche) : le bandeau le dit. --dry-run : tout est lu et annoncé, rien n'est écrit.
EC_SANS_CONFIRMATION=0
EC_A_BLANC=0
# option_commune OPTION : rend 0 si l'option est l'un des deux modes, et la prend en compte.
option_commune() {
    case "$1" in
        --noconfirm) EC_SANS_CONFIRMATION=1 ;;
        --dry-run)   EC_A_BLANC=1 ;;
        *) return 1 ;;
    esac
}
# modes_communs : les modes actifs, à passer aux étapes qu'un orchestrateur lance.
modes_communs() {
    [ "${EC_SANS_CONFIRMATION}" = 1 ] && printf '%s\n' --noconfirm
    [ "${EC_A_BLANC}" = 1 ] && printf '%s\n' --dry-run
    return 0
}
aide_commune() {
    echo "  --noconfirm   ne pose aucune question : chaque écriture annoncée est faite (lancement décidé à l'avance)"
    echo "  --dry-run     lit et annonce tout, n'écrit rien"
    echo "  --aide        cette aide"
}

# --- Bandeau ------------------------------------------------------------------------------------------------------
# cible LIBELLE VALEUR : sur quoi le script agit (organisation, cluster, bucket…). ecrit CHOSE : une ligne par chose
# qu'il peut écrire. bandeau TITRE : affiche le tout, avec la machine, les paramètres et le mode, puis demande la
# confirmation globale. Rien ne s'écrit avant. Une étape lancée par un orchestrateur (EC_ORCHESTRE=1, posé par lui après
# son propre bandeau) n'affiche que son titre : la question globale a déjà été posée.
EC_CIBLE=()
EC_PERIMETRE=()
cible() { EC_CIBLE+=("$1 : $2"); }
ecrit() { EC_PERIMETRE+=("$1"); }
bandeau() {
    local ligne nom origine
    if [ "${EC_ORCHESTRE:-0}" = 1 ]; then
        etape "$1"
        return 0
    fi
    echo "=============================================================================="
    echo "$1"
    echo "Agit sur"
    echo "  · machine : $(hostname -s 2>/dev/null || hostname), utilisateur $(id -un)"
    for ligne in ${EC_CIBLE[@]+"${EC_CIBLE[@]}"}; do echo "  · ${ligne}"; done
    echo "Peut écrire"
    for ligne in ${EC_PERIMETRE[@]+"${EC_PERIMETRE[@]}"}; do echo "  · ${ligne}"; done
    if [ "${#EC_PARAMETRES[@]}" -gt 0 ]; then
        echo "Paramètres"
        for nom in "${EC_PARAMETRES[@]}"; do
            origine="EC_ORIGINE_${nom}"
            echo "  · ${nom}=${!nom} (${!origine})"
        done
    fi
    echo "Mode"
    if [ "${EC_A_BLANC}" = 1 ]; then
        echo "  · à blanc (--dry-run) : rien n'est écrit"
    elif [ "${EC_SANS_CONFIRMATION}" = 1 ]; then
        echo "  · sans confirmation (--noconfirm) : chaque écriture annoncée sera faite"
    else
        echo "  · confirmation avant chaque écriture"
    fi
    echo "=============================================================================="
    [ "${EC_A_BLANC}" = 1 ] && return 0
    confirmer "Commencer ?" || { dit "abandon : rien n'a été écrit"; exit 0; }
}

# --- Confirmations ------------------------------------------------------------------------------------------------
# confirmer QUESTION : oui seulement sur « o ». La réponse se lit sur le terminal, pas sur l'entrée standard : un tube
# ne répond pas à la place de l'utilisateur. Sans terminal, le script s'arrête plutôt que de deviner.
confirmer() {
    local reponse
    if [ "${EC_SANS_CONFIRMATION}" = 1 ]; then
        echo "  → $1 [o/N] o (--noconfirm)"
        return 0
    fi
    { : < /dev/tty; } 2>/dev/null || ko "pas de terminal pour confirmer « $1 » : relancer dans un terminal, ou avec --noconfirm si ce lancement est décidé"
    read -r -p "  → $1 [o/N] " reponse < /dev/tty
    [ "${reponse}" = "o" ] || [ "${reponse}" = "O" ]
}
# confirmer_ecriture ANNONCE : annonce une écriture ; rend 0 si elle doit se faire. À blanc, elle est seulement dite.
#   if confirmer_ecriture "créer le robot ${ROBOT} (pull, push sur ${PROJET})"; then … fi
confirmer_ecriture() {
    if [ "${EC_A_BLANC}" = 1 ]; then
        echo "  · à blanc, non fait : $1"
        return 1
    fi
    confirmer "$1 ?"
}

# --- Secrets ------------------------------------------------------------------------------------------------------
# demander_secret VARIABLE NOM PLATEFORME ROLE DUREE AUTORISATIONS OBTENTION : dit ce qu'est le secret avant de le
# demander — de quelle plateforme, à quoi il sert, sa durée de vie (éphémère ou permanent), les autorisations qu'il
# lui faut, comment l'obtenir —, puis le lit au clavier sans écho dans VARIABLE. Un secret qu'on ne sait pas situer
# ne se tape pas. Il ne s'affiche, ne s'écrit et ne passe en argument nulle part : printf est interne au shell.
# Un script lancé au bout d'un tube par un autre (printf '%s\n' "${CLE}" | autre.sh) reçoit le secret de lui : quand
# l'entrée standard n'est pas un terminal, la valeur en est lue, une ligne par secret, sans question ni explication — le
# script qui appelle a déjà dit ce qu'il passe.
demander_secret() {
    local variable="$1" valeur
    if [ ! -t 0 ]; then
        IFS= read -r valeur || true
        [ -n "${valeur}" ] || ko "$2 vide sur l'entrée standard : rien n'est fait"
        dit "$2 : lu sur l'entrée standard, sans affichage"
        printf -v "${variable}" '%s' "${valeur}"
        return 0
    fi
    echo
    echo "  -- Secret demandé : $2"
    echo "     Plateforme    : $3"
    echo "     Rôle          : $4"
    echo "     Durée de vie  : $5"
    echo "     Autorisations : $6"
    echo "     Où l'obtenir  : $7"
    { : < /dev/tty; } 2>/dev/null || ko "pas de terminal pour taper $2"
    read -r -s -p "     $2 : " valeur < /dev/tty
    echo
    [ -n "${valeur}" ] || ko "$2 vide : rien n'est fait"
    printf -v "${variable}" '%s' "${valeur}"
}
# demander_valeur VARIABLE QUESTION : une valeur qui n'est pas secrète (une adresse, un identifiant), tapée avec écho.
# Au bout d'un tube, comme un secret, elle est lue sur l'entrée standard.
demander_valeur() {
    local variable="$1" valeur
    if [ ! -t 0 ]; then
        IFS= read -r valeur || true
        [ -n "${valeur}" ] || ko "$2 vide sur l'entrée standard : rien n'est fait"
        dit "$2 : ${valeur}, lu sur l'entrée standard"
    else
        { : < /dev/tty; } 2>/dev/null || ko "pas de terminal pour taper $2"
        read -r -p "  → $2 : " valeur < /dev/tty
        [ -n "${valeur}" ] || ko "$2 vide : rien n'est fait"
    fi
    printf -v "${variable}" '%s' "${valeur}"
}

# proposer_trousseau SERVICE COMPTE VARIABLE UTILISATEUR CIBLE : propose de ranger le mot de passe que contient VARIABLE
# au trousseau du système, pour le retrouver sans l'avoir noté. SERVICE et COMPTE sont la clé sous laquelle un programme
# le relit ; UTILISATEUR (l'identifiant qui se tape avec ce mot de passe) et CIBLE (l'hôte, l'instance, l'adresse) disent
# à une personne à quoi il sert : l'entrée en porte le nom et le commentaire, et le script les répète ensuite, à noter
# aussi dans le gestionnaire de mots de passe. Une entrée qui existe déjà est laissée telle quelle, et sa description
# affichée : elle peut être celle d'un autre compte. Le mot de passe passe par l'entrée standard (security -i,
# secret-tool), jamais en argument.
# ec_nom_d_entree SORTIE : le nom d'une entrée, lu dans la sortie de security find-generic-password (attribut
# 0x00000007). security l'écrit en clair, ou en hexadécimal suivi d'une forme échappée dès qu'il sort de l'ASCII.
ec_nom_d_entree() {
    local ligne hex
    ligne="$(printf '%s\n' "$1" | grep '^ *0x00000007 <blob>=' || true)"
    hex="$(printf '%s' "${ligne}" | sed -n 's/.*<blob>=0x\([0-9A-Fa-f]*\).*/\1/p')"
    if [ -n "${hex}" ]; then
        printf '%s' "${hex}" | xxd -r -p
    else
        printf '%s' "${ligne}" | sed -n 's/.*<blob>="\(.*\)"$/\1/p'
    fi
}
ec_echapper() { local v="$1"; v="${v//\\/\\\\}"; printf '%s' "${v//\"/\\\"}"; }
proposer_trousseau() {
    local service="$1" compte="$2" variable="$3" utilisateur="${4:?proposer_trousseau : UTILISATEUR manque}"
    local cible="${5:?proposer_trousseau : CIBLE manque}" valeur nom commentaire existant
    valeur="${!variable}"
    nom="${utilisateur} sur ${cible}"
    commentaire="Utilisateur : ${utilisateur}. Cible : ${cible}. Rangé par $(basename "$0") le $(date +%Y-%m-%d)."
    if command -v security >/dev/null 2>&1; then
        if existant="$(security find-generic-password -s "${service}" -a "${compte}" 2>/dev/null)"; then
            ok "trousseau : ${service} / ${compte} existe déjà, laissé tel quel"
            nom="$(ec_nom_d_entree "${existant}")"
            if [ -n "${nom}" ] && [ "${nom}" != "${service}" ]; then
                dit "son nom : ${nom}"
            else
                dit "elle ne dit pas de quel utilisateur c'est le mot de passe : la ranger de nouveau depuis son programme"
            fi
            printf '%s\n' "${existant}" | grep -qF "${utilisateur}" \
                || dit "il ne nomme pas ${utilisateur} : c'est peut-être le mot de passe d'un autre compte"
            return 0
        fi
        confirmer_ecriture "ranger le mot de passe de ${nom} au trousseau de session (service ${service}, compte ${compte})" \
            || return 0
        printf 'add-generic-password -s "%s" -a "%s" -l "%s" -j "%s" -w "%s"\n' "$(ec_echapper "${service}")" \
            "$(ec_echapper "${compte}")" "$(ec_echapper "${nom}")" "$(ec_echapper "${commentaire}")" \
            "$(ec_echapper "${valeur}")" | security -i >/dev/null
        # security -i rend 0 même quand l'écriture échoue : relire l'entrée, sans son secret.
        security find-generic-password -s "${service}" -a "${compte}" >/dev/null 2>&1 \
            || ko "le trousseau a refusé le mot de passe"
        ok "rangé au trousseau de session : « ${nom} » (service ${service}, compte ${compte})"
        dit "il se voit dans Trousseaux d'accès, pas dans l'app Mots de passe, qui ne montre que le trousseau iCloud"
    elif command -v secret-tool >/dev/null 2>&1; then
        if secret-tool lookup service "${service}" account "${compte}" >/dev/null 2>&1; then
            ok "trousseau : ${service} / ${compte} existe déjà, laissé tel quel"
            secret-tool search service "${service}" account "${compte}" 2>/dev/null | grep -qF "${utilisateur}" \
                || dit "il ne nomme pas ${utilisateur} : c'est peut-être le mot de passe d'un autre compte"
            return 0
        fi
        confirmer_ecriture "ranger le mot de passe de ${nom} au trousseau (service ${service}, compte ${compte})" || return 0
        printf '%s' "${valeur}" | secret-tool store --label="${nom}" service "${service}" account "${compte}" \
            utilisateur "${utilisateur}" cible "${cible}" || ko "le trousseau a refusé le mot de passe"
        ok "rangé au trousseau : « ${nom} » (service ${service}, compte ${compte})"
    else
        dit "aucun trousseau sur cette machine (ni security ni secret-tool) : le mot de passe n'est gardé nulle part ici"
    fi
    dit "à noter aussi dans votre gestionnaire de mots de passe : utilisateur ${utilisateur}, cible ${cible},"
    dit "et le mot de passe que vous venez de taper — c'est là que vous le chercherez pour vous connecter"
}

# --- Fichiers -----------------------------------------------------------------------------------------------------
# ecrire_fichier FICHIER : écrit FICHIER depuis l'entrée standard. Les étapes d'un tube tournent ensemble : une commande
# en échec en amont laisse ici une entrée vide, avant que le shell n'arrête le script. Sans ce garde-fou, le fichier
# serait remplacé par rien.
ecrire_fichier() {
    local fichier="$1" contenu
    contenu="$(cat)"
    [ -n "${contenu}" ] || ko "rien à écrire : ${fichier} laissé tel quel"
    printf '%s\n' "${contenu}" > "${fichier}"
}
