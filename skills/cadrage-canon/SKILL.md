---
name: cadrage-canon
description: Rédige un cadrage dans le référentiel SSK Canon du projet courant — l'unité de changement datée qui décrit ce qu'on veut faire, pourquoi, et quelles règles de gestion en découlent. Le référentiel vit dans un dépôt à part, que ce skill trouve seul. À utiliser quand l'utilisateur dit "cadre cette évolution", "rédige le cadrage", "consigne cette décision", ou avant d'ouvrir un chantier dont les règles métier ne sont pas encore posées.
---

# Rédiger un cadrage

Un projet cadré tient son référentiel dans un **dépôt à part** de son code. C'est
là qu'un cadrage s'écrit — jamais dans le dépôt de code. Le référentiel comble le
vide entre l'expression succincte d'un besoin et sa réalisation : ce que le
produit fait, et les décisions qui l'ont amené là.

## 0. Se situer

**Toujours commencer par là.** Le dépôt de cadrage n'est pas celui d'où ce skill
est invoqué, et un projet peut être composé de plusieurs dépôts de code.

Exécuter, et lire la sortie :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/situer.mjs
```

Ce que sa sortie signifie :

| Ligne | Ce qu'elle dit |
|---|---|
| `CADRAGE_RETENU <chemin>` | le dépôt de cadrage à employer — **tous les chemins de ce skill s'y rapportent** |
| `PROJET <nom> \| <chemin>` | un projet déclaré, avec ses dépôts de code |
| `DEPOT_CODE <repo>` | un dépôt que ce projet réalise — utile pour explorer le code au-delà du dépôt courant |
| `ARRET <niveau>` | **jusqu'où aller à l'étape 7** — voir « Jusqu'où livrer » |
| `PLUSIEURS_PROJETS_DECLARENT_CE_DEPOT <n>` | **demander lequel** — voir « Quand la situation échoue » |
| `CANDIDAT <nom> \| <chemin>` | l'un des référentiels possibles, à soumettre au choix |
| `AUCUN_PROJET_NE_DECLARE_CE_DEPOT` | voir « Quand la situation échoue » |
| `CONFIG_ABSENTE <chemin>` | voir « Quand la situation échoue » |

Le dépôt courant se reconnaît à son `origin` : **rien n'est à configurer dans un
dépôt de code.** C'est le `ssk-canon.yml` du référentiel qui déclare les dépôts
de code du projet, et `~/.claude/cadrage-canon.json` qui dit où les référentiels
sont clonés sur cette machine.

### Explorer l'ensemble du projet

Les `DEPOT_CODE` listés sont les dépôts qui composent le projet. Un cadrage porte
sur le produit, non sur un dépôt : pour comprendre ce qui existe déjà, chercher
dans **tous** ceux qui sont clonés à côté, pas seulement celui d'où l'on part.
Une règle de gestion se réalise souvent dans plusieurs à la fois — une saisie
côté application web, sa validation côté API.

### Quand la situation échoue

- **`CONFIG_ABSENTE`** — créer `~/.claude/cadrage-canon.json` :
  ```json
  { "projets": ["~/chemin/vers/le-depot-de-cadrage"] }
  ```
  Un chemin par projet cadré. Ce fichier ne décrit que cette machine ; il ne se
  commite nulle part.

- **`AUCUN_PROJET_NE_DECLARE_CE_DEPOT`** — le référentiel ne déclare pas encore
  ce dépôt de code. L'ajouter à son `ssk-canon.yml` :
  ```yaml
  depots_code:
    - { repo: organisation/depot-front, role: Application web }
    - { repo: organisation/depot-back, role: API }
  ```
  Le déclarer là plutôt que dans chaque dépôt de code évite d'écrire *n* fois ce
  qui est un fait unique, et que les copies divergent.

- **`PLUSIEURS_PROJETS_DECLARENT_CE_DEPOT`** — plusieurs référentiels déclarent
  le dépôt courant, et il n'y a pas de `CADRAGE_RETENU`. C'est le cas normal
  quand deux produits partagent un dépôt de code : un back qui porte deux
  applications, un front qui en assemble deux.

  **Demander lequel, en listant les `CANDIDAT`. Ne jamais en choisir un.** Le
  dépôt courant ne porte pas l'information — s'il la portait, il n'y aurait pas
  d'ambiguïté — et deviner écrirait le cadrage dans un référentiel que personne
  n'a désigné. Une erreur pareille ne se voit qu'une fois le cadrage relu par
  quelqu'un d'autre, dans le mauvais produit.

  Le rédacteur, lui, sait de quel produit relève ce qu'il cadre. La réponse
  vaut pour ce cadrage seulement : ne l'inscrire nulle part, et redemander la
  fois suivante — un même dépôt sert les deux tour à tour.

- **`PROJET_INTROUVABLE`** — le chemin de la config ne mène à aucun
  `ssk-canon.yml`. Le dépôt n'est peut-être pas cloné :
  ```bash
  git clone git@github.com:<organisation>/<depot-de-cadrage>.git <chemin>
  ```

Ce skill **rédige un cadrage**. Il n'écrit aucun code applicatif, et n'ouvre ni
issue ni branche sur un dépôt de code.

## Le principe, en trois phrases

Le **référentiel** — domaines, fonctionnalités, règles de gestion — décrit l'état
courant du produit. Les **cadrages** sont les unités de changement, datées, qui le
transforment. Le référentiel est la projection des cadrages livrés.

Un cadrage ne se réécrit donc pas après coup : il porte ce qui a été décidé au
moment où on l'a décidé. C'est ce qui rend l'histoire du produit lisible.

## 1. Vérifier qu'il y a matière

Un cadrage se justifie quand une **décision** est en jeu — un choix entre options,
avec un motif. Pas pour une correction sans conséquence sur le comportement
attendu, ni pour du travail de pure forme.

S'il n'y a rien à décider, le dire plutôt que d'inventer un cadrage creux.

Si la demande n'est pas encore instruite — on sait qu'on veut quelque chose, on
ne sait pas encore quoi — c'est un cadrage en **brouillon** qui convient, avec
son objectif et ses questions ouvertes. Le statut dit où en est le travail, il ne
prétend pas qu'il est fini.

## 2. Préparer un espace de travail

**Ne jamais rédiger dans le clone lui-même.** Plusieurs cadrages se préparent
souvent en même temps — deux sessions ouvertes sur le même projet, ou deux
demandes traitées en parallèle. Changer de branche dans le clone la change pour
tout le monde, et un `git add` y ramasse ce qu'une autre session écrivait.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/preparer.mjs <CADRAGE_RETENU>
```

