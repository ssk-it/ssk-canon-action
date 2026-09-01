---
id: 2026-013
titre: Ce qui a changé entre deux instants
domaines: [referentiel, persistance]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-comparaison-deux-etats, operation: cree }
  - { regle: RG-bornes-consultables, operation: cree }
  - { regle: RG-etat-reellement-existe, operation: cree }
  - { regle: RG-referentiel-a-une-date, operation: modifie }
  - { regle: RG-chargement-hors-quota, operation: touche }
  - { regle: RG-message-nomme-la-cause, operation: touche }
  - { regle: RG-histoire-derivee, operation: touche }
---

## Objectif

Répondre à la question que pose un client qui revient : **qu'a-t-on décidé
depuis la dernière fois ?**

Le référentiel dit ce qui est vrai aujourd'hui. La chronologie d'une règle dit
comment celle-ci en est arrivée là. Ni l'un ni l'autre ne dit ce qui a bougé
dans l'ensemble entre deux moments — or c'est la question posée à chaque reprise
de contact, et celle à laquelle un dossier de spécification ordinaire ne répond
jamais sans relecture intégrale.

La reconstitution du référentiel à une date passée, déjà énoncée, en est la
brique. Elle n'est pas exposée seule : consulter un état ancien demande de se
souvenir de l'état courant pour repérer l'écart, ce que la comparaison fait à la
place du lecteur.

## Parcours utilisateur

1. Le lecteur choisit deux instants. Le premier ne peut précéder le plus ancien
   enregistrement du dépôt : avant lui, il n'y a rien à reconstituer.
2. L'application reconstitue l'état du référentiel à chacun des deux instants.
3. Elle annonce les instants réellement retenus, qui peuvent précéder ceux
   demandés : un état n'existe qu'aux moments où il a été enregistré.
4. Elle liste les cadrages livrés dans l'intervalle — ce sont eux qui expliquent
   les écarts.
5. Elle liste les règles ajoutées, modifiées ou abrogées, groupées par nature,
   ce qui change du comportement existant en premier.
6. Pour une règle modifiée, les deux énoncés se lisent côte à côte.

## Énoncés

### RG-comparaison-deux-etats

L'application montre **ce qui a changé dans le référentiel entre deux instants** :
les règles ajoutées, modifiées ou abrogées, et les cadrages livrés qui
l'expliquent.

Une règle inchangée ne figure pas dans le résultat. La vue répond à « qu'a-t-on
décidé depuis ? » et non à « qu'existe-t-il ? » — lister l'immobile noierait ce
qui a bougé, qui est précisément ce qu'on est venu chercher.

Les écarts sont groupés par nature, ce qui retire ou change du comportement
existant d'abord. Une règle nouvelle ne contredit rien de ce que le lecteur
croyait savoir ; une règle modifiée, si.

Le rapprochement avec les cadrages livrés dans l'intervalle est ce qui distingue
cette vue d'une comparaison de fichiers : sans lui, elle montrerait que le
référentiel a changé sans dire pourquoi, c'est-à-dire exactement le vide que le
produit prétend combler.

### RG-bornes-consultables

Une consultation datée ne peut pas remonter avant le **plus ancien
enregistrement du dépôt**, et la saisie l'en empêche plutôt que de la refuser
après coup.

La date de création du dépôt ne convient pas comme borne : un dépôt peut rester
vide un moment après sa création, et l'écart mesuré sur le référentiel de
référence dépasse deux heures. Ce qui borne la consultation, c'est l'existence
d'un contenu à reconstituer, pas celle du dépôt.

Les instants se choisissent à la minute et non au jour. Un dépôt jeune, ou une
semaine où plusieurs cadrages sont livrés, tient entièrement dans une journée :
une granularité au jour n'y montrerait rien.

### RG-etat-reellement-existe

Lorsqu'un état est reconstitué à un instant demandé, l'application affiche
**l'instant réellement retenu**, qui est celui du dernier enregistrement
antérieur.

Un référentiel n'existe qu'aux moments où il a été enregistré. Afficher
l'instant demandé prétendrait un état à un moment où personne ne l'a produit —
et l'écart entre les deux peut atteindre des semaines sur une borne ancienne.

C'est une application du principe qui gouverne l'histoire : elle se dérive et ne
s'invente pas. Une date affichée doit correspondre à quelque chose qui a eu
lieu.

### RG-referentiel-a-une-date

Le référentiel est reconstituable **tel qu'il était à un instant passé**.

La reconstitution s'appuie sur le dernier enregistrement antérieur à l'instant,
puis sur l'arborescence complète à cet enregistrement. Elle ne coûte que deux
appels décomptés, quelle que soit la taille du référentiel : les contenus sont
servis par le canal non décompté, y compris adressés par un enregistrement
passé.

Cette reconstitution ne se consulte pas seule. Elle sert de fondement à la
comparaison entre deux instants, qui répond à la question réellement posée :
consulter un état ancien obligerait le lecteur à se souvenir de l'état courant
pour en repérer l'écart.
