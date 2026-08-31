---
id: 02-cycle-de-vie
titre: Comment gérer l'écriture d'un cadrage en cours de rédaction ?
statut: retenue
option_retenue: branche-et-pr
---

## Description

Un cadrage se rédige sur plusieurs jours, passe en relecture, se fait commenter,
puis est validé. Où vit-il pendant ce temps, et comment son statut est-il porté ?

## Options

### commits-directs

Chaque sauvegarde produit un commit sur la branche principale, et le statut est un
champ du frontmatter.

**Pour** — simple, immédiat, l'historique est complet.
**Contre** — un cadrage en brouillon pollue le référentiel courant. Et le statut
devient une donnée à maintenir, donc à désynchroniser.

### brouillon-local

L'édition vit dans le navigateur, et l'on ne commite qu'au changement de statut.

**Pour** — bonne expérience hors-ligne, cohérente avec une application installable.
**Contre** — le travail en cours est invisible aux autres, ce qui contredit
l'objectif d'un outil partagé. Et un navigateur vidé perd le travail.

### branche-et-pr

**Retenue.** Un cadrage en brouillon vit sur sa branche ; le passage en relecture
ouvre une pull request ; la livraison la merge.

**Pour** — le cycle de vie n'est pas inventé, il épouse celui d'une pull request.
La relecture, les commentaires et l'historique de validation sont fournis par la
plateforme. Le statut devient **dérivé** de l'état réel de la PR, donc impossible
à désynchroniser.
**Contre** — l'application doit gérer branches et merges, ce qui est plus de code
que des commits directs.

## Décision

**Une branche et une pull request par cadrage.** L'argument qui emporte : le
statut cesse d'être une donnée à maintenir pour devenir une observation. C'est
une classe entière de bugs qui n'existe pas.
