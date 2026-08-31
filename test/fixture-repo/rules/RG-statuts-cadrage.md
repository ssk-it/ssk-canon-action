---
id: RG-statuts-cadrage
fonctionnalites: [cycle-vie-cadrage]
statut: actif
cree_par: 2026-001
modifie_par: [2026-002]
---

Un cadrage passe par quatre statuts : **brouillon**, **en relecture**,
**validée**, **livrée**.

Chaque statut correspond à un état observable de la pull request associée :
branche créée, PR ouverte, PR approuvée, PR mergée. L'application lit l'état réel
de la PR au lieu de maintenir un statut en parallèle, ce qui rend la
désynchronisation impossible.

L'historique des transitions est dérivé des événements de la pull request, chacun
daté et attribué.
