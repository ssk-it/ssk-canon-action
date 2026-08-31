---
id: 02-stockage-pieces-jointes
titre: Où vivent les pièces jointes ?
statut: retenue
option_retenue: stockage-objet-hash
---

## Description

Un cadrage porte des maquettes, des captures, parfois des vidéos courtes. Git est
mal fait pour les binaires : chaque version est conservée intégralement, sans
delta-compression utile sur des formats déjà compressés.

## Options

### binaires-dans-git

Versionner les binaires directement.

**Pour** — cohérence parfaite, tout est au même endroit, rien à exploiter.
**Contre** — plafond pratique à environ un mégaoctet avant de changer de chemin de
code, blocage dur à cent. Chaque révision d'une maquette pèse son poids
définitivement, et ce poids est payé par tout consommateur du dépôt. Disqualifié
pour les vidéos.

### mecanisme-gros-fichiers

Le mécanisme de gros fichiers de la plateforme.

**Pour** — prévu pour cet usage, intégré à Git.
**Contre** — trois faits rédhibitoires. L'espace est **irrécupérable** : supprimer
un fichier ne libère rien, et la seule purge en self-service est la destruction et
recréation du dépôt. Le mode dégradé est **silencieux** : quota dépassé,
l'application reçoit des fichiers pointeurs de cent trente octets au lieu des
images, sans erreur. Et il n'est pas accessible par l'API de contenu, ce qui
imposerait un second protocole dans le relais.

### stockage-objet-hash

**Retenue.** Un stockage objet, avec les fichiers adressés par le hash SHA-256 de
leur contenu et un pointeur versionné dans Git.

**Pour** — pas de limite de taille pratique, coût de lecture maîtrisé, mode
dégradé franc. Et surtout : l'adressage par contenu rend la cohérence Git ↔
stockage **automatique**, sans transaction distribuée — un binaire n'est jamais
modifié, une nouvelle version est un nouvel objet à une nouvelle adresse.
**Contre** — un service de plus à exploiter, et un arbitrage de rétention à
trancher.

## Décision

**Stockage objet adressé par contenu.** L'argument décisif n'est pas le coût mais
la cohérence : un relais sans état ne pourrait de toute façon pas coordonner
atomiquement un commit Git et un téléversement. L'adressage par contenu rend cette
coordination inutile.

Deux conséquences à assumer. **L'ordre des opérations** : téléverser avant de
commiter, sinon un pointeur peut désigner un objet absent. Et **l'arbitrage
rétention contre rejouabilité**, traité par la décision suivante.
