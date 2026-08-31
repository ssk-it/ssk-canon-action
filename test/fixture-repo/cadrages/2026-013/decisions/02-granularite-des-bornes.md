---
id: 02-granularite-des-bornes
titre: À quelle finesse choisir les instants comparés ?
statut: retenue
option_retenue: a-la-minute
---

## Description

Les bornes ont d'abord été saisies au jour. La première vérification sur le
référentiel de référence n'a rien montré : tout son historique tient entre le
milieu de l'après-midi et le début de soirée d'une même journée.

Le défaut n'est pas propre au jeu de test. Une équipe qui livre plusieurs
cadrages dans la même semaine se heurterait au même mur : comparer deux jours
consécutifs ne dirait rien de ce qui s'est passé entre eux.

## Options

### au-jour

Choisir une date, sans heure.

**Pour** — saisie simple, et suffisante pour un référentiel qui évolue
lentement.
**Contre** — aveugle sur toute activité intra-journalière, c'est-à-dire sur les
périodes les plus denses, qui sont justement celles qu'on veut examiner.

### a-la-minute

**Retenue.** Choisir un instant, date et heure.

**Pour** — permet de cadrer n'importe quel intervalle, y compris quelques
heures.
**Contre** — saisie un peu plus lourde, et une borne à la minute ne peut pas
désigner exactement un enregistrement daté à la seconde.

## Décision

**À la minute.**

La lourdeur est faible et la valeur d'usage nette. Le second inconvénient a
produit un défaut réel : la borne basse, tronquée à la minute, tombait juste
avant le premier enregistrement du dépôt et la comparaison à cette borne ne
trouvait rien. Corrigé en arrondissant vers le haut.

C'est le genre de détail qu'aucun raisonnement ne fait apparaître : il se
découvre en essayant la valeur extrême, ici la borne la plus basse acceptée.
