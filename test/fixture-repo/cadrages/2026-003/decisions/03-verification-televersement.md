---
id: 03-verification-televersement
titre: Comment savoir qu'un téléversement a réussi ?
statut: retenue
option_retenue: verification-explicite
---

## Description

Le fichier part directement du navigateur vers le stockage, sans passer par le
relais. Comment celui-ci sait-il que l'objet est bien arrivé, avant de laisser
enregistrer le cadrage qui le référence ?

Le fournisseur retenu n'émet **aucune notification d'événement** — la
fonctionnalité est annoncée comme en développement.

## Options

### faire-confiance-au-client

Le navigateur signale au relais que le téléversement a réussi.

**Pour** — aucun appel supplémentaire.
**Contre** — un client qui se trompe ou qui ment produit un pointeur mort. Or le
pointeur mort est précisément ce que l'ordre des opérations vise à empêcher : s'en
remettre à la parole du client viderait la garantie de son sens.

### verification-explicite

**Retenue.** Le relais interroge le stockage pour confirmer la présence de l'objet
avant d'autoriser l'enregistrement.

**Pour** — la garantie devient réelle plutôt que déclarative. Le coût est nul :
les requêtes ne sont pas facturées chez le fournisseur retenu.
**Contre** — un aller-retour de plus avant l'enregistrement.

## Décision

**Vérification explicite.** Une garantie qui repose sur la bonne foi du client
n'est pas une garantie. Le coût étant nul, l'arbitrage ne se pose même pas.
