---
id: 2026-010
titre: Mécanique de la propagation des impacts
domaines: [cadrage, referentiel]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-propagation-idempotente, operation: cree }
  - { regle: RG-propagation-tout-ou-rien, operation: cree }
  - { regle: RG-derive-detectee, operation: cree }
  - { regle: RG-index-non-bloquants, operation: cree }
  - { regle: RG-propagation-livraison, operation: modifie }
  - { regle: RG-referentiel-projection, operation: touche }
  - { regle: RG-verification-integrite, operation: touche }
  - { regle: RG-histoire-derivee, operation: touche }
---

## Objectif

Rendre effective la propagation des impacts au référentiel, jusqu'ici décrite
mais non réalisée.

Le principe était posé dès le socle : à la livraison d'un cadrage, ses impacts
s'appliquent au référentiel. Restait à décider **comment**, et ces choix ont des
conséquences que la description initiale ne pouvait pas anticiper.

Sa première exécution a livré un enseignement qui dépasse la mécanique : le
référentiel avait **dérivé** de ses cadrages sans que rien ne le signale. Chaque
règle contenait plus de texte que l'énoncé censé la porter, parce qu'elles
avaient été rédigées en parallèle plutôt que dérivées. Aucun contrôle ne pouvait
le voir, les vérifications portant sur les références croisées et jamais sur les
textes.

Ce constat justifie à lui seul l'existence de la propagation : au-delà d'écrire,
elle **mesure** l'écart entre ce que le référentiel affirme et ce que ses
cadrages ont décidé.

## Parcours utilisateur

1. Un cadrage est livré. La propagation s'exécute et applique ses impacts au
   référentiel.
2. Les écritures forment un enregistrement distinct de la livraison : l'un porte
   l'intention rédigée, l'autre l'écriture faite par la machine.
3. Si un impact est incohérent — règle inconnue, énoncé manquant — rien n'est
   écrit et l'échec est visible. Le référentiel reste dans son état précédent.
4. Relancer la propagation sur un référentiel conforme ne produit aucune
   écriture : elle peut être rejouée sans précaution.
5. À tout moment, une vérification indique si le référentiel a dérivé de ses
   cadrages — y compris par une modification directe d'un énoncé.

## Énoncés

### RG-propagation-idempotente

La propagation **compare l'état déclaré par les cadrages livrés à l'état réel du
référentiel**, et n'écrit que l'écart. Elle ne rejoue pas un historique.

Il en découle qu'appliquée à un référentiel déjà conforme, elle n'écrit rien. On
peut donc la relancer sans risque : après un échec, après une correction
manuelle, ou pour rattraper une livraison dont la propagation aurait été manquée.

Une propagation qu'on hésite à relancer est une propagation qu'on n'ose pas
utiliser quand elle est justement nécessaire.

### RG-propagation-tout-ou-rien

La propagation calcule **toutes** les écritures avant d'en appliquer aucune. Une
incohérence l'interrompt avant la première écriture.

Le référentiel reste alors dans son état précédent, qui est cohérent, plutôt que
dans un état intermédiaire que personne n'a décidé et dont le rattrapage serait
manuel.

Un référentiel à demi propagé serait plus difficile à réparer qu'un référentiel
non propagé, parce que rien n'indiquerait où la propagation s'est arrêtée.

### RG-derive-detectee

Une vérification signale tout **écart entre le référentiel et les cadrages qui le
produisent**, y compris sur le texte des énoncés.

Sans elle, une règle enrichie directement — sans passer par un cadrage — reste
indétectable : les contrôles de cohérence portent sur les références croisées, et
un énoncé modifié à la main ne rompt aucune référence.

C'est la dérive la plus insidieuse, parce qu'elle ne produit aucun symptôme : le
référentiel paraît juste, et cesse simplement d'être la projection de ses
cadrages. La promesse du produit s'éteint sans que rien ne s'allume.

### RG-index-non-bloquants

Les contrôles portant sur les **index dérivés** — les champs qui rappellent quels
cadrages ont créé ou modifié une règle — s'appliquent à la relecture humaine,
jamais à la propagation.

Ces champs sont écrits par la propagation elle-même. Exiger qu'ils soient déjà
corrects avant de propager rendrait toute désynchronisation impossible à
corriger : la propagation serait bloquée par ce qu'elle est précisément chargée
de réparer.

Principe général : un contrôle ne doit jamais porter sur ce que l'opération
contrôlée est censée produire.

### RG-propagation-livraison

À la livraison d'un cadrage, ses impacts sont appliqués au référentiel
**automatiquement**, dans un enregistrement distinct de celui de la livraison.

La séparation est délibérée : la livraison porte l'intention rédigée par un
humain, l'enregistrement suivant porte l'écriture faite par la machine. Les
distinguer rend l'historique lisible et permet de rejouer une propagation sans
toucher au cadrage.

L'ordre d'application suit celui des identifiants de cadrage, qui portent l'année
et la séquence : quand plusieurs cadrages touchent une même règle, **le dernier
livré fait foi** sur son énoncé. Les cadrages antérieurs conservent le leur, qui
témoigne de l'état de la règle à leur époque.
