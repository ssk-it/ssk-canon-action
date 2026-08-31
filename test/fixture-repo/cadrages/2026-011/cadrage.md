---
id: 2026-011
titre: Distribution de l'automatisation aux dépôts cadrés
statut: livree
domaines: [cadrage, referentiel, acces]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon-action' }
impacts:
  - { regle: RG-automatisation-distribuee, operation: cree }
  - { regle: RG-automatisation-versionnee, operation: cree }
  - { regle: RG-regle-rattachee-obligatoire, operation: cree }
  - { regle: RG-verification-integrite, operation: modifie }
  - { regle: RG-referentiel-projection, operation: touche }
  - { regle: RG-propagation-livraison, operation: touche }
---

## Objectif

Rendre l'automatisation — vérification d'intégrité et propagation — utilisable
par un dépôt cadré quelconque, y compris hors de l'organisation qui développe
l'outil.

La mécanique était prête et éprouvée, mais inaccessible. Un fait de la plateforme
l'interdisait : une automatisation hébergée dans un dépôt privé n'est
référençable que depuis un dépôt de la même organisation. Le réglage de partage
n'offre aucun cran pour une organisation tierce — ni pour un client, donc.

La question posée était de distribution, mais elle a fait remonter une question
de fond : **qu'est-ce qui, dans ce produit, doit être ouvert ?** La réponse tient
en une phrase — ce qui doit tourner chez l'utilisateur est ouvert, ce qui tourne
chez l'éditeur reste fermé.

## Parcours utilisateur

1. Un projet veut être cadré. Il copie deux workflows dans son dépôt et les
   fait pointer vers l'automatisation publiée.
2. Aucune autorisation n'est à demander, aucun jeton à installer : l'outil est
   public, donc atteignable depuis n'importe quelle organisation.
3. Il fige la version qu'il consomme, ou suit la dernière — c'est son choix, pas
   celui de l'éditeur.
4. À l'ouverture d'une pull request, la vérification s'exécute et bloque le merge
   d'un cadrage incohérent.
5. À la livraison, la propagation applique les impacts au référentiel.
6. Le référentiel reste lisible, en clair, dans le dépôt du projet — y compris
   si celui-ci cesse d'utiliser l'outil.

## Énoncés

### RG-automatisation-distribuee

L'automatisation du cadrage — vérification d'intégrité et propagation — est
**publiée séparément de l'application**, sous une licence ouverte.

Elle s'exécute chez l'utilisateur, sur son dépôt, dans son environnement
d'intégration continue. Une automatisation qui s'exécute chez l'utilisateur mais
qu'il ne peut ni lire ni atteindre est une dépendance opaque au cœur de son
processus de livraison.

La contrainte qui l'impose est vérifiée : une automatisation hébergée dans un
dépôt fermé n'est référençable que depuis la même organisation. La rendre
publique supprime la question plutôt que de la contourner — un dépôt cadré peut
appartenir à qui veut.

Le partage suit la nature de ce qui est distribué, non la commodité du
découpage : ce qui tourne chez l'utilisateur lui est accessible, ce qui tourne
chez l'éditeur ne l'est pas.

### RG-automatisation-versionnee

Un dépôt cadré consomme une **version désignée** de l'automatisation, jamais un
état mouvant sans nom.

Deux formes coexistent : une version figée, qui ne change jamais et permet
d'épingler ; un alias de version majeure, qui suit les corrections compatibles.
Le dépôt cadré choisit laquelle il consomme.

Sans cela, une modification de l'automatisation change le comportement de tous
les dépôts cadrés à leur prochaine livraison, sans que personne l'ait demandé.
C'est précisément la dérive silencieuse que le produit s'emploie à rendre
visible ailleurs : elle ne serait pas plus acceptable dans son propre outillage.

### RG-regle-rattachee-obligatoire

Une règle de gestion rattachée à **aucune fonctionnalité** empêche la livraison.

Le référentiel se parcourt par domaines, puis par fonctionnalités, puis par
règles. Une règle qui ne se rattache à rien n'apparaît sur aucun chemin : elle
existe dans le dépôt et nulle part dans le produit.

Le contrôle était un simple avertissement, et la propagation ne le rattrapait
pas — son garde-fou ne se déclenche que si le fichier de la règle est absent, pas
s'il est présent et orphelin. Une règle pouvait donc être livrée introuvable.

Une règle que personne ne peut atteindre n'a pas d'existence utile. Mieux vaut
refuser la livraison que produire un référentiel dont une partie est invisible.

### RG-verification-integrite

Une vérification d'intégrité s'exécute à l'ouverture et à chaque modification
d'une pull request. Une erreur **empêche le merge**.

Elle contrôle ce que le format seul ne peut pas garantir : un impact référençant
une règle inexistante, un identifiant dupliqué, un énoncé manquant pour un impact
`cree` ou `modifie`, une règle abrogée par un cadrage non livré, un rattachement
vers une entité inconnue, une règle rattachée à aucune fonctionnalité.

Une règle créée par un cadrage encore en relecture n'existe pas dans le
référentiel : c'est normal, et la vérification ne l'exige qu'à la livraison.

La distinction entre ce qui bloque et ce qui informe est un choix, pas un défaut
de rigueur : bloque ce qui rendrait le référentiel faux ou inatteignable,
informe ce qui relève de l'incomplétude passagère d'un travail en cours.
