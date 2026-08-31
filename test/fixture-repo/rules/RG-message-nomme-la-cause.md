---
id: RG-message-nomme-la-cause
fonctionnalites: [authentification]
statut: actif
cree_par: 2026-008
modifie_par: []
---

Un message d'erreur **nomme la cause réelle** et indique quoi faire.

Deux causes distinctes ne partagent jamais un message : un jeton refusé et une
limite d'appels atteinte se ressemblent — l'application est bloquée dans les deux
cas — mais la première se corrige en quelques secondes tandis que la seconde
demande d'attendre. Les confondre envoie chercher au mauvais endroit.

Le message tient compte de l'état : introuvable **sans** connexion suggère de
vérifier que le dépôt est public ; introuvable **avec** connexion suggère de
vérifier que les droits couvrent ce dépôt.
