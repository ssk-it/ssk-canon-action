---
id: RG-bornes-consultables
fonctionnalites: [historique]
statut: actif
cree_par: 2026-013
modifie_par: []
---

Une consultation datée ne peut pas remonter avant le **plus ancien
enregistrement du dépôt**, et la saisie l'en empêche plutôt que de la refuser
après coup.

La date de création du dépôt ne convient pas comme borne : un dépôt peut rester
vide un moment après sa création, et l'écart mesuré sur le référentiel de
référence dépasse deux heures. Ce qui borne la consultation, c'est l'existence
d'un contenu à reconstituer, pas celle du dépôt.

Les instants se choisissent à la minute et non au jour. Un dépôt jeune, ou une
semaine où plusieurs cadrages sont livrés, tient entièrement dans une journée :
une granularité au jour n'y montrerait rien.
