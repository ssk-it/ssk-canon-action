---
id: RG-secret-conserve-localement
fonctionnalites: [authentification]
statut: actif
cree_par: 2026-008
modifie_par: []
---

Un secret saisi par l'utilisateur est **conservé par son navigateur** et n'est
transmis qu'à GitHub.

L'application n'en affiche jamais que les derniers caractères, assez pour
reconnaître lequel est en place, jamais assez pour le recopier.

Elle indique au moment de la saisie quels droits sont réellement nécessaires, et
permet de se déconnecter à tout moment. Tant que l'application ne fait que lire,
elle demande un accès en lecture seule.
