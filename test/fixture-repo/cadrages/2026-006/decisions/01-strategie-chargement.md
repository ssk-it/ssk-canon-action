---
id: 01-strategie-chargement
titre: Comment charger les fichiers sans épuiser le quota ?
statut: retenue
option_retenue: arbre-par-api-contenus-hors-quota
---

## Description

Le quota d'appels sans authentification est de soixante requêtes par heure et par
adresse IP. Le référentiel de ce projet compte cinquante-huit fichiers.

La stratégie envisagée initialement — un appel pour l'arborescence, puis un appel
par fichier — consommerait cinquante-neuf requêtes. Une seule visite épuiserait
le quota, et la suivante échouerait. Le problème n'est pas de performance mais de
faisabilité.

## Options

### tout-par-api

Un appel pour l'arborescence, un appel par fichier.

**Pour** — un seul mécanisme d'accès, cohérent avec ce qu'exigera plus tard la
lecture de dépôts privés.
**Contre** — inutilisable sans authentification. Rendrait obligatoire une
connexion dès la première visite, alors que la consultation devrait être la chose
la plus simple du produit.

### archive-complete

Télécharger l'archive du dépôt en une requête, puis la décompresser côté client.

**Pour** — un seul appel, quel que soit le nombre de fichiers.
**Contre** — impose de décompresser une archive dans le navigateur, donc une
dépendance supplémentaire et un chemin de code sans rapport avec le reste. Et
l'archive contient tout le dépôt, y compris ce dont l'application n'a pas besoin.

### fichiers-embarques

Copier le référentiel dans l'application elle-même.

**Pour** — aucun appel réseau.
**Contre** — le référentiel cesserait d'être vivant : toute évolution exigerait un
redéploiement. Contredit le principe même du produit. Écartée sans débat.

### arbre-par-api-contenus-hors-quota

**Retenue.** L'arborescence par l'API, les contenus par un canal non décompté du
quota.

**Pour** — le chargement complet ne coûte qu'une requête de quota au lieu de
cinquante-neuf. Le canal retenu autorise les requêtes depuis un navigateur et
honore les requêtes conditionnelles, ce qui rend le cache efficace. Vérifié
plutôt que supposé.
**Contre** — deux chemins d'accès à maintenir, et ce canal ne dessert pas les
dépôts privés : la bascule vers l'API authentifiée devra être prévue.

## Décision

**L'arborescence par l'API, les contenus hors quota.**

Le point qui tranche : le quota ne se contourne pas, il se respecte. Une
application qui exige une authentification pour afficher un contenu public
manquerait sa cible — la consultation doit être immédiate.

La contrepartie est assumée et déjà outillée : la couche d'accès expose une
bascule vers l'API pour le jour où les dépôts privés seront lus.
