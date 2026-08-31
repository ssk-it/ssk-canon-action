---
id: RG-auteur-reel-commit
fonctionnalites: [autorisation, stockage-git]
statut: actif
cree_par: 2026-002
modifie_par: []
---

Tout commit écrit au nom d'un utilisateur porte **son identité réelle** comme
auteur, renseignée depuis son jeton d'identité.

Sans cela, tous les commits apparaîtraient signés par l'application installée sur
le dépôt, et la traçabilité — qui est la raison d'être du produit — disparaîtrait.
