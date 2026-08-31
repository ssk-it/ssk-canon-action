---
id: 01-parseur-partage
titre: Faut-il partager le parseur entre l'application et l'automatisation ?
statut: retenue
option_retenue: duplication-assumee
---

## Description

L'application lit le format dans un navigateur ; l'automatisation le lit sur la
plateforme, dans un autre environnement d'exécution. Deux implémentations du même
découpage, avec un risque de divergence : un format compris différemment des deux
côtés produirait des propagations incorrectes.

## Options

### paquet-partage

Extraire la lecture du format dans un paquet commun aux deux.

**Pour** — une seule implémentation, donc aucune divergence possible.
**Contre** — impose un outillage de monorepo, une étape de construction, et une
publication du paquet. Beaucoup de mécanique pour un format qui n'est pas encore
stabilisé et changera plusieurs fois.

### duplication-assumee

**Retenue.** Deux implémentations distinctes, tenues d'accord par un jeu de test
commun.

**Pour** — aucune mécanique à mettre en place maintenant. Chaque implémentation
reste idiomatique dans son environnement.
**Contre** — la divergence est possible et ne sera détectée que par les tests.

## Décision

**Duplication assumée, extraction plus tard.** La règle : on ajoute de la
mécanique quand elle se justifie, pas par anticipation.

Le dépôt d'exemple joue le rôle de garde-fou — il est lu par les deux
implémentations, et toute divergence s'y manifeste.

À réévaluer dès que le format se stabilise, c'est-à-dire vraisemblablement après
la première utilisation sur un projet réel.
