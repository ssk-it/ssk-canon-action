---
id: RG-chemins-immuables
fonctionnalites: [stockage-git, historique]
statut: actif
cree_par: 2026-002
modifie_par: []
---

Le chemin d'un fichier ne change **jamais** après sa création.

Les règles vivent à plat dans `rules/`, les fonctionnalités à plat dans
`features/`, et un dossier de cadrage porte l'identifiant seul, sans slug de
titre.

Cette contrainte découle d'une limite de la plateforme : aucune API GitHub ne suit
les renommages. Un fichier déplacé perdrait tout son historique visible depuis
l'application, ce qui contredirait la promesse du produit. La vérification
d'intégrité doit signaler la disparition d'un identifiant.
