---
id: RG-identite-separee
fonctionnalites: [authentification]
statut: actif
cree_par: 2026-001
modifie_par: []
---

L'**identité de la personne** et l'**accès technique au dépôt** sont portés par
deux mécanismes distincts.

L'utilisateur s'authentifie auprès du fournisseur d'identité de l'organisation et
n'a jamais connaissance de GitHub. L'accès au dépôt est porté par une application
installée sur celui-ci, avec ses droits propres, indépendants de tout utilisateur.

Cette séparation existe pour une raison précise : le client fait partie des
utilisateurs mais n'a pas de compte GitHub et n'en créera pas.
