---
id: 01-support-persistance
titre: Où vit le contenu ?
statut: retenue
option_retenue: git-markdown
---

## Description

Le choix du support conditionne tout le reste : ce qu'on obtient gratuitement, ce
qu'il faut construire, et ce qui survit à l'outil.

## Options

### base-de-donnees

Une base relationnelle derrière une API, hébergée avec l'application.

**Pour** — requêtes transverses instantanées, écritures concurrentes gérées par
des transactions, modèle relationnel naturel.
**Contre** — impose un backend et une base à exploiter. L'historique,
l'attribution et la revue sont à construire entièrement. Et le contenu meurt avec
l'outil : si le produit est abandonné, la spécification est perdue.

### git-markdown

**Retenue.** Un dépôt Git par projet, des fichiers Markdown à frontmatter YAML,
lus et écrits via l'API de la plateforme.

**Pour** — l'historique, l'attribution des modifications, la relecture par pull
request et la lecture hors de l'application sont acquis sans une ligne de code.
Le support survit à l'outil : les fichiers restent lisibles sur github.com même
si l'application disparaît.
**Contre** — pas de requête transverse instantanée, il faut charger et indexer
côté client. Les écritures concurrentes se règlent par conflit Git, pas par
transaction.

### fichiers-plus-base

Les fichiers dans Git, plus une base d'index pour les requêtes.

**Pour** — le meilleur des deux.
**Contre** — deux sources de vérité à garder cohérentes, ce qui est précisément le
problème qu'on cherche à éviter. Écartée : l'index doit être reconstructible, pas
maintenu.

## Décision

**Git et Markdown.** Ce que l'on obtient gratuitement — historique, attribution,
revue, survie du contenu — vaut largement le coût d'un index à construire côté
client.

Le raisonnement décisif : ce produit promet un support *durable* de la
spécification. Un support durable ne peut pas dépendre de la survie de l'outil qui
le lit.
