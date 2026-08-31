---
id: 02-regulation-par-canal
titre: Faut-il réguler les deux canaux au même rythme ?
statut: retenue
option_retenue: deux-files-distinctes
---

## Description

La régulation des appels côté client est un invariant : les limites secondaires
de la plateforme s'appliquent au jeton, donc à tous les utilisateurs d'une
installation, et un relais sans état ne peut pas les faire respecter.

Mais les deux canaux de chargement n'ont pas les mêmes contraintes. L'API est
soumise à ces limites ; le canal de contenus ne l'est pas.

## Options

### file-unique

Une seule file, réglée sur la contrainte la plus stricte.

**Pour** — un seul réglage à comprendre et à maintenir.
**Contre** — brider le canal non contraint ne protège rien et ralentit le
chargement. Mesuré : le temps de chargement double.

### deux-files-distinctes

**Retenue.** Une file prudente pour l'API, une file plus large pour les contenus.

**Pour** — chaque canal est réglé sur sa contrainte réelle. Le gain est mesurable
et sans contrepartie sur le respect des limites.
**Contre** — deux valeurs à régler au lieu d'une, et le risque d'oublier
pourquoi elles diffèrent — d'où la présente décision.

## Décision

**Deux files distinctes.**

Un réglage uniforme aurait eu l'apparence de la prudence sans en avoir l'effet :
il n'aurait rien protégé de plus, et aurait dégradé l'expérience de consultation
qui est la première chose que voit un utilisateur.
