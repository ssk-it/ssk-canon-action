---
id: RG-branche-par-cadrage
fonctionnalites: [cycle-vie-cadrage, stockage-git]
statut: actif
cree_par: 2026-001
modifie_par: []
---

Chaque cadrage est rédigé sur sa **propre branche**, nommée `cadrage/<id>`, et
livré par le merge de sa pull request.

Deux cadrages simultanés n'entrent donc jamais en conflit. Deux personnes éditant
le même cadrage produisent en revanche un conflit Git, que l'application doit
présenter intelligemment.
