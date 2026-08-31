---
id: 04-regle-non-rattachee
titre: Une règle rattachée à aucune fonctionnalité peut-elle être livrée ?
statut: retenue
option_retenue: bloquer-la-livraison
---

## Description

Une vérification de la mécanique de propagation sur le référentiel réel a mis au
jour un cas qui passait : une règle dont le fichier existe mais dont la liste de
fonctionnalités est vide est propagée sans obstacle.

Le contrôle existait, mais en avertissement — donc non bloquant. Le garde-fou de
la propagation ne le rattrapait pas davantage : il ne se déclenche que si le
fichier de la règle est **absent**, pas s'il est présent et orphelin.

Conséquence : une règle pouvait être livrée, dûment enregistrée dans le
référentiel, et rester invisible dans le produit — la navigation passant par les
domaines puis les fonctionnalités.

## Options

### laisser-en-avertissement

Signaler sans bloquer, en comptant sur la relecture.

**Pour** — n'interrompt pas un travail en cours, où le rattachement peut être
provisoirement absent.
**Contre** — un avertissement qui n'empêche rien finit par ne plus être lu. Et le
défaut ne se voit qu'à l'usage, quand quelqu'un cherche une règle qu'il ne trouve
pas.

### rattacher-automatiquement

Déduire le rattachement des cadrages qui touchent la règle.

**Pour** — aucune intervention.
**Contre** — le rattachement est une donnée du référentiel, pas du cadrage : la
propagation le préserve, elle ne le décide pas. Le déduire ferait inventer par la
machine une information de structure qui relève d'un choix de conception.

### bloquer-la-livraison

**Retenue.** Faire du rattachement manquant une erreur, qui empêche le merge et
interrompt la propagation.

**Pour** — rend impossible la livraison d'une règle introuvable. Le contrôle
s'applique aux deux moments où il compte : la relecture et la livraison.
**Contre** — durcit la vérification pour un cas qui pourrait sembler mineur, et
oblige à renseigner le rattachement avant de livrer.

## Décision

**Bloquer la livraison.**

Une règle que personne ne peut atteindre n'a pas d'existence utile : elle occupe
un fichier sans être une règle du produit. Mieux vaut refuser de livrer que
produire un référentiel dont une partie est invisible.

L'enseignement dépasse le cas : la vérification portait jusqu'ici sur des
références **fausses** — une entité inconnue, un lien rompu. Ce défaut-là ne
rompt rien ; il rend simplement inatteignable. Ce sont deux natures d'erreur
distinctes, et la seconde ne se voit qu'en se demandant si l'objet produit est
consultable, pas seulement s'il est cohérent.

Il a fallu éprouver la mécanique sur le référentiel réel pour le trouver : les
tests portaient sur des dépôts construits pour l'occasion, tous rattachés.