Ce que la sortie donne :

| Ligne | Ce qu'elle dit |
|---|---|
| `CADRAGE <id>` | l'identifiant retenu, libre au moment de la préparation |
| `ESPACE <chemin>` | **le répertoire où travailler** — tout ce qui suit s'y passe |
| `BRANCHE <nom>` | la branche déjà créée, propre à ce cadrage |
| `FICHIER <chemin>` | où écrire le cadrage |

Le script crée une **copie liée** du dépôt : un répertoire et une branche à soi,
sur le même dépôt Git. Deux sessions n'entrent donc jamais en conflit, et le
clone d'origine reste sur sa branche principale.

Pour reprendre un cadrage commencé, ou en imposer l'identifiant :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/preparer.mjs <CADRAGE_RETENU> 2026-014
```

Un espace déjà préparé est rendu tel quel — c'est le cas normal d'une session
qu'on reprend.

### Ce que le script garantit, et ce qu'il ne garantit pas

L'identifiant est choisi en regardant **le dépôt, les branches distantes et les
espaces préparés localement** : un cadrage en cours ailleurs est donc vu, ce que
la seule lecture du dépôt ne montrerait pas.

La séquence ne comble jamais un trou : un identifiant abandonné reste brûlé. Le
réutiliser ferait pointer d'anciennes références vers un cadrage sans rapport.

**Il reste une course possible** : deux préparations lancées à la même seconde,
avant que l'une n'ait poussé sa branche, peuvent choisir le même numéro. La
plateforme refusera la seconde poussée — renommer la branche et le répertoire du
cadrage suffit alors, le contenu n'ayant pas à changer.

## 3. Écrire le cadrage

Un répertoire `cadrages/<id>/`, portant l'identifiant **seul** — jamais un slug
de titre, qu'une réécriture déplacerait, ce qui perdrait tout l'historique du
fichier.

`cadrages/<id>/cadrage.md` :

```markdown
---
id: 2026-001
titre: Ce que ce cadrage change, en une ligne
statut: brouillon
domaines: [contrats, salaries]
liens:
  - { tag: issue_github, url: 'https://github.com/<organisation>/<depot-de-code>/issues/131' }
impacts:
  - { regle: RG-avenant-motif-obligatoire, operation: cree }
  - { regle: RG-duree-periode-essai, operation: modifie }
---

## Objectif

Le problème à résoudre, et pourquoi il mérite d'être traité maintenant.

