---
id: 02-bibliotheque-frontmatter
titre: Quelle bibliothèque pour découper le frontmatter ?
statut: retenue
option_retenue: yaml-seul
---

## Description

Le découpage frontmatter / corps est une opération élémentaire, mais suffisamment
répétée pour mériter un choix explicite.

## Options

### bibliotheque-dediee

Une bibliothèque spécialisée dans le frontmatter, qui fait le découpage et le
parsing en un appel.

**Pour** — une ligne de code, cas limites déjà traités.
**Contre** — conçue pour un environnement serveur, elle tire des dépendances
inutiles et se comporte mal dans un navigateur. Sa commodité ne survit pas au
contexte réel d'exécution.

### yaml-seul

**Retenue.** Une expression régulière pour séparer les deux parties, et une
bibliothèque YAML pour le frontmatter.

**Pour** — fonctionne à l'identique dans les deux environnements d'exécution, ce
qui sert directement l'objectif de non-divergence. Quelques lignes de code, sans
zone d'ombre.
**Contre** — les cas limites sont à notre charge : retours chariot, absence de
frontmatter, YAML invalide.

## Décision

**YAML seul.** Le découpage tient en une expression régulière, et l'uniformité
entre les deux implémentations vaut mieux que la commodité d'un appel unique.

Enseignement de la mise en œuvre : la première expression régulière écrite
utilisait une syntaxe empruntée à un autre langage et ne correspondait à rien
silencieusement. C'est précisément le genre de défaut qu'un jeu de test attrape et
qu'une relecture laisse passer.
