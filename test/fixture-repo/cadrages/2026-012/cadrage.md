---
id: 2026-012
titre: Chronologie d'une règle, adossée à l'histoire Git
statut: livree
domaines: [referentiel, persistance, acces]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-chronologie-superposee, operation: cree }
  - { regle: RG-absence-commit-qualifiee, operation: cree }
  - { regle: RG-historique-authentifie, operation: cree }
  - { regle: RG-chronologie-regle, operation: modifie }
  - { regle: RG-connexion-optionnelle, operation: modifie }
  - { regle: RG-ordre-chronologie-regle, operation: touche }
  - { regle: RG-histoire-derivee, operation: touche }
  - { regle: RG-message-nomme-la-cause, operation: touche }
---

## Objectif

Donner à la chronologie d'une règle ce que les fichiers seuls ne portent pas :
la date réelle d'un changement, son auteur, et la pull request qui l'a introduit.

La liste des cadrages ayant touché une règle existait déjà. Elle répond à
« quelles décisions ont façonné cette règle ? », mais pas à « quand, et par
qui ? » — or c'est la seconde question qui distingue un référentiel d'un
document.

La réalisation a mis au jour un fait que la description initiale ne pouvait pas
prévoir : **l'histoire Git est parfois plus pauvre que l'histoire métier**. Un
référentiel rédigé après coup porte des cadrages décrivant des décisions
antérieures au dépôt lui-même, auxquelles aucun commit ne correspond. Ce n'est
pas une anomalie à corriger mais une situation à représenter.

## Parcours utilisateur

1. Un lecteur ouvre une règle et lit son énoncé courant.
2. Sous l'énoncé, la chronologie liste les cadrages qui l'ont touchée, du plus
   récent au plus ancien.
3. Chaque entrée porte, quand l'histoire du dépôt le permet, la date du
   changement, son auteur et le lien vers la pull request.
4. Quand une entrée n'a pas de trace dans le dépôt, elle reste affichée et
   indique laquelle des raisons possibles s'applique.
5. Sans connexion, la chronologie reste lisible : seuls les repères temporels
   manquent, et l'application dit pourquoi et comment les obtenir.

## Énoncés

### RG-chronologie-superposee

La chronologie d'une règle **superpose deux sources** : les cadrages, qui
portent l'histoire des décisions, et l'histoire du dépôt, qui porte la date
réelle, l'auteur et la demande de fusion.

Aucune ne suffit seule. Les cadrages ignorent quand un changement a réellement
été appliqué et par qui. Le dépôt ignore pourquoi, et ne connaît que les
changements qui s'y sont produits.

Les cadrages fondent la chronologie ; le dépôt l'enrichit. Un cadrage sans trace
dans le dépôt reste affiché : l'inverse ferait disparaître une décision qui a
bien eu lieu.

L'appariement se fait sur l'identifiant de cadrage cité dans le changement
enregistré. Il est délibérément souple — le texte est rédigé par un humain, et
exiger une forme précise ferait perdre l'appariement au premier écart, alors
qu'une chronologie sans date reste utile.

### RG-absence-commit-qualifiee

Lorsqu'une entrée de chronologie n'a pas de trace dans le dépôt, l'application
**dit laquelle des raisons s'applique**, jamais une raison supposée.

Trois situations distinctes produisent la même absence : un cadrage non encore
livré, qui n'a donc rien modifié ; un impact déclaré `touche`, qui par
définition n'écrit pas ; et un cadrage livré antérieur au dépôt, dont la
décision précède l'existence du référentiel.

Les confondre ferait affirmer une cause qu'on ignore. Un lecteur qui voit
« antérieur au dépôt » sur un changement qui n'a simplement rien écrit conclut
que le référentiel se trompe — et un référentiel dont on doute ne sert plus.

### RG-historique-authentifie

La consultation de l'**historique** — dates, auteurs, demandes de fusion —
demande une connexion, y compris sur un dépôt public.

C'est une contrainte de la plateforme, non un choix : la voie d'accès qui rend
l'historique refuse toute requête anonyme, quelle que soit la visibilité du
dépôt.

L'application ne la subit pas en silence. Le reste de la vue demeure lisible
sans connexion, et l'absence des repères temporels est signalée avec sa cause et
la marche à suivre. Une fonctionnalité indisponible qui ne dit pas pourquoi
passe pour une panne.

### RG-chronologie-regle

Depuis une règle de gestion, l'application donne accès à sa **chronologie
complète** : chaque version de son énoncé, sa date, son auteur, et le cadrage
responsable du changement.

C'est la vue qui justifie l'existence du produit : la question « pourquoi cette
règle est-elle ainsi ? » devient une requête, et non une archéologie dans des
cartes Trello archivées.

L'énoncé d'une version passée n'est chargé qu'au moment où il est déplié.
Charger d'avance toutes les versions ferait payer à chaque visite un coût dont
le lecteur n'utilise presque jamais qu'une fraction.

### RG-connexion-optionnelle

La consultation d'un dépôt public **ne demande aucune connexion**.

Se connecter reste possible et relève trois limites : le nombre d'appels
autorisés par heure, l'accès aux dépôts privés, et — plus tard — l'écriture.

L'ordre est délibéré : un client qui reçoit un lien doit pouvoir lire
immédiatement. Exiger une authentification pour afficher un contenu public
placerait un obstacle à l'endroit exact où le produit doit être le plus
accueillant.

Une exception, imposée par la plateforme : l'historique n'est pas servi aux
requêtes anonymes. Les vues qui en dépendent restent accessibles et se
présentent incomplètes plutôt que closes.
