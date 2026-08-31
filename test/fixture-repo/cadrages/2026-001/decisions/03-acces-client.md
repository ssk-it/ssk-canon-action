---
id: 03-acces-client
titre: Comment le client accède-t-il aux cadrages ?
statut: retenue
option_retenue: idp-plus-app-installee
---

## Description

Le produit se dit « partagé entre le client et l'équipe ». Or le contenu vit dans
un dépôt GitHub, et un client non-technique n'a pas de compte GitHub, ne
souhaitera pas en créer un, et ne générera certainement pas de jeton d'accès
personnel.

C'est la contradiction centrale de l'architecture : sans réponse, l'outil n'est
partagé qu'en théorie.

## Options

### depot-public-lecture-anonyme

Le dépôt est public ; le client consulte sans authentification. Seule l'écriture
demande un compte.

**Pour** — aucun composant serveur, vraiment zéro.
**Contre** — impose la publicité du contenu, inacceptable pour une spécification
client. Et le client ne peut ni commenter ni valider.

### jeton-personnel-par-utilisateur

Chacun colle son jeton dans l'application.

**Pour** — aucun serveur, écriture pour tous.
**Contre** — rédhibitoire pour un client non-technique. Écartée pour l'usage réel,
mais retenue comme étape transitoire du prototype.

### comptes-github-pour-tous

Le client crée un compte GitHub et est invité au dépôt.

**Pour** — tout fonctionne nativement, y compris les commentaires attribués.
**Contre** — demande au client une démarche qu'il ne fera pas. C'est reporter sur
lui la complexité de notre choix technique.

### idp-plus-app-installee

**Retenue.** Le fournisseur d'identité de l'organisation porte l'identité ; une
application installée sur le dépôt porte l'accès technique.

**Pour** — le client se connecte avec un compte de l'organisation, ou l'IdP de son
entreprise, et n'entend jamais parler de GitHub. L'accès au dépôt est indépendant
de tout utilisateur.
**Contre** — impose un composant serveur : la clé privée de l'application ne peut
pas vivre dans une page web. Il reste sans état et sans base de données, mais il
existe.

## Décision

**Identité et accès séparés.** La contrepartie — un composant serveur — est
acceptable parce qu'il reste sans état et sans base : le modèle de données reste
entièrement dans Git.

Un fournisseur d'identité étant déjà déployé dans l'organisation, le coût réel se
limite à un relais, pas à une infrastructure d'authentification.
