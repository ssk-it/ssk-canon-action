---
id: 04-controles-et-derives
titre: La vérification doit-elle s'appliquer avant la propagation ?
statut: retenue
option_retenue: exclure-les-index-derives
---

## Description

La propagation vérifie la cohérence du référentiel avant d'écrire : propager sur
un référentiel incohérent produirait pire.

Mais cette vérification contrôle aussi les **index dérivés** — les champs
rappelant quels cadrages ont créé ou modifié chaque règle. Or ces champs sont
précisément ce que la propagation écrit.

Le défaut est apparu aux tests : une désynchronisation de ces index bloquait la
propagation, qui est pourtant le seul mécanisme capable de les corriger.

## Options

### verifier-tout-avant

Exiger un référentiel entièrement cohérent avant de propager.

**Pour** — une seule règle, simple à énoncer.
**Contre** — crée un blocage sans issue. Un index désynchronisé — par une
modification manuelle, ou une propagation interrompue — devient impossible à
réparer : le seul outil qui le pourrait refuse de s'exécuter.

### ne-rien-verifier

Propager sans contrôle préalable.

**Pour** — aucun blocage possible.
**Contre** — propager sur un référentiel incohérent aggrave l'incohérence, et
l'écriture la rend plus difficile à démêler.

### exclure-les-index-derives

**Retenue.** Vérifier la cohérence, en omettant les contrôles portant sur ce que
la propagation écrit.

**Pour** — les incohérences réelles bloquent toujours ; celles que la propagation
répare ne bloquent plus. Les contrôles restent actifs pour la relecture humaine,
où ils gardent tout leur sens.
**Contre** — deux niveaux de vérification à distinguer et à documenter.

## Décision

**Exclure les index dérivés pendant la propagation.**

Principe général qui dépasse ce cas : **un contrôle ne doit jamais porter sur ce
que l'opération contrôlée est censée produire.** Sinon l'opération ne peut
s'exécuter que là où elle est déjà inutile.

Ce défaut a été trouvé par les tests, pas par la relecture. Il serait passé
inaperçu jusqu'à la première désynchronisation réelle — c'est-à-dire jusqu'au
moment où la propagation aurait été le plus nécessaire.
