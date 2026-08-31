---
id: RG-histoire-derivee
fonctionnalites: [historique, stockage-git]
statut: actif
cree_par: 2026-002
modifie_par: []
---

L'histoire du référentiel n'est **jamais stockée dans les fichiers**. Elle est
dérivée de l'historique Git et des événements de pull request.

Aucun champ `historique:` ne doit exister dans un frontmatter. Les champs
`cree_par` et `modifie_par` sont un index de performance, écrit par la propagation
automatique et jamais à la main : ils évitent de parcourir tout l'historique pour
afficher une fiche, mais la source de vérité reste le log Git.
