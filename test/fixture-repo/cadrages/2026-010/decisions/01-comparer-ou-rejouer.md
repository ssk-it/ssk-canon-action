---
id: 01-comparer-ou-rejouer
titre: La propagation rejoue-t-elle l'historique ou compare-t-elle les états ?
statut: retenue
option_retenue: comparer-les-etats
---

## Description

Deux façons d'appliquer les impacts d'un cadrage. On peut **rejouer** chaque
livraison dans l'ordre, en appliquant ses effets successivement. On peut aussi
**calculer** l'état que le référentiel devrait avoir et n'écrire que la
différence.

Le choix paraît technique. Il détermine en réalité si la propagation est
rejouable, donc si on ose s'en servir.

## Options

### rejouer-les-livraisons

Appliquer les effets de chaque cadrage livré, dans l'ordre.

**Pour** — reproduit fidèlement le déroulement. Facile à expliquer : « le
référentiel est ce que les cadrages en ont fait ».
**Contre** — écrit systématiquement, même quand rien n'a changé. Deux
propagations successives produisent donc deux séries d'écritures identiques, ce
qui pollue l'historique. Et relancer devient risqué : on ne sait pas ce qu'on
écrase.

### comparer-les-etats

**Retenue.** Calculer l'état attendu, le comparer au réel, n'écrire que l'écart.

**Pour** — appliquée à un référentiel conforme, la propagation n'écrit rien. Elle
devient donc rejouable sans précaution : après un échec, après une correction
manuelle, pour rattraper une livraison manquée. Bénéfice inattendu : elle
**mesure** l'écart, ce qui en fait aussi un outil de détection.
**Contre** — l'état attendu doit être calculable entièrement à partir des
cadrages livrés, ce qui interdit toute écriture qui ne serait pas déductible.

## Décision

**Comparer les états.**

L'argument décisif n'est pas la propreté de l'historique mais la confiance : une
propagation qu'on hésite à relancer est une propagation qu'on n'ose pas utiliser
au moment où elle serait nécessaire.

Le bénéfice de détection s'est révélé immédiatement décisif — voir la décision
sur la dérive.
