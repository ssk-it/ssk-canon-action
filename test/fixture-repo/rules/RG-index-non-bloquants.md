---
id: RG-index-non-bloquants
fonctionnalites: [impacts-regles]
statut: actif
cree_par: 2026-010
modifie_par: []
---

Les contrôles portant sur les **index dérivés** — les champs qui rappellent quels
cadrages ont créé ou modifié une règle — s'appliquent à la relecture humaine,
jamais à la propagation.

Ces champs sont écrits par la propagation elle-même. Exiger qu'ils soient déjà
corrects avant de propager rendrait toute désynchronisation impossible à
corriger : la propagation serait bloquée par ce qu'elle est précisément chargée
de réparer.

Principe général : un contrôle ne doit jamais porter sur ce que l'opération
contrôlée est censée produire.
