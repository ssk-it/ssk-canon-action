---
id: 02-duree-autorisations
titre: Quelle durée pour les autorisations d'écriture temporaires ?
statut: annulee
---

## Description

L'hypothèse de départ, tirée du fonctionnement du fournisseur de référence, était
qu'un relais exécuté sous un rôle technique ne pourrait signer que des
autorisations d'environ une heure — la durée de sa propre session.

Il fallait donc décider comment gérer les téléversements longs, notamment pour les
vidéos, et prévoir un mécanisme de renouvellement.

## Pourquoi cette décision est annulée

**La contrainte n'existe pas chez le fournisseur retenu.** Scaleway ne propose pas
de credentials temporaires : ses clés sont statiques et peuvent ne jamais expirer.
La durée d'une autorisation signée n'est donc pas bornée par la session du
signataire.

La question devient sans objet, et le mécanisme de renouvellement envisagé serait
du code écrit pour un problème inexistant.

**Ce qu'il reste à traiter, ailleurs** : puisque le relais détient une clé de
longue durée sans rotation automatique, ses droits doivent être restreints au
strict nécessaire par les mécanismes du fournisseur. C'est une question de
configuration, pas de conception, et elle relève du cadrage de mise en place du
relais.

**Un point reste à vérifier empiriquement** : la durée maximale d'une autorisation
signée n'est pas documentée par le fournisseur. La limite de sept jours du
protocole s'applique vraisemblablement, mais il faudra le confirmer par un test
plutôt que de s'en remettre à une inférence.
