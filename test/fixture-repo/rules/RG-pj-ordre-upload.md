---
id: RG-pj-ordre-upload
fonctionnalites: [pieces-jointes]
statut: actif
cree_par: 2026-002
modifie_par: [2026-003]
---

Une pièce jointe est **téléversée avant** que le fichier Markdown qui la référence
ne soit commité.

L'ordre inverse produirait un pointeur désignant un objet absent. Comme le
stockage n'émet aucune notification, la réussite du téléversement est vérifiée
explicitement avant le commit.
