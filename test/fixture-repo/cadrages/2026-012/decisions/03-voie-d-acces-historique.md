---
id: 03-voie-d-acces-historique
titre: Par quelle voie interroger l'histoire du dépôt ?
statut: retenue
option_retenue: voie-a-cout-mesure
---

## Description

Les deux voies d'accès de la plateforme n'ont ni le même coût ni les mêmes
possibilités. L'arborescence impose déjà la première ; l'historique posait la
question à nouveau.

La mesure faite sur le référentiel de référence tranche nettement : l'historique
complet d'une règle — dates, auteurs, demandes de fusion — coûte **une unité de
budget** par la voie retenue, contre un appel par changement enregistré par
l'autre. Les deux budgets sont distincts et cumulables.

Une contrainte a été découverte au même moment : cette voie **refuse toute
requête anonyme**, y compris sur un dépôt public. Elle n'est donc pas
interchangeable avec l'autre.

## Options

### voie-ordinaire

Utiliser la même voie que le chargement de l'arborescence.

**Pour** — déjà en place, accepte les requêtes anonymes, code inchangé.
**Contre** — un appel par changement, puis un appel par contenu de version. Sur
une règle à dix versions, le budget d'une consultation non connectée y passe
presque entièrement.

### voie-a-cout-mesure

**Retenue.** La voie qui rend l'historique complet en une requête.

**Pour** — coût mesuré à une unité quel que soit le nombre de versions ; budget
distinct de celui de l'autre voie, donc consommation sans effet sur le
chargement du référentiel.
**Contre** — refuse l'anonyme, ce qui contraint la vue à demander une connexion.
Et ses erreurs arrivent dans une réponse par ailleurs normale, ce que le
traitement d'erreurs existant ne voyait pas.

## Décision

**La voie à coût mesuré, avec la contrainte de connexion qu'elle impose.**

Le rapport est trop net pour hésiter : une unité contre plusieurs dizaines. La
contrainte d'authentification est réelle, mais elle ne ferme aucune porte
puisque le reste de la vue demeure accessible sans connexion.

Deux constats vérifiés valent d'être conservés :

- **Un accès en lecture seule suffit.** Aucune permission supplémentaire n'est
  nécessaire, y compris pour les demandes de fusion. La consigne donnée à
  l'utilisateur — n'accorder que la lecture — reste juste.
- **Une erreur peut arriver dans une réponse en apparence normale.** Le
  traitement d'erreurs habituel ne la voit pas : il faut l'inspecter dans le
  contenu de la réponse, faute de quoi un refus se présente comme un résultat
  vide.
