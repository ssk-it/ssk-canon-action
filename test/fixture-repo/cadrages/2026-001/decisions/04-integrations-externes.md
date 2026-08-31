---
id: 04-integrations-externes
titre: Faut-il lire ou écrire dans Trello et GitHub ?
statut: retenue
option_retenue: liens-seuls
---

## Description

Un cadrage référence des cartes Trello et des issues GitHub. Faut-il se contenter
de les lier, ou aller chercher leur contenu ?

## Options

### liens-seuls

**Retenue.** URL et tag, saisis à la main.

**Pour** — aucune API externe, aucun secret à gérer, aucune dépendance à la
disponibilité d'un service tiers. Zéro friction pour démarrer.
**Contre** — le lecteur doit ouvrir le lien pour savoir de quoi il s'agit.

### enrichissement-lecture

Aller chercher le titre et le statut de la carte ou de l'issue pour les afficher.

**Pour** — plus agréable à lire, le contexte est immédiat.
**Contre** — nécessite des jetons pour chaque service, une gestion d'erreur réseau,
et un cache. Beaucoup de complexité pour du confort.

### synchronisation-bidirectionnelle

Créer et mettre à jour des issues GitHub depuis un cadrage.

**Pour** — un seul endroit où travailler.
**Contre** — complexité considérable, et risque de désynchronisation permanent.
Écartée sans hésitation pour un prototype.

## Décision

**Liens seuls.** L'enrichissement en lecture reste une évolution naturelle si le
besoin se confirme à l'usage — mais il ne conditionne pas la valeur du produit.
