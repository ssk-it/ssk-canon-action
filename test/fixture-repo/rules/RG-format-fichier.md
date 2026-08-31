---
id: RG-format-fichier
fonctionnalites: [stockage-git]
statut: actif
cree_par: 2026-001
modifie_par: []
---

Chaque entité est un fichier Markdown composé d'un **frontmatter YAML** et d'un
**corps Markdown**.

Le partage entre les deux suit une règle unique : le frontmatter porte ce que la
machine interroge — identifiants, statuts, rattachements, impacts ; le corps porte
ce que l'humain lit — descriptions, objectifs, parcours, énoncés.

Un fichier sans frontmatter, ou dont le YAML est invalide, est une erreur
bloquante.
