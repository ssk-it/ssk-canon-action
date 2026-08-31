---
id: 03-ordre-des-ecritures
titre: Dans quel ordre écrire branche, fichier et demande de fusion ?
statut: retenue
option_retenue: brancher-deposer-demander
---

## Description

Ouvrir un cadrage demande trois écritures successives sur la plateforme, et
celle-ci n'offre aucun moyen de les rendre indivisibles. Chacune peut échouer,
laissant les précédentes en place.

La question n'est donc pas d'éviter l'échec partiel, mais de choisir quel état
partiel on préfère.

## Options

### demander-d-abord

Ouvrir la demande de fusion, puis y pousser le contenu.

**Pour** — la demande existe immédiatement, et sert de point de rendez-vous.
**Contre** — impossible en pratique, une demande de fusion exigeant une branche
qui diverge. Et un échec ultérieur laisserait une demande vide, visible de tous,
qu'il faudrait fermer à la main.

### brancher-deposer-demander

**Retenue.** Créer la branche, y déposer le fichier, ouvrir la demande.

**Pour** — chaque état intermédiaire est rattrapable et discret. Une branche sans
fichier ne gêne personne ; un fichier sans demande de fusion se retrouve par le
nom de sa branche, qui porte l'identifiant du cadrage.
**Contre** — rien n'est visible tant que les trois n'ont pas abouti.

## Décision

**Brancher, déposer, demander.**

Le principe qui guide : **quand l'indivisibilité est impossible, ordonner les
étapes pour que l'échec le plus probable laisse l'état le moins gênant.** Ici,
l'échec le plus visible — une demande de fusion vide — est celui qu'on écarte en
le plaçant en dernier.

Le nom de branche portant l'identifiant du cadrage, un échec intermédiaire reste
identifiable sans registre ni suivi : la convention de nommage sert de moyen de
rattrapage, ce qui est une raison de plus de s'y tenir.
