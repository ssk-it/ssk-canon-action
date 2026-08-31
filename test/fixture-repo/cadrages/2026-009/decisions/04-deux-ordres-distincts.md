---
id: 04-deux-ordres-distincts
titre: Comment gérer deux écrans qui ordonnent les statuts en sens inverse ?
statut: retenue
option_retenue: deux-ordres-nommes
---

## Description

La liste des cadrages place les brouillons en tête : on y cherche ce qui reste à
faire. La chronologie d'une règle place les livrés en tête : on part de l'état
actuel pour remonter vers l'origine.

Les deux ordres sont justes, et opposés. Reste à décider comment les exprimer
sans qu'ils se contredisent.

## Options

### un-ordre-unique-inverse

Définir un seul ordre, que l'écran concerné inverse au besoin.

**Pour** — une seule définition à maintenir.
**Contre** — le lecteur du code voit une inversion sans savoir si elle est
voulue ou si c'est une erreur. Et l'ordre porte forcément le nom de l'un des deux
usages, ce qui rend l'autre incompréhensible.

### deux-ordres-nommes

**Retenue.** Deux ordres distincts, chacun nommé pour son usage.

**Pour** — l'intention est lisible à l'endroit où l'ordre s'applique. Modifier
l'un n'altère pas l'autre par accident.
**Contre** — deux définitions à garder cohérentes.

## Décision

**Deux ordres nommés.**

Le risque de divergence est traité par une vérification automatique : les deux
ordres doivent rester exactement inverses sur les statuts. Modifier l'un sans
l'autre fait échouer la construction.

Principe général : quand deux usages ont besoin de comportements opposés, les
nommer tous les deux vaut mieux que d'en dériver un du premier. L'inversion tacite
se lit comme un défaut ; l'inversion nommée se lit comme une intention.
