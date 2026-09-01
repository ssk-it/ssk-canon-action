---
id: 2026-006
titre: Lecture du référentiel depuis un dépôt public
domaines: [persistance, referentiel, cadrage]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-chargement-hors-quota, operation: cree }
  - { regle: RG-divergence-enonce-visible, operation: cree }
  - { regle: RG-depot-choisi-memorise, operation: cree }
  - { regle: RG-regulation-appels, operation: modifie }
  - { regle: RG-index-recherche-client, operation: touche }
  - { regle: RG-enonces-dans-cadrage, operation: touche }
---

## Objectif

Rendre le référentiel consultable : naviguer des domaines aux fonctionnalités
puis aux règles, lire les cadrages avec leurs décisions et leurs impacts, et
remonter d'une règle vers le cadrage qui l'explique.

L'accès se fait sur un dépôt public, sans authentification. C'est un choix de
séquence, pas de cible : l'authentification viendra ensuite, et la couche d'accès
est isolée pour que cette substitution ne touche à rien d'autre.

Une mesure faite pendant la réalisation a modifié la conception. Le quota
d'appels sans authentification est de **soixante requêtes par heure et par
adresse IP**. Le référentiel de ce projet compte cinquante-huit fichiers :
charger chacun par l'API épuiserait le quota en une seule visite, et la seconde
échouerait. La stratégie a donc été revue — voir la décision associée.

## Parcours utilisateur

1. L'utilisateur ouvre l'application. Le dernier dépôt consulté est rechargé
   automatiquement, ou le dépôt par défaut à la première visite.
2. Il parcourt les domaines, entre dans l'un d'eux, et voit ses fonctionnalités
   avec le nombre de règles de chacune.
3. Depuis une fonctionnalité, il ouvre une règle et lit son énoncé courant.
4. Sous l'énoncé, il voit les cadrages qui ont touché cette règle, du plus récent
   au plus ancien, avec l'opération de chacun. Il déplie l'énoncé porté par un
   cadrage donné pour comparer.
5. S'il ouvre un cadrage, il en lit l'objectif, le parcours attendu, les
   décisions avec leurs options écartées, et les règles impactées.
6. À tout moment, il peut ouvrir un autre dépôt de projet en saisissant son nom.

## Énoncés

### RG-chargement-hors-quota

Le chargement d'un dépôt consomme **une seule requête de quota**, quel que soit
le nombre de fichiers.

L'arborescence est obtenue par un appel unique à l'API ; les contenus sont
ensuite récupérés par un canal non décompté du quota.

Cette contrainte n'est pas une optimisation mais une condition de
fonctionnement : le quota anonyme est de soixante requêtes par heure et par
adresse IP, alors qu'un référentiel de taille modeste compte déjà plusieurs
dizaines de fichiers.

### RG-divergence-enonce-visible

Lorsque l'énoncé porté par un cadrage diffère de l'énoncé courant de la règle,
l'application **signale l'écart et l'explique**.

Un cadrage porte le texte au moment de sa livraison ; un cadrage ancien énonce
donc légitimement un comportement depuis modifié. Sans explication, un lecteur
prend cette différence pour une incohérence.

### RG-depot-choisi-memorise

Le dépôt de projet est **saisi par l'utilisateur et mémorisé** par le navigateur.
Il n'est pas figé à la construction de l'application.

La saisie accepte un nom court `organisation/depot` comme une URL complète.

Une seule instance de l'application dessert ainsi plusieurs projets, et le
changement de dépôt ne demande aucun redéploiement.

### RG-regulation-appels

Les appels à l'API sont régulés **côté client**, par une file d'attente à
concurrence bornée, avec repli sur le délai d'attente indiqué par le serveur.

Les limites secondaires de la plateforme — requêtes concurrentes, écritures par
heure — s'appliquent au jeton d'accès, donc à l'installation entière : tous les
utilisateurs partagent le même budget. Le relais étant sans état, il ne peut pas
réguler.

**Les canaux non soumis à ces limites disposent de leur propre file, plus
large.** Les brider au même rythme que l'API ralentirait le chargement sans rien
protéger : mesuré, l'écart va du simple au double sur un référentiel de soixante
fichiers.

Corollaire pratique : les écritures sont groupées. Un enregistrement explicite ou
une temporisation longue, jamais un commit à chaque frappe.

