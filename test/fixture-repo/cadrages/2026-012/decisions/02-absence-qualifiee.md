---
id: 02-absence-qualifiee
titre: Que dire d'une entrée sans trace dans le dépôt ?
statut: retenue
option_retenue: nommer-la-raison-etablie
---

## Description

La superposition laisse des entrées sans données du dépôt. Reste à décider ce
que le lecteur voit à leur place.

La première réalisation affichait « antérieur au dépôt » sur toutes. Une
vérification à l'écran a montré que c'était **faux** dans un cas sur deux : un
cadrage livré, postérieur au dépôt, dont l'impact déclaré était `touche` — une
opération qui par définition ne modifie aucun fichier.

Le défaut n'était visible qu'à l'affichage. Aucun test ne le signalait : la
donnée manquait bien, seule son explication était fausse.

## Options

### ne-rien-afficher

Laisser l'entrée sans mention.

**Pour** — aucune affirmation, donc aucune affirmation fausse.
**Contre** — le lecteur voit des entrées inégalement renseignées sans savoir
pourquoi, et suppose une défaillance. Le silence n'est pas neutre.

### une-mention-unique

Un libellé unique et vague — « sans date » — couvrant tous les cas.

**Pour** — jamais faux, et simple à écrire.
**Contre** — n'apprend rien. La distinction entre « pas encore livré » et
« décision antérieure au dépôt » importe au lecteur : la première annonce un
changement à venir, la seconde une histoire close.

### nommer-la-raison-etablie

**Retenue.** Distinguer les trois situations, chacune déductible de ce qui est
connu : le statut du cadrage, et l'opération déclarée par l'impact.

**Pour** — chaque mention est vérifiable à partir de données présentes ; aucune
n'est une supposition.
**Contre** — trois libellés à maintenir, et le risque d'en ajouter un quatrième
sans y penser si une situation nouvelle apparaît.

## Décision

**Nommer la raison, et seulement lorsqu'elle est établie.**

Trois causes distinctes produisaient le même affichage. En choisir une revenait
à affirmer ce qu'on ignorait, et une affirmation fausse coûte plus cher qu'une
information absente : le lecteur qui prend le référentiel en défaut cesse de s'y
fier, y compris là où il a raison.

Enseignement, transposable : **un libellé qui explique doit être déduit, pas
choisi par défaut.** Le cas par défaut est celui qu'on n'a pas examiné.

Second enseignement, sur la méthode : le défaut n'était visible qu'à l'écran.
Une donnée manquante se teste ; une explication fausse à propos d'une donnée
manquante ne se teste que si l'on a pensé au cas.
