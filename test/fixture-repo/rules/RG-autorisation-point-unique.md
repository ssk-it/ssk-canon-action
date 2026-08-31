---
id: RG-autorisation-point-unique
fonctionnalites: [autorisation]
statut: actif
cree_par: 2026-002
modifie_par: []
---

Les autorisations s'appliquent en **un seul point** : le composant qui relaie les
appels vers le dépôt.

L'application installée sur le dépôt ayant les mêmes droits quel que soit
l'utilisateur, un relais qui se contenterait de transmettre laisserait tout
porteur d'une identité valide écrire dans n'importe quel projet. Le relais
restreint donc les dépôts et les chemins accessibles selon l'identité appelante.
