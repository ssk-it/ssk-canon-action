---
id: 03-derive-du-referentiel
titre: Comment détecter qu'une règle a été modifiée hors cadrage ?
statut: retenue
option_retenue: comparer-les-textes
---

## Description

La première exécution de la propagation a révélé trente-et-un écarts sur un
référentiel qui passait toutes les vérifications.

Les règles avaient été rédigées **en parallèle** des cadrages plutôt que dérivées
d'eux : chacune contenait davantage de texte que l'énoncé censé la porter. Le
référentiel n'était donc pas la projection de ses cadrages, contrairement à ce
qu'affirme le principe fondateur.

Le plus préoccupant est que rien ne le signalait. Les vérifications portaient sur
les références croisées — une règle inconnue, un rattachement invalide — et un
énoncé enrichi à la main ne rompt aucune référence.

## Options

### faire-confiance-au-processus

Considérer que si chacun passe par les cadrages, la dérive ne peut pas survenir.

**Pour** — aucun contrôle supplémentaire.
**Contre** — la dérive est survenue dès la constitution du référentiel, sans
intention de contourner quoi que ce soit. Un principe que rien ne vérifie n'est
pas un principe, c'est un souhait.

### interdire-l-edition-directe

Empêcher techniquement toute modification d'une règle hors propagation.

**Pour** — la dérive devient impossible.
**Contre** — irréalisable : les fichiers sont éditables par quiconque a accès au
dépôt, ce qui est une propriété voulue du support. Et la correction d'une
coquille deviendrait une procédure.

### comparer-les-textes

**Retenue.** Vérifier que le texte de chaque règle correspond à l'énoncé du
cadrage qui la porte, et signaler tout écart.

**Pour** — détecte la dérive quelle qu'en soit l'origine, y compris involontaire.
La vérification est le sous-produit gratuit de la propagation, qui calcule déjà
cet écart.
**Contre** — impose que les énoncés soient rigoureusement à jour dans les
cadrages, y compris pour une correction mineure.

## Décision

**Comparer les textes, et signaler.**

La contrainte est réelle : corriger une coquille dans une règle oblige désormais
à corriger aussi l'énoncé du cadrage. C'est le prix de la garantie, et il est
juste — une règle et son énoncé qui divergent, c'est exactement le problème que
le produit prétend résoudre chez ses utilisateurs.

Enseignement à retenir : **c'est en construisant le mécanisme qui applique un
principe qu'on découvre qu'on ne l'appliquait pas.** Aucune relecture n'aurait
trouvé ces trente-et-un écarts.
