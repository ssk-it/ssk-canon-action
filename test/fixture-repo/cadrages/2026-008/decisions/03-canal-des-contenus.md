---
id: 03-canal-des-contenus
titre: Une fois connecté, faut-il changer de canal pour les contenus ?
statut: retenue
option_retenue: option-desactivee-par-defaut
---

## Description

Le canal ordinaire des contenus n'est pas décompté de la limite d'appels, mais il
sert ses réponses avec une durée de fraîcheur de cinq minutes : juste après une
livraison, il rend l'ancienne version, fichier par fichier.

Une fois connecté, le canal de l'arborescence devient utilisable pour les
contenus. Il est immédiat, mais coûte un appel par fichier au lieu d'un par
chargement.

## Options

### garder-le-canal-ordinaire

Ne rien changer une fois connecté.

**Pour** — le chargement reste au coût minimal.
**Contre** — le délai après livraison subsiste, et les dépôts privés restent
inaccessibles alors que la connexion devrait précisément les ouvrir.

### basculer-systematiquement

Passer au canal direct dès qu'un secret est présent.

**Pour** — affichage toujours à jour, dépôts privés couverts, un seul chemin de
code actif.
**Contre** — multiplie par soixante-quinze le nombre d'appels d'un chargement,
sur un référentiel de cette taille. Rend le coût de chaque rechargement
proportionnel au dépôt, pour un besoin de fraîcheur qui ne se manifeste qu'après
une livraison.

### option-desactivee-par-defaut

**Retenue.** Le canal direct est proposé comme option, désactivée par défaut.

**Pour** — le coût minimal reste la norme, et la fraîcheur immédiate est
disponible quand elle sert. L'option devient obligatoire pour les dépôts privés,
qui l'activeront d'eux-mêmes.
**Contre** — un réglage de plus, qu'il faut expliquer.

## Décision

**Option désactivée par défaut.**

Le besoin de fraîcheur est réel mais épisodique : il surgit juste après une
livraison, quand on veut vérifier son travail. Le rendre permanent ferait payer à
chaque consultation le prix d'un cas rare.

L'explication accompagnant l'option dit ce qu'elle change en termes d'usage —
« affiche immédiatement ce qui vient d'être poussé » — et non en termes
techniques.
