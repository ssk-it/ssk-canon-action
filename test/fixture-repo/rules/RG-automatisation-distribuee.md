---
id: RG-automatisation-distribuee
fonctionnalites: [impacts-regles, stockage-git]
statut: actif
cree_par: 2026-011
modifie_par: []
---

L'automatisation du cadrage — vérification d'intégrité et propagation — est
**publiée séparément de l'application**, sous une licence ouverte.

Elle s'exécute chez l'utilisateur, sur son dépôt, dans son environnement
d'intégration continue. Une automatisation qui s'exécute chez l'utilisateur mais
qu'il ne peut ni lire ni atteindre est une dépendance opaque au cœur de son
processus de livraison.

La contrainte qui l'impose est vérifiée : une automatisation hébergée dans un
dépôt fermé n'est référençable que depuis la même organisation. La rendre
publique supprime la question plutôt que de la contourner — un dépôt cadré peut
appartenir à qui veut.

Le partage suit la nature de ce qui est distribué, non la commodité du
découpage : ce qui tourne chez l'utilisateur lui est accessible, ce qui tourne
chez l'éditeur ne l'est pas.
