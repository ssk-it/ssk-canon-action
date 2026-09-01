---
id: RG-parseur-partage
fonctionnalites: [stockage-git, modele-referentiel]
statut: actif
cree_par: 2026-004
modifie_par: []
---

La lecture du format est implémentée **deux fois** : dans l'application pour le
navigateur, dans l'automatisation pour la plateforme.

Les deux implémentations doivent rester d'accord. Tant que le format n'est pas
stabilisé, la duplication est assumée plutôt qu'extraite dans un paquet partagé,
dont le montage coûterait plus que le risque qu'il éviterait.

Le dépôt d'exemple sert de test commun : toute divergence entre les deux lectures
doit s'y manifester.
