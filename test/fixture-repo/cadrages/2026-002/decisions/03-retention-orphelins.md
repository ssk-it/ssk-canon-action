---
id: 03-retention-orphelins
titre: Que faire des pièces jointes orphelines ?
statut: retenue
option_retenue: preserver-main-et-tags
---

## Description

Quand une branche de cadrage est abandonnée, ses pièces jointes deviennent
orphelines. Le dilemme est structurel et n'a pas de solution parfaite : **la
rejouabilité intégrale de l'historique et le bornage du stockage sont mutuellement
exclusifs.**

## Options

### ne-jamais-supprimer

Conserver tout objet téléversé, indéfiniment.

**Pour** — tout commit de tout l'historique reste rejouable. Aucun risque de
casser quoi que ce soit.
**Contre** — le stockage croît sans borne, y compris des essais abandonnés qui
n'ont jamais rien signifié.

### collecter-agressivement

Supprimer tout objet non référencé par l'état courant.

**Pour** — stockage minimal.
**Contre** — casse l'historique : revenir à un commit ancien ne retrouverait plus
ses maquettes. Contredit directement la promesse du produit.

### preserver-main-et-tags

**Retenue.** Ne jamais supprimer ce qui est référencé par la branche principale ou
par un tag ; appliquer une rétention au reste.

**Pour** — la rejouabilité est garantie sur ce qui compte, et le stockage reste
borné sur ce qui ne compte pas. Le gisement principal est d'ailleurs sans risque :
les fichiers téléversés puis jamais commités, quand quelqu'un joint une pièce puis
change d'avis avant d'enregistrer.
**Contre** — un cadrage abandonné après plusieurs commits perd ses pièces jointes
passé le délai de rétention. Acceptable : un cadrage abandonné n'a pas vocation à
être rejoué.

## Décision

**Préserver ce qui est référencé par la branche principale et les tags.**

Deux garde-fous obligatoires, appris de systèmes comparables :

Le **comptage de références doit être global au dépôt**, jamais local à un
cadrage. La déduplication par hash fait que plusieurs cadrages partagent souvent
le même objet ; supprimer « les pièces jointes du cadrage X » casserait celles du
cadrage Y.

Une **période de grâce** s'impose : ne jamais collecter un objet créé depuis moins
de vingt-quatre heures. Sans elle, une collecte concurrente d'un téléversement en
cours produirait un pointeur mort.
