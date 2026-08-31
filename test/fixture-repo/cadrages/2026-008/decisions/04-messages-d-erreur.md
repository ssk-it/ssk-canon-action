---
id: 04-messages-d-erreur
titre: Deux causes différentes peuvent-elles partager un message ?
statut: retenue
option_retenue: un-message-par-cause
---

## Description

Le mécanisme de connexion introduit une nouvelle cause d'échec : un secret
refusé. Or l'application affichait déjà un message pour la limite d'appels
atteinte, et les deux situations se ressemblent de l'extérieur — plus rien ne se
charge.

Sans traitement distinct, un secret expiré aurait affiché « la limite d'appels
est atteinte, elle se réinitialise dans une heure ». L'utilisateur aurait attendu
une heure pour rien, puis constaté que rien n'avait changé.

## Options

### message-generique

Un message unique couvrant les cas de blocage.

**Pour** — un seul texte à écrire et à maintenir.
**Contre** — envoie chercher au mauvais endroit. Un message qui décrit une cause
fausse est pire qu'un message vague : il inspire confiance en désignant une
piste inexistante.

### un-message-par-cause

**Retenue.** Chaque cause a son message, qui nomme le problème et indique quoi
faire.

**Pour** — le lecteur sait immédiatement s'il doit corriger quelque chose ou
attendre. Le message tient compte de l'état : la même erreur d'accès se formule
différemment selon qu'on est connecté ou non.
**Contre** — plus de textes à écrire, et à revoir quand les causes évoluent.

## Décision

**Un message par cause.**

Le principe dépasse ce cadrage et devient une règle du produit : deux causes
distinctes ne partagent jamais un message.

Enseignement de la mise en œuvre : ce défaut n'est apparu qu'en provoquant un
vrai refus. Un message d'erreur qui n'a jamais été déclenché en conditions
réelles est une hypothèse, pas une fonctionnalité.
