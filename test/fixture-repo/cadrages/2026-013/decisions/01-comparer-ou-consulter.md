---
id: 01-comparer-ou-consulter
titre: Consulter le référentiel à une date, ou comparer deux états ?
statut: retenue
option_retenue: comparer-deux-etats
---

## Description

Le référentiel à une date passée était énoncé depuis le socle, sans avoir été
réalisé. Au moment de le faire, la question s'est posée autrement : à quoi
sert-on le lecteur ?

Consulter un état ancien suppose que le lecteur se souvienne de l'état courant
pour repérer ce qui a changé. Or c'est exactement le travail qu'il vient
déléguer — et celui qu'aucun outil ne fait pour lui aujourd'hui.

## Options

### bascule-globale

Un sélecteur de date dans la barre, faisant basculer toute la navigation dans le
passé : domaines, fonctionnalités, règles, cadrages.

**Pour** — fidèle à l'énoncé initial ; navigation complète dans un état ancien ;
un seul mécanisme pour toutes les vues.
**Contre** — le lecteur doit comparer de mémoire. Et un mode global qui altère
toutes les pages fait courir un risque permanent de lire un état ancien en le
croyant courant.

### page-de-consultation-datee

Une page séparée, listant le référentiel à une date choisie.

**Pour** — aucun risque de confusion avec l'état courant.
**Contre** — même défaut central : montre un état, pas un changement. Et perd la
navigation croisée qui fait l'intérêt d'une consultation.

### comparer-deux-etats

**Retenue.** Montrer ce qui a changé entre deux instants : règles ajoutées,
modifiées, abrogées, et cadrages livrés dans l'intervalle.

**Pour** — répond à la question réellement posée à chaque reprise de contact.
Le rapprochement avec les cadrages livrés dit non seulement ce qui a changé mais
pourquoi, ce qu'aucune comparaison de fichiers ne fait.
**Contre** — s'écarte de l'énoncé initial, qu'il faut donc corriger. Et coûte
deux reconstitutions au lieu d'une.

## Décision

**Comparer deux états.**

La consultation à un instant passé n'est pas abandonnée : elle est la brique sur
laquelle la comparaison est bâtie, et l'énoncé la conserve à ce titre. Ce qui
change, c'est qu'elle n'est pas exposée seule, faute de répondre à une question
que quelqu'un se pose.

Enseignement à retenir : **un énoncé ancien décrit ce qu'on savait vouloir au
moment où on l'a écrit.** Le réaliser est l'occasion de vérifier qu'il répond
encore à une question réelle — et le corriger vaut mieux que le servir
littéralement.
