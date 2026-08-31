---
id: 01-source-de-l-edition
titre: Depuis où reprendre un cadrage en cours ?
statut: retenue
option_retenue: la-branche-du-cadrage
---

## Description

Un cadrage ouvert vit sur sa propre branche. Le référentiel que l'application
charge vient de la branche principale, qui ne le connaît pas encore.

Il y a donc deux endroits où un cadrage peut se trouver, et ils ne portent pas la
même chose : la branche principale porte les cadrages déjà entrés dans le
référentiel, la branche du cadrage porte le travail en cours.

## Options

### la-branche-principale

Ne reprendre que ce que le référentiel contient.

**Pour** — aucun appel supplémentaire, le contenu est déjà chargé.
**Contre** — un cadrage qu'on vient d'ouvrir est inéditable : il n'est pas encore
dans le référentiel. Le cycle ne boucle pas, et l'outil fait ouvrir des sujets
qu'il ne sait pas reprendre.

### la-branche-du-cadrage

**Retenue.** Charger depuis la branche du cadrage lorsqu'elle existe, depuis la
branche principale sinon.

**Pour** — le travail en cours est ce qu'on veut reprendre. Un cadrage rédigé
hors de l'application, ou déjà livré, reste accessible par la seconde voie.
**Contre** — impose de savoir quelles branches existent, donc un appel de plus.
Et deux provenances possibles, que l'affichage doit distinguer.

## Décision

**La branche du cadrage fait autorité, la branche principale sert de recours.**

L'ordre suit une règle simple : la source la plus récente l'emporte, et une
branche de cadrage est par construction en avance sur la branche principale
tant que le cadrage n'est pas livré.

La provenance est affichée, et le libellé diffère selon le cas. La première
version annonçait « les écritures restent sur cette branche jusqu'à la
livraison » même lorsque le cadrage vivait sur la branche principale — une
promesse d'isolement qui n'existait pas. Un message rassurant mais faux est pire
qu'un message absent.
