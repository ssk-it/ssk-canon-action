---
id: RG-pj-adressage-contenu
fonctionnalites: [pieces-jointes]
statut: actif
cree_par: 2026-002
modifie_par: []
---

Une pièce jointe est stockée sous le **hash SHA-256 de son contenu**, à la clé
`sha256/{ab}/{cd}/{hash}`. Le fichier versionné dans Git ne porte que ce hash, sa
taille, son nom d'origine et son type.

Un objet stocké n'est jamais modifié : une nouvelle version est un nouvel objet à
une nouvelle adresse, et c'est le pointeur versionné qui change.

Deux conséquences recherchées : revenir à un commit ancien retrouve les pièces
jointes de l'époque sans mécanisme de synchronisation ; et deux cadrages joignant
le même fichier n'occupent qu'un seul objet.
