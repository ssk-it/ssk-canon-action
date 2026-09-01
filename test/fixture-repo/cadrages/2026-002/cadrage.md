---
id: 2026-002
titre: Révision sur faits vérifiés — historique, chemins immuables et pièces jointes
domaines: [referentiel, persistance, acces, cadrage]
liens:
  - { tag: document, url: 'https://claude.ai/code/artifact/9fddf7eb-bf4c-4a07-8330-6eeb79026be6' }
impacts:
  - { regle: RG-chemins-immuables, operation: cree }
  - { regle: RG-histoire-derivee, operation: cree }
  - { regle: RG-enonces-dans-cadrage, operation: cree }
  - { regle: RG-verification-integrite, operation: cree }
  - { regle: RG-pj-adressage-contenu, operation: cree }
  - { regle: RG-pj-ordre-upload, operation: cree }
  - { regle: RG-autorisation-point-unique, operation: cree }
  - { regle: RG-auteur-reel-commit, operation: cree }
  - { regle: RG-regulation-appels, operation: cree }
  - { regle: RG-index-recherche-client, operation: cree }
  - { regle: RG-referentiel-a-une-date, operation: cree }
  - { regle: RG-chronologie-regle, operation: cree }
  - { regle: RG-rattachement-multiple, operation: modifie }
  - { regle: RG-statuts-cadrage, operation: modifie }
  - { regle: RG-propagation-livraison, operation: modifie }
  - { regle: RG-referentiel-projection, operation: touche }
  - { regle: RG-branche-par-cadrage, operation: touche }
---

## Objectif

Le socle posé par 2026-001 reposait sur des hypothèses non vérifiées quant aux
capacités réelles de la plateforme. Leur vérification en invalide certaines et en
ouvre d'autres.

Trois révisions, par ordre d'importance.

**Le référentiel a une histoire.** Le socle affirmait qu'il « n'a pas d'histoire
propre ». C'est faux : puisque chaque cadrage vit sur sa branche et se livre par
un merge daté, chaque règle a une chronologie complète, gratuitement. Ce que le
référentiel n'a pas, c'est une histoire *à maintenir dans les fichiers*. La
correction ouvre trois vues nouvelles.

**Aucune API ne suit les renommages.** Un fichier déplacé perd tout son historique
visible depuis l'application. L'arborescence envisagée rangeait les règles sous
leur fonctionnalité : renommer une fonctionnalité aurait effacé l'historique de
toutes ses règles — exactement ce que le produit promet de préserver.

**Les pièces jointes ne peuvent pas vivre dans Git.** Ni en binaire versionné, ni
via le mécanisme de gros fichiers de la plateforme, dont l'espace s'avère
irrécupérable sans détruire le dépôt.

## Parcours utilisateur

1. Depuis une règle de gestion, le lecteur accède à sa chronologie : chaque
   version de son énoncé, avec sa date, son auteur et le cadrage responsable.
2. Il peut aussi demander le référentiel tel qu'il était à une date passée, pour
   répondre à « comment ça marchait en mars ? ».
3. En relecture d'un cadrage, il voit le diff fonctionnel : non pas ce qui est
   proposé, mais ce qui change par rapport à l'état courant.
4. À l'ouverture d'une pull request, une vérification d'intégrité s'exécute. Une
   erreur empêche le merge, et l'auteur la corrige pendant sa rédaction plutôt que
   de la découvrir après coup.
5. Lorsqu'il joint une maquette, celle-ci est téléversée avant que le cadrage ne
   soit enregistré, et identifiée par le hash de son contenu.

## Énoncés

### RG-chemins-immuables

Le chemin d'un fichier ne change **jamais** après sa création.

Les règles vivent à plat dans `rules/`, les fonctionnalités à plat dans
`features/`, et un dossier de cadrage porte l'identifiant seul, sans slug de
titre.

Cette contrainte découle d'une limite de la plateforme : aucune API GitHub ne suit
les renommages. Un fichier déplacé perdrait tout son historique visible depuis
l'application, ce qui contredirait la promesse du produit. La vérification
d'intégrité doit signaler la disparition d'un identifiant.

### RG-histoire-derivee

L'histoire du référentiel n'est **jamais stockée dans les fichiers**. Elle est
dérivée de l'historique Git et des événements de pull request.

Aucun champ `historique:` ne doit exister dans un frontmatter. Les champs
`cree_par` et `modifie_par` sont un index de performance, écrit par la propagation
automatique et jamais à la main : ils évitent de parcourir tout l'historique pour
afficher une fiche, mais la source de vérité reste le log Git.

### RG-enonces-dans-cadrage

Un impact de type `cree` ou `modifie` doit être accompagné du **nouvel énoncé** de
la règle, rédigé dans une section `## Énoncés` du cadrage, sous un titre de niveau
3 portant l'identifiant de la règle.

Sans cet énoncé, la propagation n'a rien à écrire : l'absence est une erreur
bloquante.

Un énoncé porte le texte **au moment de la livraison du cadrage**, pas l'état
courant de la règle. Un cadrage ancien peut donc énoncer un comportement depuis
modifié : c'est correct, et l'application doit le rendre lisible pour éviter qu'un
lecteur n'y voie une incohérence.

