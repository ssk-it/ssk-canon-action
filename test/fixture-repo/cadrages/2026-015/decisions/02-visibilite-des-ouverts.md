---
id: 02-visibilite-des-ouverts
titre: Comment retrouver un cadrage ouvert mais pas livré ?
statut: retenue
option_retenue: une-section-a-part
---

## Description

Un cadrage ouvert n'appartient pas au référentiel : il vit sur sa branche
jusqu'à sa livraison. La liste des cadrages, construite depuis le référentiel, ne
le montre donc pas.

Le rédacteur qui vient d'ouvrir un cadrage ne le retrouve nulle part. Il en
connaît l'identifiant le temps de la session, puis le perd.

## Options

### laisser-la-demande-de-fusion-servir-de-liste

Compter sur la plateforme : le cadrage est retrouvable par sa demande de fusion.

**Pour** — rien à construire.
**Contre** — oblige à sortir de l'outil pour retrouver un travail commencé
dedans. Et le client, à qui le produit s'adresse autant qu'à l'équipe, n'a pas
nécessairement d'aisance avec la plateforme.

### melanger-a-la-liste

Ajouter les cadrages ouverts parmi les autres, avec leur statut.

**Pour** — une seule liste, un seul endroit où chercher.
**Contre** — laisse croire que le référentiel porte déjà ce qui n'est encore
qu'en discussion. La distinction entre ce qui est décidé et ce qui s'instruit est
le cœur du produit : la brouiller dans sa liste principale serait un contresens.

### une-section-a-part

**Retenue.** Une section distincte, expliquant que ces cadrages n'entreront dans
le référentiel qu'à leur livraison.

**Pour** — retrouvable sans quitter l'outil, sans confusion sur ce qui fait
référence.
**Contre** — un appel de plus au chargement de la liste, et deux populations à
présenter.

## Décision

**Une section à part, avec son explication.**

Ce qui départage n'est pas le confort mais la fidélité : le produit distingue ce
qui est livré de ce qui s'instruit, et son interface doit refléter cette
distinction plutôt que la lisser.

L'appel supplémentaire est sans conséquence — une seule requête quel que soit le
nombre de cadrages ouverts — et son échec ne dégrade que cette section, sans
empêcher la lecture du référentiel.
