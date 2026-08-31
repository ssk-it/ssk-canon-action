---
id: 04-propagation-responsable
titre: Qui applique les impacts au référentiel ?
statut: retenue
option_retenue: automatisation-plateforme
---

## Description

Le socle prévoyait que l'application applique les impacts juste après avoir mergé
la pull request. Le défaut apparaît une fois nommé : si l'onglet se ferme entre le
merge et la propagation, le référentiel reste incohérent, et rien ne le rattrape.

## Options

### application-cliente

L'application applique les impacts après le merge.

**Pour** — tout le code reste dans un seul projet, un seul langage.
**Contre** — la cohérence du référentiel dépend d'un onglet resté ouvert. C'est
une dépendance inacceptable pour la donnée centrale du produit.

### automatisation-plateforme

**Retenue.** Une automatisation déclenchée par le merge applique les impacts.

**Pour** — s'exécute même si personne n'a l'application ouverte, laisse une trace
auditable, et rend la cohérence indépendante du client. La vérification
d'intégrité devient au passage un contrôle bloquant sur les pull requests :
l'erreur est signalée pendant la rédaction, pas découverte après coup.
**Contre** — du code métier hors du projet applicatif, donc deux logiques de
lecture du format à maintenir cohérentes.

### les-deux

L'automatisation fait foi, l'application sait rejouer une propagation manquante.

**Pour** — plus robuste.
**Contre** — la logique de propagation existe en double et doit rester
synchronisée. La complexité ne se justifie pas tant que l'automatisation seule
n'a pas montré ses limites.

## Décision

**Automatisation de la plateforme.** La cohérence du référentiel ne peut pas
dépendre de l'état d'un navigateur.

Le risque de divergence entre les deux parseurs est réel et assumé : un paquet
partagé serait plus propre, mais complique le montage tant que le format cherche
encore sa forme. À extraire quand il se sera stabilisé.
