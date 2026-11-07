[Sommaire](../README.md#documentation) · [English](en/action.md)

# Entrées et sorties de l'action

## Entrées

| Entrée | Défaut | Rôle |
|---|---|---|
| `referentiel` | `.` | Chemin du référentiel, relatif à la racine du dépôt appelant. |
| `appliquer` | `false` | Écrire réellement. À `false`, signale sans modifier de fichier. |
| `commiter` | `false` | Commiter et pousser. Sans effet si `appliquer` est `false`. |
| `message` | `Propagation des impacts au référentiel` | Première ligne du message de commit. |
| `jeton-referentiels-cites` | — | Jeton en lecture seule sur les référentiels cités privés : voir [Citer un autre référentiel](citations.md). |

## Sorties

| Sortie | Rôle |
|---|---|
| `ecritures` | Nombre de règles écrites, ou qui le seraient en simulation. |
