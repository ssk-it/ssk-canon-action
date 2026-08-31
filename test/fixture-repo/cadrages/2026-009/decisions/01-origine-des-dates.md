---
id: 01-origine-des-dates
titre: D'où vient la date de création d'un cadrage ?
statut: retenue
option_retenue: deduite-de-l-historique
---

## Description

Afficher une date de création suppose de savoir où la prendre. Le référentiel
n'en porte aucune : c'est un choix fondateur, l'histoire se dérive et ne se
stocke pas.

La question est donc de savoir si ce choix tient face à un besoin concret, ou
s'il faut l'assouplir.

## Options

### stockee-dans-le-fichier

Ajouter un champ de date au cadrage, renseigné à sa création.

**Pour** — immédiat à l'affichage, sans aucun appel. Simple à comprendre.
**Contre** — crée une seconde source de vérité pour une information que
l'historique porte déjà. Un champ saisi une fois n'est jamais revérifié : il
suffit qu'un cadrage soit copié depuis un autre pour que la date mente
définitivement, sans que rien ne le signale.

### deduite-de-l-historique

**Retenue.** La date se déduit du premier changement enregistré sur le cadrage.

**Pour** — une seule source de vérité, impossible à désynchroniser. La date est
exacte par construction, y compris pour un cadrage créé par copie.
**Contre** — demande un appel supplémentaire par cadrage, et la date peut être
indisponible si cet appel échoue.

## Décision

**Déduite de l'historique.**

Le besoin ne justifie pas d'affaiblir l'invariant. Une date affichée est un
confort ; une source de vérité unique est ce qui rend le référentiel fiable sur
la durée.

La contrepartie — une date parfois absente — est acceptable dès lors que son
absence ne bloque rien, ce que la décision suivante garantit.
