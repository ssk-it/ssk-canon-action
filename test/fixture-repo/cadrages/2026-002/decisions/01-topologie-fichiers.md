---
id: 01-topologie-fichiers
titre: Où rangeons-nous les règles de gestion ?
statut: retenue
option_retenue: regles-a-plat
---

## Description

L'arborescence envisagée au socle rangeait les règles sous leur fonctionnalité :
`features/<slug>/rules/<id>.md`. La vérification des capacités de la plateforme
révèle qu'aucune API ne suit les renommages — ni le paramètre `path` en REST, ni
`history(path:)` en GraphQL n'ont d'équivalent à `git log --follow`.

Conséquence directe : un fichier déplacé ou renommé perd **tout son historique
visible depuis l'application**. Or renommer une fonctionnalité, ou déplacer une
règle quand le découpage fonctionnel évolue, sont des opérations normales dans la
vie d'un projet.

## Options

### hierarchie-lisible

Conserver la hiérarchie pour la lisibilité sur github.com, en acceptant la perte
d'historique lors des renommages.

**Pour** — l'arborescence raconte le modèle ; un visiteur comprend la structure
sans ouvrir l'application.
**Contre** — la perte d'historique frappe exactement ce que le produit promet de
préserver. Et elle est silencieuse : rien ne signale que l'histoire a disparu.

### hierarchie-plus-journal

Conserver la hiérarchie, et maintenir un fichier de correspondance des chemins
successifs pour recoller l'historique.

**Pour** — garde la lisibilité tout en préservant l'histoire.
**Contre** — réintroduit une donnée à maintenir cohérente, ce que l'on cherche
précisément à éviter. Un journal de renommages qui diverge est pire que pas de
journal.

### regles-a-plat

**Retenue.** Les règles vivent à plat dans `rules/`, les fonctionnalités à plat
dans `features/`, et le rattachement passe en frontmatter.

**Pour** — le chemin ne bouge jamais, donc l'historique survit à toute
réorganisation fonctionnelle. Le rattachement devient une **donnée modifiable**
plutôt qu'une position figée. Bénéfice inattendu : une règle peut appartenir à
plusieurs fonctionnalités, comme une fonctionnalité appartient à plusieurs
domaines — le modèle y gagne en cohérence.
**Contre** — l'arborescence GitHub est moins parlante ; la navigation devient le
travail de l'application.

## Décision

**Règles à plat, rattachement en donnée.** La lisibilité de l'arborescence est un
confort ; la durabilité de l'historique est la promesse du produit. Quand les deux
s'opposent, la promesse gagne.

La règle générale qui en découle : **dans ce dépôt, un chemin ne se renomme
jamais.** Elle s'applique aussi aux dossiers de cadrage, qui portent l'identifiant
seul — un titre se reformule en cours de rédaction.
