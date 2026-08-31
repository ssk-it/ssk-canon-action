---
id: 05-versionnement
titre: Comment un dépôt cadré désigne-t-il la version qu'il consomme ?
statut: retenue
option_retenue: versions-figees-et-alias
---

## Description

Un dépôt cadré référence l'automatisation par une adresse qui comporte une
désignation de version. Le premier montage pointait la branche principale, ce qui
signifie : la dernière version, quelle qu'elle soit.

Cela revient à ce que toute modification de l'automatisation change le
comportement de tous les dépôts cadrés à leur livraison suivante, sans que
personne ne l'ait demandé ni remarqué.

## Options

### suivre-la-branche

Chaque dépôt consomme le dernier état publié.

**Pour** — les corrections parviennent immédiatement ; rien à publier.
**Contre** — un changement de comportement arrive sans annonce, au moment d'une
livraison, sur un dépôt dont l'équipe n'a rien changé. C'est la dérive silencieuse
que le produit combat par ailleurs.

### figer-uniquement

Ne publier que des versions immuables, chaque dépôt en désignant une.

**Pour** — comportement parfaitement stable et reproductible.
**Contre** — une correction ne parvient à personne sans intervention dans chaque
dépôt cadré. Les clients divergent d'autant plus que le temps passe.

### versions-figees-et-alias

**Retenue.** Publier des versions immuables, et maintenir un alias de version
majeure qui désigne la plus récente d'entre elles.

**Pour** — chaque dépôt cadré choisit : épingler pour la stabilité, suivre
l'alias pour les corrections compatibles. Le choix appartient à celui qui en
porte les conséquences.
**Contre** — deux choses à publier à chaque évolution, et l'alias doit être
redéplacé, ce qui est facile à oublier.

## Décision

**Versions figées, plus un alias de version majeure.**

C'est la convention établie de l'écosystème, et elle a la propriété qui compte
ici : elle rend le compromis explicite au lieu de l'imposer. Un dépôt qui exige
la stabilité épingle ; un dépôt qui préfère les corrections suit l'alias.

Le principe rejoint celui du reste du produit : ce qui change doit être désigné
et daté. Une automatisation qui évolue sans que ses consommateurs puissent
nommer ce qu'ils utilisent reproduit exactement le défaut que le cadrage corrige.
