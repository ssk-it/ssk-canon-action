---
id: RG-automatisation-versionnee
fonctionnalites: [impacts-regles, stockage-git]
statut: actif
cree_par: 2026-011
modifie_par: []
---

Un dépôt cadré consomme une **version désignée** de l'automatisation, jamais un
état mouvant sans nom.

Deux formes coexistent : une version figée, qui ne change jamais et permet
d'épingler ; un alias de version majeure, qui suit les corrections compatibles.
Le dépôt cadré choisit laquelle il consomme.

Sans cela, une modification de l'automatisation change le comportement de tous
les dépôts cadrés à leur prochaine livraison, sans que personne l'ait demandé.
C'est précisément la dérive silencieuse que le produit s'emploie à rendre
visible ailleurs : elle ne serait pas plus acceptable dans son propre outillage.
