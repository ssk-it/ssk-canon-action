---
id: 01-source-de-la-chronologie
titre: Sur quoi fonder la chronologie d'une règle ?
statut: retenue
option_retenue: superposer-les-deux
---

## Description

La chronologie doit répondre à deux questions : quelles décisions ont façonné
cette règle, et quand ces changements ont-ils eu lieu.

Une mesure faite sur le référentiel de référence a rendu le choix moins évident
qu'il n'y paraissait : **aucune règle n'y a plus de deux versions enregistrées**,
alors que les cadrages en décrivent davantage. La cause est structurelle — les
premiers cadrages décrivent des décisions antérieures au dépôt, écrites après
coup en une seule fois.

Un dépôt de projet ordinaire n'aura pas ce défaut : chaque cadrage y arrive par
une demande de fusion, à sa date. Mais la vue doit servir les deux cas.

## Options

### depot-seul

Ne montrer que ce que l'histoire du dépôt porte.

**Pour** — rigoureusement exact, chaque entrée est vérifiable.
**Contre** — affiche une entrée là où quatre cadrages ont touché la règle. Le
lecteur en conclut que le référentiel oublie des décisions, alors qu'elles sont
là — simplement pas dans le dépôt.

### cadrages-seuls

Se passer de l'histoire du dépôt, et déduire la chronologie des seuls fichiers.

**Pour** — aucun appel supplémentaire, fonctionne sans connexion.
**Contre** — perd la date réelle, l'auteur et la demande de fusion, c'est-à-dire
tout ce que la règle exige et que les fichiers ne portent pas. Y renoncer
reviendrait à stocker l'histoire dans les fichiers, ce que le produit s'interdit.

### reconstruire-l-histoire

Réécrire l'histoire du dépôt de référence pour la faire correspondre aux
cadrages, en rejouant chacun à sa date.

**Pour** — une seule source, riche et cohérente.
**Contre** — les dates seraient fabriquées : les fichiers n'existent que depuis
leur rédaction. Cela contredit le principe selon lequel l'histoire se dérive et
ne se stocke pas. Et cela corrigerait le jeu de test sans corriger le produit,
masquant un cas qui se présentera chez un utilisateur.

### superposer-les-deux

**Retenue.** Les cadrages fondent la chronologie, l'histoire du dépôt l'enrichit
lorsqu'elle le peut.

**Pour** — aucune décision ne disparaît, et chaque entrée porte tout ce qui est
connu d'elle. La même vue sert un référentiel écrit après coup et un dépôt de
projet ordinaire.
**Contre** — impose un appariement, donc une correspondance qui peut échouer, et
un affichage à deux niveaux de complétude.

## Décision

**Superposer, en fondant sur les cadrages.**

Le critère qui tranche : que se passe-t-il quand les deux sources divergent ?
Fonder sur le dépôt fait disparaître des décisions réelles ; fonder sur les
cadrages laisse au pire une entrée moins renseignée. Une information manquante
se voit et s'explique ; une information absente ne se voit pas.

Enseignement à retenir : **une source d'autorité se choisit sur son comportement
en cas de manque, pas sur sa richesse en cas idéal.**
