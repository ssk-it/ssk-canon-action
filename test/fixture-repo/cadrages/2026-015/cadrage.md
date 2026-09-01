---
id: 2026-015
titre: Reprendre un cadrage ouvert
domaines: [cadrage, persistance]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-reprise-cadrage, operation: cree }
  - { regle: RG-cadrages-ouverts-visibles, operation: cree }
  - { regle: RG-impacts-controles, operation: cree }
  - { regle: RG-ouverture-cadrage, operation: touche }
  - { regle: RG-branche-par-cadrage, operation: touche }
  - { regle: RG-enonces-dans-cadrage, operation: touche }
---

## Objectif

Boucler le cycle de rédaction : un cadrage qu'on ouvre doit pouvoir être repris.

L'ouverture seule laissait le rédacteur devant un cadrage figé. Il n'y avait ni
moyen de le retrouver — il vit sur sa branche, absent du référentiel — ni moyen
d'y déclarer ce qu'il change. Or c'est précisément entre l'ouverture et la
livraison que le travail se fait.

La réalisation a mis au jour un défaut que la relecture n'aurait pas trouvé :
l'application acceptait de déclarer un impact sur une règle inexistante, et la
vérification bloquait la demande de fusion — sur une cause pourtant connue au
moment de la saisie.

## Parcours utilisateur

1. Depuis la liste des cadrages, le rédacteur voit ceux ouverts, présentés à part
   de ceux qui sont déjà dans le référentiel.
2. Il rouvre l'un d'eux. L'application le charge depuis sa branche, où son
   travail se trouve.
3. Il reprend le titre, les domaines, l'objectif, le parcours.
4. Il déclare ce que le cadrage change : pour chaque règle touchée, l'opération
   et, lorsqu'elle l'exige, l'énoncé qui en résultera.
5. L'application signale ce qui empêcherait la livraison avant qu'il n'enregistre.
6. À l'enregistrement, le cadrage est réécrit sur sa branche.

## Énoncés

### RG-reprise-cadrage

Un cadrage se **reprend tant qu'il n'est pas livré**, depuis l'endroit où son
travail se trouve : sa propre branche.

La branche du cadrage fait autorité sur la branche principale, qui ne le connaît
pas encore. Un cadrage qui n'en a pas — rédigé hors de l'application, ou déjà
dans le référentiel — se reprend depuis la branche principale, et l'application
le signale plutôt que de laisser croire à un travail isolé qui n'existe pas.

Chaque écriture se fonde sur la version lue. Deux rédacteurs travaillant
simultanément sur le même cadrage produisent alors un conflit, plutôt qu'un
écrasement silencieux du travail de l'un par l'autre.

Un cadrage livré ne se reprend plus : ses impacts sont propagés, et le rouvrir
ferait diverger le référentiel des cadrages qui le produisent.

### RG-cadrages-ouverts-visibles

Les cadrages **ouverts mais pas encore livrés** sont visibles depuis
l'application, présentés à part de ceux que le référentiel contient.

Un cadrage en cours vit sur sa branche : il n'appartient pas encore au
référentiel, et n'apparaîtrait donc nulle part. Un rédacteur ne retrouverait pas
le cadrage qu'il vient d'ouvrir — l'outil lui ferait ouvrir des sujets qu'il perd
aussitôt.

La distinction est maintenue à l'affichage : mêler les deux populations laisserait
croire que le référentiel porte déjà ce qui n'est encore qu'en discussion.

### RG-impacts-controles

Ce qui empêcherait un cadrage de passer la vérification d'intégrité est
**signalé à la saisie**, et non découvert à la livraison.

Sont contrôlés : qu'une règle est bien désignée, qu'elle n'est pas visée deux
fois, qu'un impact `crée` ou `modifie` porte l'énoncé sans lequel la propagation
n'aurait rien à écrire, et que la règle visée existe — sauf pour `crée`, dont
c'est l'objet même de la faire naître.

Le motif est de délai, pas de rigueur : la vérification finira par attraper ces
défauts, mais bien plus tard, quand le rédacteur aura quitté le sujet et devra
rouvrir un cadrage qu'il croyait terminé. Une cause connue au moment de la
saisie doit être dite au moment de la saisie.
