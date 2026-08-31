---
id: 02-moment-du-chargement
titre: Quand obtenir les dates ?
statut: retenue
option_retenue: a-la-demande
---

## Description

Les dates venant de l'historique, chaque cadrage demande un appel. Reste à
choisir quand le faire.

L'enjeu n'est pas le temps d'attente mais le **budget d'appels** : un lecteur non
connecté dispose de soixante appels par heure, et le coût de cette
fonctionnalité croît avec le nombre de cadrages.

## Options

### au-chargement-du-referentiel

Obtenir toutes les dates en même temps que le contenu.

**Pour** — la liste est complète dès son affichage.
**Contre** — fait payer à **chaque** visite un coût proportionnel au nombre de
cadrages, y compris à qui ne consulte jamais la liste. Sur un référentiel qui
grandit, cette dépense augmente sans limite pour un affichage secondaire.

### a-la-demande

**Retenue.** Les dates sont demandées à l'affichage de la liste, pas avant.

**Pour** — la liste apparaît immédiatement et les dates la rejoignent. Qui ne va
pas sur cet écran ne paie rien. Le coût reste proportionnel à l'usage réel.
**Contre** — les dates apparaissent avec un léger décalage, et l'affichage se
complète sous les yeux du lecteur.

### jamais-dans-la-liste

Ne montrer la date qu'à l'ouverture d'un cadrage.

**Pour** — un seul appel, uniquement quand on ouvre une fiche.
**Contre** — ne répond pas au besoin : c'est en parcourant la liste qu'on veut
situer les cadrages les uns par rapport aux autres.

## Décision

**À la demande, à l'affichage de la liste.**

Le décalage est acceptable parce que la liste est utilisable sans les dates :
elles enrichissent la lecture, elles ne la conditionnent pas. L'inverse — une
liste qui attend ses dates pour s'afficher — aurait échangé un confort contre une
attente.