Ce qu'on cherche à obtenir, non comment on va s'y prendre. Un objectif qui
décrit une solution a sauté l'étape où l'on pouvait encore en choisir une autre.

## Parcours utilisateur

1. Ce que fait l'utilisateur, étape par étape.
2. Ce que le produit répond.
3. Ce qui se passe quand ça se passe mal — c'est souvent là que le cadrage
   apprend quelque chose.

## Énoncés

### RG-avenant-motif-obligatoire

Le texte de la règle **après** ce cadrage, tel qu'il fera référence.

Un énoncé dit ce qui est vrai du produit, et pourquoi. Le « pourquoi » est ce
qu'on relira dans six mois quand quelqu'un voudra changer la règle.
```

### Les champs du frontmatter

| Champ | Ce qu'il porte |
|---|---|
| `id` | l'identifiant, identique au nom du répertoire |
| `titre` | ce que le cadrage change, en une ligne |
| `statut` | `brouillon`, `en_relecture`, `validee` ou `livree` |
| `domaines` | les domaines touchés, par leur identifiant |
| `liens` | l'issue, la carte, la maquette — tags dans `ssk-canon.yml` |
| `impacts` | les règles touchées, et comment |

**Un titre contenant `:` doit être entre apostrophes.** YAML lit sinon les
deux-points comme un séparateur, et le fichier devient illisible — la faute la
plus fréquente du format.

### Les opérations d'impact

| Opération | Quand | Énoncé |
|---|---|---|
| `cree` | la règle naît de ce cadrage | **obligatoire** |
| `modifie` | son texte change | **obligatoire** |
| `abroge` | elle ne s'applique plus | facultatif, mais dire pourquoi aide |
| `touche` | le cadrage la concerne sans la changer | aucun |

Un impact `cree` ou `modifie` sans énoncé fait échouer la vérification. C'est
l'erreur la plus courante.

## 4. Écrire les décisions

Une décision par fichier, dans `cadrages/<id>/decisions/`, numérotée :
`01-support-de-stockage.md`.

```markdown
---
id: 01-support-de-stockage
titre: Où stocker les pièces jointes d'un contrat ?
statut: retenue
option_retenue: stockage-objet
---

## Description

Ce qui rendait la question ouverte, et ce qui la rendait difficile.

## Options

### dans-la-base

Ce que l'option propose.

**Pour** — ce qu'elle apporte.
**Contre** — ce qu'elle coûte.

### stockage-objet

**Retenue.** Ce que l'option propose.

**Pour** — ce qu'elle apporte.
**Contre** — ce qu'elle coûte.

## Décision

Ce qui a été retenu, et **le critère qui a tranché** — non la liste des avantages,
mais ce qui a fait pencher.
```

**Les options écartées valent plus que celle qui est retenue.** Dans six mois,
quelqu'un proposera l'option écartée : le motif lui évitera de refaire le
raisonnement, ou lui donnera de quoi le contester si les conditions ont changé.

Une décision qui devient sans objet garde son fichier, avec `statut: annulee` et
son motif d'annulation. L'effacer ferait reposer la question.

## 5. Vérifier avant de conclure

La vérification contrôle ce que le format seul ne garantit pas : un impact vers
une règle inexistante, un énoncé manquant, un rattachement inconnu.

Si `ssk-canon-action` est cloné localement :

```bash
node <chemin>/ssk-canon-action/src/check.mjs <CADRAGE_RETENU>
```

Sinon, en clonant le temps de la vérification :

```bash
cd /tmp && git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action
node /tmp/ssk-canon-action/src/check.mjs <CADRAGE_RETENU>
```

**Si le dépôt n'a pas son automatisation**, rien ne bloque une livraison
incohérente. L'application de cadrage sait l'installer : ses réglages proposent
« Installer l'automatisation » tant qu'elle manque. Cela vaut mieux que de
relire à la main.

À défaut, contrôler soi-même :

- chaque règle en `cree` ou `modifie` a-t-elle son énoncé sous un titre de
  niveau 3 dans `## Énoncés` ?
- chaque domaine cité existe-t-il dans `domains/` ?
- chaque règle citée existe-t-elle dans `rules/`, sauf en `cree` ?
- le titre contient-il un `:` non échappé ?

## 6. Les règles de gestion

Une règle vit dans `rules/<id>.md`, **à plat** — jamais sous sa fonctionnalité,
un chemin renommé perdant tout son historique.

```markdown
---
id: RG-avenant-motif-obligatoire
fonctionnalites: [avenants]
statut: actif
cree_par: null
modifie_par: []
---

À propager.
```

