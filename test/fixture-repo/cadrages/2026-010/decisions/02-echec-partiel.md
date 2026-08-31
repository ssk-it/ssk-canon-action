---
id: 02-echec-partiel
titre: Que faire si un impact est incohérent au moment de propager ?
statut: retenue
option_retenue: tout-ou-rien
---

## Description

La vérification bloquante sur les demandes de fusion rend le cas rare, mais pas
impossible : un cadrage peut être livré par un autre chemin, ou une règle
supprimée entre-temps.

## Options

### appliquer-ce-qui-est-valide

Écrire les impacts corrects, signaler les autres.

**Pour** — le référentiel avance autant que possible, et l'échec ne bloque pas
tout.
**Contre** — laisse le référentiel dans un état que personne n'a décidé, à
mi-chemin entre deux versions cohérentes. Le rattrapage devient manuel, et rien
n'indique où la propagation s'est arrêtée.

### tout-ou-rien

**Retenue.** Calculer toutes les écritures, n'en appliquer aucune si l'une échoue.

**Pour** — le référentiel reste dans son état précédent, qui est cohérent. La
réparation consiste à corriger le cadrage et relancer, ce que l'idempotence rend
sûr.
**Contre** — un seul impact fautif bloque la livraison entière.

## Décision

**Tout ou rien.**

Un référentiel à demi propagé serait plus difficile à réparer qu'un référentiel
non propagé : dans le second cas on sait exactement où l'on en est.

Le blocage est acceptable parce qu'il est visible et que la correction est
simple. Un état intermédiaire silencieux ne l'aurait pas été.
