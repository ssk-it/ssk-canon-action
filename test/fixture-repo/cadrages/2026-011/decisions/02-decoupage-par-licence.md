---
id: 02-decoupage-par-licence
titre: Selon quel critère découper ce qui est ouvert de ce qui ne l'est pas ?
statut: retenue
option_retenue: par-lieu-d-execution
---

## Description

Extraire l'automatisation obligeait à trancher une question restée implicite :
le produit a plusieurs composants, lesquels sont ouverts ?

Le réflexe est de découper par technique — ce qui est simple s'ouvre, ce qui est
complexe se ferme. Il conduit à des frontières arbitraires, qu'il faut
renégocier à chaque nouveau composant.

## Options

### par-complexite

Ouvrir ce qui est peu coûteux à reproduire, fermer le reste.

**Pour** — protège ce qui a demandé du travail.
**Contre** — critère glissant : la complexité d'un composant change avec le
temps. Et il n'explique rien à l'utilisateur, qui ne sait pas pourquoi telle
partie lui est accessible et telle autre non.

### tout-fermer

Ne rien publier, distribuer sous licence commerciale.

**Pour** — un seul régime, aucune question à trancher.
**Contre** — contredit la promesse du produit. Une spécification qui reste
lisible et exploitable même sans l'outil suppose que la mécanique qui la
maintient soit inspectable. Et cela rend le montage impossible pour un client
d'une autre organisation.

### par-lieu-d-execution

**Retenue.** Est ouvert ce qui s'exécute chez l'utilisateur ; reste fermé ce qui
s'exécute chez l'éditeur.

**Pour** — critère stable, qui ne dépend d'aucune appréciation ; il se réapplique
seul à tout composant futur. Il coïncide avec la valeur réellement défendable :
ce qui tourne chez l'éditeur ne peut pas être emporté.
**Contre** — impose de publier des composants qu'on aurait pu garder par réflexe,
sans que ce soit un vrai coût.

## Décision

**Découper selon le lieu d'exécution.**

L'automatisation tourne dans l'intégration continue du client : elle est ouverte.
L'application et le pont d'accès tournent chez l'éditeur : ils restent fermés.
Le référentiel appartient au client, dans son dépôt, en clair.

Ce critère a un effet secondaire utile : il rend la frontière explicable en une
phrase, à un client comme à un contributeur. Un découpage qu'on ne sait pas
justifier simplement est un découpage qu'on renégociera.

L'absence de mention de licence est un piège discret : sans elle, tout est fermé
par défaut, y compris ce qu'on croyait avoir ouvert. Les fichiers de licence
doivent exister avant le premier utilisateur, pas après.
