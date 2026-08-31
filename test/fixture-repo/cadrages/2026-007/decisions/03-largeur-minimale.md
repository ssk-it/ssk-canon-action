---
id: 03-largeur-minimale
titre: Que devient le sommaire sur un écran étroit ?
statut: retenue
option_retenue: effacer-sous-un-seuil
---

## Description

Le sommaire occupe une colonne. Sur un écran étroit, cette colonne se prend sur
la zone de lecture.

## Options

### toujours-visible

Conserver le sommaire quelle que soit la largeur.

**Pour** — comportement uniforme, rien à expliquer.
**Contre** — comprime le texte que le sommaire est censé aider à parcourir. Sur
un écran étroit, la fiche devient illisible pour préserver un outil de
navigation devenu inutile.

### replier-en-menu

Remplacer le sommaire par un bouton ouvrant un panneau.

**Pour** — la navigation reste accessible partout.
**Contre** — un élément d'interface de plus, un état à gérer, et un geste
supplémentaire pour un besoin qui se pose surtout sur grand écran, là où les
fiches longues se lisent vraiment.

### effacer-sous-un-seuil

**Retenue.** Le sommaire disparaît en dessous d'une largeur donnée ; la fiche
occupe alors toute la place.

**Pour** — la lecture reste prioritaire, ce qui est l'objet même de la fiche.
Aucun mécanisme supplémentaire.
**Contre** — pas de navigation rapide sur écran étroit.

## Décision

**Effacer sous un seuil.**

Le repli en menu reste possible si l'usage sur écran étroit se révèle
fréquent — ce qui n'est pas le cas aujourd'hui, la rédaction et la relecture se
faisant sur poste de travail. Ne pas construire un mécanisme pour un besoin
supposé.
