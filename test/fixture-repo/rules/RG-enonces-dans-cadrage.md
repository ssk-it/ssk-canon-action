---
id: RG-enonces-dans-cadrage
fonctionnalites: [impacts-regles, redaction-cadrage]
statut: actif
cree_par: 2026-002
modifie_par: []
---

Un impact de type `cree` ou `modifie` doit être accompagné du **nouvel énoncé** de
la règle, rédigé dans une section `## Énoncés` du cadrage, sous un titre de niveau
3 portant l'identifiant de la règle.

Sans cet énoncé, la propagation n'a rien à écrire : l'absence est une erreur
bloquante.

Un énoncé porte le texte **au moment de la livraison du cadrage**, pas l'état
courant de la règle. Un cadrage ancien peut donc énoncer un comportement depuis
modifié : c'est correct, et l'application doit le rendre lisible pour éviter qu'un
lecteur n'y voie une incohérence.
