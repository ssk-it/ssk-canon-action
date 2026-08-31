---
id: 2026-008
titre: Connexion facultative pour relever les limites d'appels
statut: livree
domaines: [acces, persistance]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-connexion-optionnelle, operation: cree }
  - { regle: RG-quota-signale-avant-epuisement, operation: cree }
  - { regle: RG-message-nomme-la-cause, operation: cree }
  - { regle: RG-secret-conserve-localement, operation: cree }
  - { regle: RG-chargement-hors-quota, operation: modifie }
  - { regle: RG-identite-separee, operation: touche }
  - { regle: RG-depot-choisi-memorise, operation: touche }
---

## Objectif

Lever la limite d'appels rencontrée en usage soutenu, sans attendre la mise en
place de l'identité fédérée.

Le constat est venu d'un incident concret : l'application s'est retrouvée bloquée
une heure, avec un message correct mais une cause mal comprise. La limite sans
connexion est de soixante appels par heure et par adresse ; se connecter la porte
à cinq mille.

Il faut souligner ce que l'incident n'était **pas** : l'application ne consomme
qu'un appel par chargement complet. Ce sont des vérifications répétées qui ont
épuisé le quota, pas un usage ordinaire. La correction ne vise donc pas à réparer
un défaut de conception, mais à supprimer un plafond gênant en développement et
à préparer l'écriture.

Ce cadrage prépare aussi le terrain : le mécanisme de connexion introduit ici est
celui que l'identité fédérée remplacera, sans que le reste de l'application
change.

## Parcours utilisateur

1. Un lecteur ouvre l'application et consulte un dépôt public sans rien saisir.
2. S'il enchaîne les consultations, un bandeau l'avertit que les appels restants
   s'épuisent et lui propose de se connecter.
3. Il ouvre la connexion, y lit quels droits sont nécessaires — la lecture seule
   suffit —, et saisit son secret.
4. L'application confirme la connexion en n'affichant que les derniers
   caractères du secret, assez pour le reconnaître.
5. S'il vient de livrer un cadrage et veut le voir immédiatement, il active
   l'option de chargement direct, qui affiche l'état réel du dépôt sans délai.
6. Si le secret est refusé, l'application le dit explicitement plutôt que
   d'évoquer une limite d'appels.
7. Il peut se déconnecter à tout moment ; l'application revient au mode
   consultation.

## Énoncés

### RG-connexion-optionnelle

La consultation d'un dépôt public **ne demande aucune connexion**.

Se connecter reste possible et relève trois limites : le nombre d'appels
autorisés par heure, l'accès aux dépôts privés, et — plus tard — l'écriture.

L'ordre est délibéré : un client qui reçoit un lien doit pouvoir lire
immédiatement. Exiger une authentification pour afficher un contenu public
placerait un obstacle à l'endroit exact où le produit doit être le plus
accueillant.

### RG-quota-signale-avant-epuisement

Lorsque le nombre d'appels restants approche de zéro, l'application **le signale
et propose de se connecter**, sans attendre l'échec.

Une fois la limite atteinte, plus rien ne se charge pendant une heure. Prévenir
pendant qu'il reste une marge coûte un bandeau ; ne pas prévenir coûte une heure
d'indisponibilité que l'utilisateur ne comprend pas.

### RG-message-nomme-la-cause

Un message d'erreur **nomme la cause réelle** et indique quoi faire.

Deux causes distinctes ne partagent jamais un message : un jeton refusé et une
limite d'appels atteinte se ressemblent — l'application est bloquée dans les deux
cas — mais la première se corrige en quelques secondes tandis que la seconde
demande d'attendre. Les confondre envoie chercher au mauvais endroit.

Le message tient compte de l'état : introuvable **sans** connexion suggère de
vérifier que le dépôt est public ; introuvable **avec** connexion suggère de
vérifier que les droits couvrent ce dépôt.

### RG-secret-conserve-localement

Un secret saisi par l'utilisateur est **conservé par son navigateur** et n'est
transmis qu'à GitHub.

L'application n'en affiche jamais que les derniers caractères, assez pour
reconnaître lequel est en place, jamais assez pour le recopier.

Elle indique au moment de la saisie quels droits sont réellement nécessaires, et
permet de se déconnecter à tout moment. Tant que l'application ne fait que lire,
elle demande un accès en lecture seule.

### RG-chargement-hors-quota

Le chargement d'un dépôt consomme **une seule requête décomptée**, quel que soit
le nombre de fichiers.

L'arborescence est obtenue par un appel unique ; les contenus sont ensuite
récupérés par un canal non décompté.

Cette contrainte n'est pas une optimisation mais une condition de
fonctionnement : sans connexion, la limite est de soixante appels par heure,
alors qu'un référentiel modeste compte déjà plusieurs dizaines de fichiers.

**Le canal des contenus peut être basculé sur celui de l'arborescence**, au prix
d'un appel par fichier. Ce mode répond à deux besoins : les dépôts privés, que le
canal ordinaire ne dessert pas, et l'affichage immédiat de ce qui vient d'être
livré. Il n'a de sens qu'une fois connecté et reste désactivé par défaut.

