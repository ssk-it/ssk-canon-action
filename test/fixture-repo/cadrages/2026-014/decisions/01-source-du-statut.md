---
id: 01-source-du-statut
titre: D'où vient le statut d'un cadrage ?
statut: retenue
option_retenue: le-fichier-fait-foi
---

## Description

Deux réponses coexistaient depuis le socle, et l'écriture a obligé à choisir.

Le format porte un champ `statut` dans le fichier du cadrage. Une règle plus
ancienne énonçait au contraire que le statut se lit de l'état réel de la demande
de fusion, « ce qui rend la désynchronisation impossible ».

L'intention de cette règle était juste — éviter deux sources de vérité — mais sa
conclusion ne tenait pas : le champ existait bel et bien, la vérification
d'intégrité et la propagation le lisaient, et c'est le lien avec la demande de
fusion qui n'avait jamais été réalisé.

## Options

### deriver-de-la-demande

Lire l'état des demandes de fusion au chargement, ignorer le champ.

**Pour** — fidèle à la règle telle qu'écrite ; le statut ne peut pas mentir
puisqu'il est observé.
**Contre** — rend le référentiel illisible hors de la plateforme : une copie
locale, un dépôt archivé, ou simplement une consultation sans connexion perdrait
tous les statuts. Ajoute un appel par cadrage. Et la vérification d'intégrité,
qui s'exécute avant toute fusion, ne pourrait plus rien conclure d'un cadrage
dont la demande n'est pas encore ouverte.

### les-deux-sources

Garder le champ, et signaler tout écart avec la demande de fusion.

**Pour** — détecte une désynchronisation au lieu de la subir.
**Contre** — deux sources dont aucune ne fait autorité : que faire quand elles
divergent ? La question resterait sans réponse au moment précis où elle se pose.

### le-fichier-fait-foi

**Retenue.** Le statut vit dans le fichier. L'état de la demande de fusion s'y
rapproche pour information, sans jamais s'y substituer.

**Pour** — une source unique, qui vit dans le dépôt et voyage avec lui. La
vérification et la propagation la lisent déjà. Un référentiel reste entièrement
lisible sans interroger quoi que ce soit.
**Contre** — le champ peut rester en retard sur la réalité, et c'est au rédacteur
de le mettre à jour.

## Décision

**Le fichier fait foi.**

Le critère qui tranche : que reste-t-il du référentiel quand la plateforme n'est
pas interrogeable ? Un statut dérivé disparaîtrait, alors même que le produit
promet une spécification qui reste lisible et exploitable en dehors de lui.

L'enseignement dépasse ce cas : **une donnée dérivée est un gain tant qu'elle
enrichit, un risque dès qu'elle porte seule une information.** L'histoire se
dérive parce que Git la porte de toute façon ; le statut ne se dérive pas parce
que rien d'autre ne le porterait.

La règle a été corrigée, et non contournée. Elle affirmait un comportement que le
produit n'a jamais eu — la laisser telle quelle aurait installé exactement la
divergence entre référentiel et réalité que l'outil sert à combattre.