### RG-verification-integrite

Une vérification d'intégrité s'exécute à l'ouverture et à chaque modification
d'une pull request. Une erreur **empêche le merge**.

Elle contrôle ce que le format seul ne peut pas garantir : un impact référençant
une règle inexistante, un identifiant dupliqué, un énoncé manquant pour un impact
`cree` ou `modifie`, une règle abrogée par un cadrage non livré, un rattachement
vers une entité inconnue.

Une règle créée par un cadrage encore en relecture n'existe pas dans le
référentiel : c'est normal, et la vérification ne l'exige qu'à la livraison.

### RG-pj-adressage-contenu

Une pièce jointe est stockée sous le **hash SHA-256 de son contenu**, à la clé
`sha256/{ab}/{cd}/{hash}`. Le fichier versionné dans Git ne porte que ce hash, sa
taille, son nom d'origine et son type.

Un objet stocké n'est jamais modifié : une nouvelle version est un nouvel objet à
une nouvelle adresse, et c'est le pointeur versionné qui change.

Deux conséquences recherchées : revenir à un commit ancien retrouve les pièces
jointes de l'époque sans mécanisme de synchronisation ; et deux cadrages joignant
le même fichier n'occupent qu'un seul objet.

### RG-pj-ordre-upload

Une pièce jointe est **téléversée avant** que le fichier Markdown qui la référence
ne soit commité.

L'ordre inverse produirait un pointeur désignant un objet absent.

### RG-autorisation-point-unique

Les autorisations s'appliquent en **un seul point** : le composant qui relaie les
appels vers le dépôt.

L'application installée sur le dépôt ayant les mêmes droits quel que soit
l'utilisateur, un relais qui se contenterait de transmettre laisserait tout
porteur d'une identité valide écrire dans n'importe quel projet. Le relais
restreint donc les dépôts et les chemins accessibles selon l'identité appelante.

### RG-auteur-reel-commit

Tout commit écrit au nom d'un utilisateur porte **son identité réelle** comme
auteur, renseignée depuis son jeton d'identité.

Sans cela, tous les commits apparaîtraient signés par l'application installée sur
le dépôt, et la traçabilité — qui est la raison d'être du produit — disparaîtrait.

### RG-regulation-appels

Les appels à l'API sont régulés **côté client**, par une file d'attente à
concurrence bornée.

Les limites secondaires de la plateforme s'appliquent au jeton d'accès, donc à
l'installation entière : tous les utilisateurs partagent le même budget. Le relais
étant sans état, il ne peut pas réguler.

### RG-index-recherche-client

La recherche s'appuie sur un **index construit côté client**, alimenté par
l'arborescence du dépôt et les contenus chargés, mis en cache et invalidé par le
SHA de chaque fichier.

L'API de recherche de la plateforme n'est pas utilisable : elle est limitée à dix
requêtes par minute, n'indexe que la branche par défaut — donc aucun cadrage en
cours de rédaction —, ne permet aucune recherche historique et n'offre aucune
garantie de fraîcheur.

### RG-referentiel-a-une-date

Le référentiel est consultable **tel qu'il était à une date passée**.

La reconstitution s'appuie sur le dernier commit antérieur à la date, puis sur
l'arborescence complète à ce commit. Elle ne coûte que deux appels, quelle que
soit la taille du référentiel.

### RG-chronologie-regle

Depuis une règle de gestion, l'application donne accès à sa **chronologie
complète** : chaque version de son énoncé, sa date, son auteur, et le cadrage
responsable du changement.

C'est la vue qui justifie l'existence du produit : la question « pourquoi cette
règle est-elle ainsi ? » devient une requête, et non une archéologie dans des
cartes Trello archivées.

### RG-rattachement-multiple

Une fonctionnalité peut être rattachée à **plusieurs domaines**. Une règle de
gestion peut être rattachée à **plusieurs fonctionnalités**.

Ces rattachements sont exprimés en frontmatter, donc modifiables sans déplacer le
fichier. Une fonctionnalité sans domaine, ou une règle sans fonctionnalité, est
tolérée mais signalée : c'est souvent le signe d'un oubli.

### RG-statuts-cadrage

Un cadrage passe par quatre statuts : **brouillon**, **en relecture**,
**validée**, **livrée**.

Chaque statut correspond à un état observable de la pull request associée :
branche créée, PR ouverte, PR approuvée, PR mergée. L'application lit l'état réel
de la PR au lieu de maintenir un statut en parallèle, ce qui rend la
désynchronisation impossible.

L'historique des transitions est dérivé des événements de la pull request, chacun
daté et attribué.

### RG-propagation-livraison

À la livraison d'un cadrage, ses impacts sont appliqués au référentiel
**automatiquement**, dans un commit distinct de celui du merge.

La séparation est délibérée : le merge porte l'intention rédigée par un humain, le
commit suivant porte l'écriture faite par la machine. Les distinguer rend
l'historique lisible et permet de rejouer une propagation sans toucher au cadrage.

