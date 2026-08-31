---
id: 03-controle-avant-ecriture
titre: Quand signaler ce qui empêcherait la livraison ?
statut: retenue
option_retenue: a-la-saisie
---

## Description

La vérification d'intégrité s'exécute sur la demande de fusion et bloque la
livraison d'un cadrage incohérent. Elle est le dernier filet, et il tient.

Mais éprouver le parcours complet a montré ce qu'il coûte : un impact déclaré sur
une règle inexistante a été accepté par l'application, écrit sur la branche, et
refusé par la vérification. Le rédacteur avait quitté le sujet ; la cause était
pourtant connue au moment où il tapait l'identifiant.

## Options

### laisser-la-verification-faire

S'en remettre au contrôle qui existe déjà.

**Pour** — un seul endroit où la règle est écrite, donc aucune divergence
possible entre deux contrôles.
**Contre** — l'erreur est découverte après coup, sur une demande de fusion en
échec. Le rédacteur doit rouvrir un cadrage qu'il croyait terminé, comprendre un
message d'automate, et recommencer.

### tout-controler-a-la-saisie

Réimplémenter la vérification d'intégrité dans l'application.

**Pour** — plus rien ne surprendrait à la livraison.
**Contre** — deux implémentations d'une même règle divergent, et le produit sait
déjà que cette duplication coûte. Certains contrôles supposent d'ailleurs le
référentiel entier à l'état livré, que l'application n'a pas sous la main.

### a-la-saisie

**Retenue.** Contrôler ce qui est déductible de ce que l'application a déjà :
règle désignée, pas de doublon, énoncé présent quand l'opération l'exige,
existence de la règle visée.

**Pour** — le rédacteur corrige pendant qu'il y est. La vérification reste
l'autorité et le filet final.
**Contre** — un contrôle en double, donc un risque de divergence si l'un évolue
sans l'autre.

## Décision

**Contrôler à la saisie ce qui est connu à la saisie.**

Le critère n'est pas la complétude mais l'information disponible : ce que
l'application peut déduire sans rien charger de plus, elle doit le dire tout de
suite. Le reste appartient à la vérification, qui a le référentiel entier sous
les yeux.

Le risque de divergence est réel mais borné : ces contrôles portent sur la forme
du cadrage, la partie du format la plus stable. Et le désaccord serait bénin —
l'application refuserait ce que la vérification accepte, jamais l'inverse.

Enseignement de méthode : **ce défaut n'est apparu qu'en jouant le parcours en
entier.** Les tests portaient sur la forme du fichier produit, et il était bien
formé ; c'est son contenu qui ne pouvait pas exister.
