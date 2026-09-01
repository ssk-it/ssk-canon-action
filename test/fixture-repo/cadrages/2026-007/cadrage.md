---
id: 2026-007
titre: Navigation dans une fiche de cadrage
domaines: [cadrage]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-sommaire-fiche-longue, operation: cree }
  - { regle: RG-position-de-lecture, operation: cree }
  - { regle: RG-sommaire-place-disponible, operation: cree }
  - { regle: RG-divergence-enonce-visible, operation: modifie }
  - { regle: RG-decisions-options, operation: touche }
  - { regle: RG-operations-impact, operation: touche }
---

## Objectif

Rendre une fiche de cadrage parcourable.

Le constat est venu de l'usage : la fiche du cadrage 2026-002 porte quatre
décisions et dix-sept impacts, et dépasse plusieurs milliers de pixels de haut.
Rien n'y indique la structure, et atteindre un élément précis demande de faire
défiler jusqu'à le rencontrer.

C'est un défaut qui s'aggrave avec la valeur du produit : plus un cadrage est
soigneusement documenté — options écartées, impacts tracés — moins il est
consultable. L'outil découragerait précisément ce qu'il cherche à encourager.

Ce travail met au jour une lacune du modèle : la **consultation** d'un cadrage
n'existait pas comme fonctionnalité. Les règles la concernant étaient rattachées
à la rédaction, qui couvre un besoin différent — on rédige une fois,
linéairement ; on consulte souvent, et rarement en entier. Le présent cadrage
crée cette fonctionnalité et y rattache les règles qui en relèvent.

## Parcours utilisateur

1. Le lecteur ouvre un cadrage. Un sommaire apparaît sur le côté, listant les
   sections, chaque décision par son titre, et chaque impact par sa règle.
2. Il repère l'opération de chaque impact directement dans le sommaire, sans
   avoir à ouvrir la section correspondante.
3. Il fait défiler la fiche ; le sommaire reste visible et signale en continu
   l'élément qu'il est en train de lire.
4. Il sélectionne une décision dans le sommaire ; la fiche l'amène directement à
   cette décision, dont le titre reste lisible sous les éléments fixes.
5. Sur un écran étroit, le sommaire s'efface et la fiche occupe toute la largeur.

## Énoncés

### RG-sommaire-fiche-longue

La consultation d'un cadrage s'accompagne d'un **sommaire latéral** qui reste
visible pendant le défilement.

Le sommaire reprend la structure réelle du cadrage : ses sections, mais aussi
**chaque décision et chaque impact nommément**. Une liste réduite aux sections ne
répondrait pas à la question qu'on se pose en revenant sur une fiche — « où était
la décision sur le stockage ? ».

Chaque impact porte son opération, afin que la liste se parcoure d'un regard.

Un cadrage nourri dépasse largement la hauteur d'un écran ; sans repère, le
lecteur perd la structure et ne peut pas atteindre directement ce qu'il cherche.

### RG-position-de-lecture

Le sommaire signale en permanence **l'élément en cours de lecture**.

Lorsqu'un élément détaillé et la section qui le contient sont tous deux visibles,
c'est **l'élément détaillé qui est signalé**. Indiquer « Décisions » à quelqu'un
qui lit une décision précise ne lui apprend rien ; le titre de cette décision
situe sa lecture.

Sélectionner une entrée du sommaire amène directement à l'élément correspondant,
sans le masquer sous les éléments d'interface fixes.

### RG-sommaire-place-disponible

Le sommaire n'apparaît que lorsque la largeur disponible permet de l'afficher
**sans réduire la zone de lecture**.

En deçà, la fiche occupe toute la largeur. Un sommaire qui comprime le texte
qu'il est censé aider à parcourir dessert son objet.

### RG-divergence-enonce-visible

Lorsque l'énoncé porté par un cadrage diffère de l'énoncé courant de la règle,
l'application **signale l'écart et l'explique**.

Un cadrage porte le texte au moment de sa livraison ; un cadrage ancien énonce
donc légitimement un comportement depuis modifié. Sans explication, un lecteur
prend cette différence pour une incohérence et perd confiance dans le
référentiel.

Le signalement précise que l'énoncé a été modifié par un cadrage ultérieur, et
que le texte affiché est celui du cadrage consulté.

