---
id: RG-index-recherche-client
fonctionnalites: [stockage-git, historique]
statut: actif
cree_par: 2026-002
modifie_par: []
---

La recherche s'appuie sur un **index construit côté client**, alimenté par
l'arborescence du dépôt et les contenus chargés, mis en cache et invalidé par le
SHA de chaque fichier.

L'API de recherche de la plateforme n'est pas utilisable : elle est limitée à dix
requêtes par minute, n'indexe que la branche par défaut — donc aucun cadrage en
cours de rédaction —, ne permet aucune recherche historique et n'offre aucune
garantie de fraîcheur.
