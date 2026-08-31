---
id: RG-propagation-tout-ou-rien
fonctionnalites: [impacts-regles]
statut: actif
cree_par: 2026-010
modifie_par: []
---

La propagation calcule **toutes** les écritures avant d'en appliquer aucune. Une
incohérence l'interrompt avant la première écriture.

Le référentiel reste alors dans son état précédent, qui est cohérent, plutôt que
dans un état intermédiaire que personne n'a décidé et dont le rattrapage serait
manuel.

Un référentiel à demi propagé serait plus difficile à réparer qu'un référentiel
non propagé, parce que rien n'indiquerait où la propagation s'est arrêtée.
