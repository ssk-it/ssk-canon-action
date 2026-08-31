---
id: 2026-001
titre: Socle du produit — référentiel, cadrages et persistance dans Git
statut: livree
domaines: [referentiel, cadrage, persistance, acces]
liens:
  - { tag: document, url: 'https://claude.ai/code/artifact/9fddf7eb-bf4c-4a07-8330-6eeb79026be6' }
impacts:
  - { regle: RG-referentiel-projection, operation: cree }
  - { regle: RG-rattachement-multiple, operation: cree }
  - { regle: RG-identifiants-stables, operation: cree }
  - { regle: RG-format-fichier, operation: cree }
  - { regle: RG-operations-impact, operation: cree }
  - { regle: RG-statuts-cadrage, operation: cree }
  - { regle: RG-branche-par-cadrage, operation: cree }
  - { regle: RG-propagation-livraison, operation: cree }
  - { regle: RG-identite-separee, operation: cree }
  - { regle: RG-liens-externes, operation: cree }
  - { regle: RG-decisions-options, operation: cree }
---

## Objectif

Poser le socle d'un outil de cadrage et de support durable de la spécification,
partagé entre le client et l'équipe de développement.

Le besoin vient d'un manque constaté : Trello porte l'expression succincte du
besoin, GitHub porte la réalisation, et rien entre les deux ne permet de
déterminer sur la durée le comportement précis attendu de chaque fonctionnalité.
Six mois après une livraison, la question « pourquoi cette règle est-elle ainsi ? »
n'a plus de réponse accessible.

Le parti pris fondateur : **le référentiel est la projection des cadrages
livrés**. Cette relation dirigée est ce qui distingue l'outil d'un wiki — un wiki
décrit l'état sans porter l'histoire des décisions, et il pourrit dès que
personne ne le met plus à jour.

## Parcours utilisateur

1. L'équipe définit les domaines fonctionnels du projet, puis les fonctionnalités
   de chaque domaine, avec leurs règles de gestion.
2. Une évolution se présente. Quelqu'un crée un cadrage, y attache les liens vers
   la carte Trello et les maquettes, et rédige l'objectif attendu.
3. Les points ouverts sont posés comme décisions, avec leurs options. Le client
   commente, arbitre, et l'option retenue est consignée avec son motif.
4. Le cadrage déclare ses impacts sur les règles de gestion existantes et porte
   les énoncés des règles nouvelles ou modifiées.
5. Le cadrage passe en relecture, est validé, puis livré. À la livraison, ses
   impacts sont appliqués au référentiel.
6. Plus tard, depuis n'importe quelle règle, on remonte au cadrage qui l'a créée
   et à la décision qui l'explique.

## Énoncés

### RG-referentiel-projection

Le référentiel est la **projection des cadrages livrés**. Il ne s'édite pas
directement.

Toute modification d'une règle de gestion résulte de la livraison d'un cadrage
déclarant un impact sur elle. Une modification apportée hors de ce chemin est une
anomalie, que la vérification d'intégrité doit signaler.

### RG-rattachement-multiple

Une fonctionnalité peut être rattachée à **plusieurs domaines**. Une règle de
gestion appartient à une fonctionnalité.

### RG-identifiants-stables

Chaque entité porte un identifiant **stable à vie**, lisible, qui ne change jamais
même si son intitulé ou son contenu est réécrit.

Les règles suivent le format `RG-<slug-kebab>`, les cadrages `<année>-<séquence
sur 3 chiffres>`. Les identifiants ne sont jamais réutilisés, y compris après
abrogation.

### RG-format-fichier

Chaque entité est un fichier Markdown composé d'un **frontmatter YAML** et d'un
**corps Markdown**.

Le partage entre les deux suit une règle unique : le frontmatter porte ce que la
machine interroge — identifiants, statuts, rattachements, impacts ; le corps porte
ce que l'humain lit — descriptions, objectifs, parcours, énoncés.

Un fichier sans frontmatter, ou dont le YAML est invalide, est une erreur
bloquante.

### RG-operations-impact

Un impact déclare l'une de **quatre opérations** sur une règle de gestion :

- `cree` — la règle n'existait pas ; le cadrage la crée avec son énoncé.
- `modifie` — la règle existe ; son énoncé est remplacé.
- `abroge` — la règle cesse de s'appliquer. Son fichier n'est pas supprimé : une
  règle abrogée reste consultable.
- `touche` — aucune écriture. Trace une dépendance : le cadrage concerne cette
  règle sans la changer. C'est le signal de relecture le plus utile.

Un cadrage ne peut déclarer qu'un seul impact par règle.

### RG-statuts-cadrage

Un cadrage passe par quatre statuts : **brouillon**, **en relecture**,
**validée**, **livrée**. L'historique des transitions est conservé.

### RG-branche-par-cadrage

Chaque cadrage est rédigé sur sa **propre branche**, nommée `cadrage/<id>`, et
livré par le merge de sa pull request.

Deux cadrages simultanés n'entrent donc jamais en conflit. Deux personnes éditant
le même cadrage produisent en revanche un conflit Git, que l'application doit
présenter intelligemment.

### RG-propagation-livraison

À la livraison d'un cadrage, ses impacts sont appliqués au référentiel
**automatiquement**.

### RG-identite-separee

L'**identité de la personne** et l'**accès technique au dépôt** sont portés par
deux mécanismes distincts.

L'utilisateur s'authentifie auprès du fournisseur d'identité de l'organisation et
n'a jamais connaissance de GitHub. L'accès au dépôt est porté par une application
installée sur celui-ci, avec ses droits propres, indépendants de tout utilisateur.

Cette séparation existe pour une raison précise : le client fait partie des
utilisateurs mais n'a pas de compte GitHub et n'en créera pas.

### RG-liens-externes

Un cadrage porte zéro, un ou plusieurs **liens vers des ressources externes**,
chacun associé à un tag typé : carte Trello, issue GitHub, maquette, document.

Les liens sont saisis manuellement. L'application ne va pas interroger les
services externes : aucun jeton tiers à gérer, aucune dépendance à leur
disponibilité.

### RG-decisions-options

Une décision porte une description, les **options envisagées**, et l'option
retenue ou l'annulation, chacune pouvant être commentée.

Les options écartées sont conservées avec leur motif. C'est ce qui distingue une
décision d'un simple choix : six mois plus tard, savoir ce qui a été envisagé et
pourquoi ça ne l'a pas emporté vaut souvent plus que la décision elle-même.

