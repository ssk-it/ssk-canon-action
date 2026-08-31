---
id: RG-operations-impact
fonctionnalites: [impacts-regles]
statut: actif
cree_par: 2026-001
modifie_par: []
---

Un impact déclare l'une de **quatre opérations** sur une règle de gestion :

- `cree` — la règle n'existait pas ; le cadrage la crée avec son énoncé.
- `modifie` — la règle existe ; son énoncé est remplacé.
- `abroge` — la règle cesse de s'appliquer. Son fichier n'est pas supprimé : une
  règle abrogée reste consultable.
- `touche` — aucune écriture. Trace une dépendance : le cadrage concerne cette
  règle sans la changer. C'est le signal de relecture le plus utile.

Un cadrage ne peut déclarer qu'un seul impact par règle.
