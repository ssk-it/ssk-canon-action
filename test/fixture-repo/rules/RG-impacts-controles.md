---
id: RG-impacts-controles
fonctionnalites: [redaction-cadrage, impacts-regles]
statut: actif
cree_par: 2026-015
modifie_par: []
---

Ce qui empêcherait un cadrage de passer la vérification d'intégrité est
**signalé à la saisie**, et non découvert à la livraison.

Sont contrôlés : qu'une règle est bien désignée, qu'elle n'est pas visée deux
fois, qu'un impact `crée` ou `modifie` porte l'énoncé sans lequel la propagation
n'aurait rien à écrire, et que la règle visée existe — sauf pour `crée`, dont
c'est l'objet même de la faire naître.

Le motif est de délai, pas de rigueur : la vérification finira par attraper ces
défauts, mais bien plus tard, quand le rédacteur aura quitté le sujet et devra
rouvrir un cadrage qu'il croyait terminé. Une cause connue au moment de la
saisie doit être dite au moment de la saisie.
