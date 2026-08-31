---
id: RG-chargement-hors-quota
fonctionnalites: [stockage-git]
statut: actif
cree_par: 2026-006
modifie_par: [2026-008]
---

Le chargement d'un dépôt consomme **une seule requête décomptée**, quel que soit
le nombre de fichiers.

L'arborescence est obtenue par un appel unique ; les contenus sont ensuite
récupérés par un canal non décompté.

Cette contrainte n'est pas une optimisation mais une condition de
fonctionnement : sans connexion, la limite est de soixante appels par heure,
alors qu'un référentiel modeste compte déjà plusieurs dizaines de fichiers.

**Le canal des contenus peut être basculé sur celui de l'arborescence**, au prix
d'un appel par fichier. Ce mode répond à deux besoins : les dépôts privés, que le
canal ordinaire ne dessert pas, et l'affichage immédiat de ce qui vient d'être
livré. Il n'a de sens qu'une fois connecté et reste désactivé par défaut.
