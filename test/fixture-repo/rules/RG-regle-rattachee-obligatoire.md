---
id: RG-regle-rattachee-obligatoire
fonctionnalites: [impacts-regles, modele-referentiel]
statut: actif
cree_par: 2026-011
modifie_par: []
---

Une règle de gestion rattachée à **aucune fonctionnalité** empêche la livraison.

Le référentiel se parcourt par domaines, puis par fonctionnalités, puis par
règles. Une règle qui ne se rattache à rien n'apparaît sur aucun chemin : elle
existe dans le dépôt et nulle part dans le produit.

Le contrôle était un simple avertissement, et la propagation ne le rattrapait
pas — son garde-fou ne se déclenche que si le fichier de la règle est absent, pas
s'il est présent et orphelin. Une règle pouvait donc être livrée introuvable.

Une règle que personne ne peut atteindre n'a pas d'existence utile. Mieux vaut
refuser la livraison que produire un référentiel dont une partie est invisible.
