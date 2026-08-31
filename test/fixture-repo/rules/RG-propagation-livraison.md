---
id: RG-propagation-livraison
fonctionnalites: [impacts-regles]
statut: actif
cree_par: 2026-001
modifie_par: [2026-002, 2026-010]
---

À la livraison d'un cadrage, ses impacts sont appliqués au référentiel
**automatiquement**, dans un enregistrement distinct de celui de la livraison.

La séparation est délibérée : la livraison porte l'intention rédigée par un
humain, l'enregistrement suivant porte l'écriture faite par la machine. Les
distinguer rend l'historique lisible et permet de rejouer une propagation sans
toucher au cadrage.

L'ordre d'application suit celui des identifiants de cadrage, qui portent l'année
et la séquence : quand plusieurs cadrages touchent une même règle, **le dernier
livré fait foi** sur son énoncé. Les cadrages antérieurs conservent le leur, qui
témoigne de l'état de la règle à leur époque.
