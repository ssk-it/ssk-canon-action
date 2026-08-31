---
id: 02-point-de-substitution
titre: Comment préparer le remplacement par l'identité fédérée ?
statut: retenue
option_retenue: service-dedie
---

## Description

Le secret personnel est une solution d'attente. Sa valeur dépend de ce qu'il en
coûtera de le remplacer : s'il faut alors reprendre l'application, on aura
travaillé pour rien.

## Options

### lecture-directe

Lire le secret depuis le stockage à l'endroit où l'on en a besoin.

**Pour** — le chemin le plus court.
**Contre** — disperse la connaissance du stockage dans l'application. Le
remplacement obligerait à retrouver chaque endroit, avec la certitude d'en
oublier un.

### service-dedie

**Retenue.** Un service unique détient le secret ; tout le reste l'interroge sans
savoir d'où il vient.

**Pour** — le remplacement se limite à changer l'origine du secret dans ce
service. Le reste de l'application ne change pas d'une ligne. Le service porte
aussi la notion de **source**, ce qui permettra de distinguer un secret personnel
d'un secret obtenu par le relais.
**Contre** — une indirection de plus, dont l'intérêt ne se voit qu'au moment du
remplacement.

## Décision

**Service dédié.**

C'est le prix minimal pour que cette étape soit une avance et non un détour.
L'indirection paraît gratuite aujourd'hui ; elle est la raison pour laquelle
l'étape d'identité fédérée sera une substitution et non une reprise.