**Quand créer le fichier.** Tant que le cadrage n'est pas livré, une règle qu'il
crée n'a pas à exister : la vérification l'admet, et c'est le cas normal d'un
travail en cours. Au passage à `livree`, en revanche, elle doit être là — sinon
la vérification refuse la livraison, avec « règle inconnue ».

C'est l'erreur la plus fréquente au moment de livrer, et elle est délibérée : le
rattachement d'une règle à ses fonctionnalités est une donnée du référentiel, non
du cadrage. La propagation le préserve, elle ne le décide pas.

`cree_par` et `modifie_par` sont des **index dérivés**, écrits par
l'automatisation à la livraison. Ne jamais les renseigner à la main : la
vérification les recalcule, et une divergence signale soit une édition manuelle,
soit une propagation manquée.

Le corps n'est pas non plus à écrire : l'énoncé vient du cadrage qui la crée, et
la propagation l'y recopie. `À propager.` suffit jusqu'à la livraison.

**Une règle doit être rattachée à au moins une fonctionnalité**, sinon la
livraison est refusée : le référentiel se parcourt par domaines puis
fonctionnalités, et une règle rattachée à rien serait introuvable.

## 7. Livrer

Le dépôt de cadrage suit le même chemin que le code : une branche, une demande de
fusion, une relecture.

Depuis l'espace préparé à l'étape 2 — non depuis le clone, et non depuis le
dépôt du code. La branche existe déjà : il n'y a pas à en créer une.

### Jusqu'où livrer

**L'étape 0 a rendu une ligne `ARRET <niveau>`. Ne rien faire au-delà.** Chacun
de ces gestes porte plus loin que le précédent : enregistrer touche le dépôt,
pousser rend le travail visible à d'autres, ouvrir une demande sollicite une
relecture. Aucun ne doit se produire sans qu'on l'ait voulu.

| `ARRET` | Ce qu'on fait | Ce qu'on dit ensuite |
|---|---|---|
| `ecriture` | rien de plus — **le défaut** | les fichiers écrits, et les commandes à lancer |
| `commit` | `git add` + `git commit` | la branche où c'est enregistré, et comment pousser |
| `push` | et `git push` | la branche poussée, et comment ouvrir la demande |
| `pr` | et `gh pr create` | le numéro de la demande |

```bash
cd <ESPACE>
git add cadrages/<id> rules/            # à partir de « commit »
git commit -m "Cadrage <id> : <titre>"  # à partir de « commit »
git push -u origin <BRANCHE>            # à partir de « push »
gh pr create --fill                     # seulement pour « pr »
```

`git add` ne ramasse ici que ce qui a été écrit dans cet espace : le travail
d'une autre session, même sur le même dépôt, lui est invisible.

**S'arrêter n'est pas abandonner** : dire ce qui a été écrit, où, et la commande
exacte pour aller plus loin. Un arrêt silencieux laisse croire à un échec.

Le niveau se règle dans `~/.claude/cadrage-canon.json`, globalement ou par
projet — celui du projet primant :

```json
{
  "arret": "commit",
  "projets": [
    "~/chemin/vers/un-referentiel",
    { "chemin": "~/chemin/vers/un-autre", "arret": "pr" }
  ]
}
```

Le nom de la branche est libre : l'application retrouve un cadrage par sa
demande de fusion, jamais par le nom de sa branche. `cadrage-<id>` se lit bien,
sans que rien n'en dépende.

Une fois la demande fusionnée, l'espace ne sert plus :

```bash
git -C <CADRAGE_RETENU> worktree remove <ESPACE>
```

Le statut passe à `livree` **au moment de la livraison**, pas avant : c'est la
fusion qui l'établit, et l'automatisation qui projette alors les énoncés dans
`rules/`.

## Ce qu'un bon cadrage a, et qu'un mauvais n'a pas

**Un objectif qui dit le problème, pas la solution.** « Permettre de saisir un
motif d'avenant » décrit un champ de formulaire ; « savoir pourquoi un contrat a
été modifié, six mois après » décrit ce qu'on cherche.

**Des options écartées avec leur motif.** Un cadrage qui ne présente qu'une
option ne cadre rien — il enregistre.

**Un critère de décision explicite.** Ce qui a tranché, en une phrase, distinct
de la liste des avantages.

**Ce qui a été appris en faisant.** Un fait mesuré, une hypothèse infirmée, un
défaut trouvé en éprouvant : c'est ce qui a le plus de valeur, et ce qu'on oublie
le plus vite.
