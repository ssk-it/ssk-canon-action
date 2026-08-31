---
id: 04-choix-du-depot
titre: Comment l'application sait-elle quel dépôt lire ?
statut: retenue
option_retenue: saisi-et-memorise
---

## Description

L'application dessert plusieurs projets, chacun ayant son dépôt. Il faut décider
où vit cette information.

## Options

### fige-a-la-construction

Le dépôt est une constante de configuration, fixée au déploiement.

**Pour** — rien à saisir, aucun état à gérer.
**Contre** — une instance par projet, donc autant de déploiements que de projets.
Et changer de dépôt pour un essai impose une reconstruction.

### saisi-a-chaque-visite

L'utilisateur indique le dépôt à chaque ouverture.

**Pour** — aucun état conservé.
**Contre** — friction inutile à chaque visite, pour une information qui change
rarement.

### saisi-et-memorise

**Retenue.** Saisi par l'utilisateur, mémorisé par le navigateur, avec une valeur
par défaut à la première visite.

**Pour** — une instance dessert plusieurs projets, sans redéploiement. La saisie
accepte un nom court comme une URL complète, ce qui évite de réfléchir au format.
**Contre** — un état local à gérer, et une dégradation à prévoir quand le
stockage est indisponible.

## Décision

**Saisi et mémorisé.**

La mémorisation doit tolérer son propre échec : en navigation privée ou avec le
stockage bloqué, l'application retient le choix en mémoire pour la session plutôt
que d'échouer.

Quand l'authentification sera en place, le choix sera restreint aux dépôts sur
lesquels l'utilisateur a des droits — ce qui ne remet pas en cause le principe.
