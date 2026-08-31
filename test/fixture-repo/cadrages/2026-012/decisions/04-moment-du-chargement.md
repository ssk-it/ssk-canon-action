---
id: 04-moment-du-chargement
titre: Quand charger l'énoncé d'une version passée ?
statut: retenue
option_retenue: au-depliement
---

## Description

La chronologie promet chaque version de l'énoncé. Reste à décider quand ce texte
est récupéré : toutes les versions d'avance, ou celle qu'on ouvre.

La question n'est pas théorique : une règle ancienne peut compter dix versions,
et le lecteur en consulte rarement plus d'une.

## Options

### tout-charger-d-avance

Récupérer toutes les versions avec l'historique.

**Pour** — le dépliement est instantané, sans attente.
**Contre** — fait payer à chaque visite un coût proportionnel au nombre de
versions, dont presque rien n'est lu. Sur une page consultée pour son seul
énoncé courant, la dépense est entièrement perdue.

### au-depliement

**Retenue.** Charger l'énoncé d'une version au moment où elle est ouverte.

**Pour** — le coût suit l'usage réel. Une consultation qui ne déplie rien ne
dépense rien.
**Contre** — une brève attente au premier dépliement.

## Décision

**Au dépliement.**

Le même raisonnement gouverne déjà les dates de création, chargées à la demande
plutôt qu'au chargement du référentiel. Le principe se formule ainsi : **ce dont
la plupart des visites n'ont pas besoin ne doit pas être payé par toutes.**

L'attente introduite est bornée et se produit sur un geste délibéré du lecteur,
qui l'attribue naturellement à son action — contrairement à une lenteur au
chargement, qu'il attribue au produit.
