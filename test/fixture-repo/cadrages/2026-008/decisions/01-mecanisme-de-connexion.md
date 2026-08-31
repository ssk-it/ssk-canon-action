---
id: 01-mecanisme-de-connexion
titre: Quel mécanisme pour relever la limite d'appels ?
statut: retenue
option_retenue: secret-personnel
---

## Description

La limite de soixante appels par heure gêne l'usage soutenu. Trois voies la
relèvent, d'inégal coût.

Un point mérite d'être posé avant de choisir : l'application ne consomme qu'un
appel par chargement complet. Le blocage rencontré venait de vérifications
répétées, pas d'un usage ordinaire. Il ne s'agit donc pas de réparer un défaut,
mais de supprimer un plafond — ce qui interdit d'y consacrer un effort
disproportionné.

## Options

### ne-rien-faire

Conserver la limite et se contenter du message qui l'explique.

**Pour** — aucun développement. La limite suffit à un usage de consultation.
**Contre** — bloque le développement, où les rechargements sont fréquents. Et ne
prépare rien pour l'écriture, qui exigera de toute façon une connexion.

### identite-federee

Mettre en place dès maintenant l'identité fédérée et l'accès applicatif prévus
pour la cible.

**Pour** — c'est la solution définitive, et elle règle aussi l'accès du client
non technique.
**Contre** — impose de construire le relais et de configurer le fournisseur
d'identité, alors que l'écriture et la propagation ne sont pas faites. Beaucoup
d'infrastructure pour un plafond gênant.

### secret-personnel

**Retenue.** Un secret saisi par l'utilisateur, conservé par son navigateur.

**Pour** — la limite passe à cinq mille immédiatement, sans aucune
infrastructure. C'est de surcroît ce que l'étape d'écriture prévoyait déjà : le
travail n'est pas jetable, il est avancé.
**Contre** — chaque utilisateur doit créer et coller un secret, ce qui reste
inacceptable pour un client non technique. C'est une solution d'attente, et elle
est assumée comme telle.

## Décision

**Secret personnel.**

Le critère qui tranche : ce mécanisme est la première marche de la solution
définitive, pas une voie parallèle. L'identité fédérée fournira plus tard un
secret d'une autre origine, et l'application ne s'en apercevra pas — à condition
que le secret soit obtenu par un point unique, ce que la décision suivante
garantit.
