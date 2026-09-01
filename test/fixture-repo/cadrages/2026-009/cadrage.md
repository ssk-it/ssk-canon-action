---
id: 2026-009
titre: Repères temporels et ordre de la liste des cadrages
domaines: [cadrage, persistance]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-ordre-liste-cadrages, operation: cree }
  - { regle: RG-date-creation-cadrage, operation: cree }
  - { regle: RG-ordre-chronologie-regle, operation: cree }
  - { regle: RG-histoire-derivee, operation: touche }
  - { regle: RG-identifiants-stables, operation: touche }
  - { regle: RG-chargement-hors-quota, operation: touche }
---

## Objectif

Rendre la liste des cadrages exploitable quand elle s'allonge.

Deux manques se sont révélés à l'usage. L'ordre ne reflétait pas la façon dont on
lit cette liste : on y cherche d'abord ce qui reste à faire, or les cadrages
livrés occupaient le haut. Et rien n'indiquait quand un cadrage avait été ouvert,
ce qui rendait difficile de situer un travail ancien parmi les autres.

Une demande a été écartée en cours de route — afficher la date du dernier
changement de statut — et le motif est consigné, pour que la question ne se
repose pas à l'aveugle.

## Parcours utilisateur

1. Le lecteur ouvre la liste des cadrages. Les brouillons apparaissent en tête,
   puis ceux en relecture, puis les validés, enfin les livrés.
2. À l'intérieur de chaque groupe, le plus récent vient en premier.
3. La liste s'affiche immédiatement ; les dates de création la rejoignent peu
   après, sans qu'il ait à attendre.
4. Survoler une date en donne le jour et l'heure exacts.
5. S'il ouvre ensuite une règle de gestion, il retrouve sa chronologie dans
   l'ordre inverse : le cadrage le plus récent en tête, pour remonter depuis
   l'état actuel.

## Énoncés

### RG-ordre-liste-cadrages

Les cadrages sont présentés dans **l'ordre du cycle de vie** : brouillon, en
relecture, validée, livrée. À statut égal, le plus récent vient en premier.

Ce qui demande de l'attention passe devant ce qui fait déjà référence. Un
brouillon oublié en bas de liste est un brouillon qui le reste.

L'ordre à statut égal s'appuie sur l'identifiant, qui porte l'année et la
séquence : il donne l'ordre chronologique sans qu'aucune date ne soit nécessaire,
et reste stable là où un titre se reformule.

### RG-date-creation-cadrage

La **date de création** d'un cadrage est présentée dans la liste.

Elle n'est pas stockée dans les fichiers : elle se déduit du premier changement
enregistré sur le cadrage. Le stocker créerait une seconde source de vérité, qui
divergerait — voir la règle sur l'histoire dérivée.

Elle est obtenue **à la demande**, une fois la liste affichée, et non au
chargement du référentiel. La liste apparaît immédiatement ; les dates la
rejoignent. Une date indisponible n'empêche jamais la lecture.

### RG-ordre-chronologie-regle

La chronologie d'une règle suit **l'ordre inverse du cycle de vie** : les
cadrages livrés d'abord, du plus récent au plus ancien.

L'ordre s'oppose délibérément à celui de la liste des cadrages, parce que la
question posée diffère. Devant une liste, on cherche ce qui reste à faire ;
devant une règle, on part de son état actuel pour remonter vers son origine.

Deux ordres nommés distinctement valent mieux qu'un ordre unique qu'un écran
inverserait : le lecteur du code voit lequel s'applique, et modifier l'un
n'altère pas l'autre par accident.

