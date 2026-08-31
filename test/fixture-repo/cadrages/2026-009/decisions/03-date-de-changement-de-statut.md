---
id: 03-date-de-changement-de-statut
titre: Faut-il afficher la date du dernier changement de statut ?
statut: annulee
---

## Description

La demande initiale portait sur deux repères temporels : la date de création, et
la date à laquelle le cadrage a pris son statut courant. Le second répondrait à
« depuis combien de temps ce cadrage attend-il en relecture ? », qui est une
question légitime.

## Pourquoi cette décision est annulée

**Aucune des sources disponibles ne donne cette date de façon à la fois exacte et
abordable.**

Trois voies ont été examinées :

- **Le dernier changement enregistré sur le cadrage** est une approximation : il
  est postérieur au changement de statut si le cadrage a été retouché depuis. Un
  repère temporel faux est pire qu'un repère absent, parce qu'on s'y fie.
- **Comparer les versions successives** pour repérer où le statut change donne la
  date exacte, mais coûte un appel par version de chaque cadrage — un coût qui
  croît avec l'histoire, pour une information d'appoint.
- **Les événements de la demande de fusion** sont la source juste, prévue par
  l'architecture. Mais elle suppose que les cadrages passent effectivement par ce
  circuit, ce qui n'est pas encore le cas.

La question est donc **reportée**, pas abandonnée. Elle se traitera naturellement
quand le cycle de vie s'appuiera sur les demandes de fusion : la date deviendra
alors exacte et disponible sans coût supplémentaire.

Conserver cette décision annulée évite qu'on repose la question dans six mois
sans savoir pourquoi elle avait été laissée de côté.
