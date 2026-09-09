---
name: cadrage-depuis-trello
description: Part d'une carte Trello pour rédiger un cadrage dans le référentiel SSK Canon — lit le titre, la description, les checklists, les commentaires et les pièces jointes de la carte, puis enchaîne sur le skill cadrage-canon, repose en commentaire sur la carte le lien du cadrage obtenu, et fait suivre l'URL de la carte jusqu'aux issues des dépôts de code. À utiliser quand l'utilisateur donne une URL de carte Trello et demande de la cadrer, dit "cadre cette carte", "cadre ce ticket", ou colle un lien trello.com/c/.
---

# Cadrer depuis une carte Trello

Une carte Trello exprime un besoin **succinctement** ; un cadrage l'instruit. Ce
skill fait le premier geste — récupérer la matière au lieu de la recopier à la
main — et laisse le second à `cadrage-canon`, qui sait écrire un cadrage.

Il ne remplace donc pas `cadrage-canon` : il l'alimente.

## 1. Lire la carte

```bash
node ${CLAUDE_SKILL_DIR}/scripts/lire-carte.mjs <url-de-la-carte> [dossier-des-pj]
```

L'URL se colle telle qu'elle est copiée depuis Trello. La sortie est la matière
brute de la carte : titre, description, checklists, commentaires, liens attachés,
et les pièces jointes téléchargées sur le disque.

| Ligne | Ce qu'elle dit |
|---|---|
| `CARTE <url>` | l'URL courte, à porter en lien `carte_trello` du cadrage |
| `TITRE <texte>` | le titre de la carte — **une piste, pas le titre du cadrage** |
| `ETIQUETTES` / `ECHEANCE` | contexte de priorisation, rarement à cadrer |
| `--- DESCRIPTION ---` | le corps du besoin, tel que le client l'a écrit |
| `--- CHECKLIST <nom> ---` | souvent le parcours ou les critères d'acceptation |
| `--- COMMENTAIRES ---` | la discussion — **c'est là que les décisions se sont prises**, et là où la description se fait contredire ; le plus récent l'emporte |
| `--- LIENS ATTACHÉS ---` | URLs collées sur la carte, à reporter en `liens` |
| `FICHIER <chemin>` | une pièce jointe téléchargée |
| `ECHEC <nom> — <motif>` | une pièce jointe non récupérée, à signaler |

### Quand les identifiants manquent

La sortie `IDENTIFIANTS_ABSENTS` donne la marche à suivre. Créer
`~/.claude/trello.json` :

```json
{ "cle": "<clé API>", "jeton": "<jeton>" }
```

La clé se prend sur <https://trello.com/apps/admin>, onglet « API key »
d'un Power-Up.

**Le « Secret » affiché juste à côté n'est pas le jeton.** C'est la confusion la
plus coûteuse de cette configuration : les deux sont des chaînes de 64
caractères hexadécimaux, rien ne les distingue à l'œil, et la page d'admin les
montre côte à côte.

| Champ Trello | Ce que c'est | Emploi |
|---|---|---|
| **Clé d'API** | identifie l'application | `key=` |
| **Secret** | secret OAuth 1.0a, pour négocier un jeton au nom d'un tiers | **aucun ici** |
| **Jeton** | identifie la personne, et porte ses droits | `token=` |

Le Secret ne sert qu'au flux OAuth par lequel une application obtient un jeton
au nom d'un utilisateur. Pour un usage personnel ce flux est court-circuité : on
s'autorise soi-même, et Trello délivre le jeton directement.

Le jeton s'obtient en `scope=read,write` — l'écriture sert à reposer le lien du
cadrage sur la carte, à l'étape 6, et **à rien d'autre**. Le skill ne déplace
aucune carte, n'en change ni le statut ni les étiquettes : une carte appartient
au client, et l'instruire n'autorise pas à la réorganiser.

```
https://trello.com/1/authorize?key=<clé>&scope=read,write&expiration=never&response_type=token&name=SSK%20Canon
```

**Un jeton émis en `scope=read` reste valide en lecture** — les versions
précédentes de ce skill n'en demandaient pas d'autre. Il lira les cartes sans
faute et se verra refuser le commentaire, par un 401 que rien ne distingue d'un
jeton faux. C'est ce que `ECRITURE_REFUSEE` nomme, à l'étape 6.

Trello affiche une page d'autorisation ; après « Autoriser », la chaîne affichée
est le jeton.

Ce fichier ne se commite nulle part. Les variables d'environnement
`TRELLO_API_KEY` et `TRELLO_TOKEN` priment sur lui.

### Lire le refus

Le script nomme le coupable plutôt que de dire « identifiants invalides » :

| Sortie | Ce qu'elle dit |
|---|---|
| `CLE_REFUSEE` | la clé n'est pas reconnue — la reprendre sur la page d'admin |
| `JETON_REFUSE` | la clé est bonne, le jeton ne lui correspond pas — **le cas du Secret collé à la place du jeton**, ou d'un jeton d'un autre Power-Up, ou d'une clé régénérée depuis |
| `CARTE_INTROUVABLE` | identifiants valides, mais la carte n'existe pas ou le compte n'y a pas accès |
| `TROP_DE_REQUETES` | 100 requêtes par 10 s et par jeton |

`JETON_REFUSE` affiche l'URL d'autorisation déjà remplie avec la clé en place :
le jeton qui en sortira lui sera apparié par construction.

**Un espace de travail différent n'est pas une cause de refus.** Une clé née
dans un Power-Up d'un espace lit les cartes de tous les espaces auxquels le
porteur du jeton a accès : la clé identifie l'application, le jeton porte les
droits. Un défaut de périmètre se voit en `CARTE_INTROUVABLE`, jamais en
`JETON_REFUSE`.

## 2. Regarder les pièces jointes

Les pièces jointes ne sont pas décoratives : une maquette ou une capture porte
souvent la moitié du besoin. **Les ouvrir avec l'outil de lecture d'images**
avant de rédiger — une capture d'écran d'un défaut dit en un coup d'œil ce que
trois lignes de description approchent mal.

Une pièce jointe en `ECHEC` doit être signalée à l'utilisateur, pas passée sous
silence : il saura la fournir autrement, et le cadrage sera écrit sur une
matière complète.

**Le référentiel ne stocke pas encore de pièces jointes** — le stockage objet est
une phase à venir de SSK Canon. Les fichiers téléchargés servent donc à
comprendre et à rédiger ; ils ne se commitent pas dans le dépôt de cadrage. Ce
qui subsiste dans le cadrage, c'est le lien vers la carte, où les pièces vivent.

## 3. Chercher si la carte est déjà cadrée

**Avant d'écrire quoi que ce soit.** Une carte discutée sur plusieurs semaines a
souvent déjà donné lieu à un cadrage, laissé en brouillon dans une branche ou une
demande de fusion ouverte. En écrire un second produit deux textes contradictoires
sur le même sujet, dont l'un porte des règles que l'autre contredit — le
référentiel devient alors faux, et rien ne dit lequel des deux fait foi.

Le nom de la branche ne suffit pas à trancher : il porte un numéro de cadrage, pas
le sujet de la carte. Il faut regarder les titres.

```bash
git -C <CADRAGE_RETENU> fetch origin
git -C <CADRAGE_RETENU> log --all --oneline
gh pr list --repo <organisation>/<depot-de-cadrage> --state all
grep -rl "<mot-clé du sujet>" <CADRAGE_RETENU>/cadrages/
```

Le lien `carte_trello` est le rattachement le plus sûr, quand il a été posé —
c'est la raison d'être de ce tag. Mais un cadrage antérieur à cette habitude ne le
porte pas : chercher aussi par le vocabulaire du sujet.

| Ce qu'on trouve | Ce qu'on fait |
|---|---|
| rien | écrire un cadrage neuf, c'est le cas courant |
| un cadrage **livré** | écrire un cadrage neuf, qui modifie ou abroge les règles du premier |
| un cadrage **en brouillon ou en relecture** | **le reprendre**, ne pas en créer un second |

Reprendre se fait en passant son identifiant à la préparation, ce qui rend
l'espace déjà ouvert :

```bash
node ~/.claude/skills/cadrage-canon/scripts/preparer.mjs <CADRAGE_RETENU> <id-existant>
```

Un identifiant réservé pour rien se libère — sans quoi il reste brûlé sur un
doublon :

```bash
git -C <CADRAGE_RETENU> worktree remove <ESPACE-INUTILE>
git -C <CADRAGE_RETENU> branch -D cadrage-<id-inutile>
```

**Un cadrage non livré n'est pas figé.** La règle « un cadrage ne se réécrit pas »
vaut pour ce qui a été livré, parce que le référentiel en est la projection. Tant
qu'il est en brouillon, le corriger est le geste juste.

## 4. Quand un commentaire contredit la description

C'est le cas le plus fréquent d'une carte qui a vécu, et le plus facile à manquer :
la description dit ce qu'on croyait au départ, les commentaires disent ce qu'on a
décidé depuis. **Le commentaire postérieur l'emporte** — mais il ne s'explique pas
lui-même, et c'est là que le cadrage a du travail.

Un commentaire de relecture est reconnaissable : il est daté d'après un cadrage
existant, et il en reprend les points un à un. Le rapprocher de la date du cadrage
et de sa demande de fusion vaut confirmation. Regarder aussi si le retour a été
porté ailleurs — une demande de fusion sans commentaire, alors que la carte en a
un du lendemain, dit où la relecture s'est faite.

Ce qu'un tel commentaire demande :

- **Reprendre chaque énoncé qu'il contredit**, et non ajouter les nouveaux à côté
  des anciens. Deux règles opposées dans un même cadrage ne se voient qu'à la
  relecture, et parfois jamais.
- **Rouvrir les décisions qu'il rend caduques.** Une décision dont le commentaire
  écarte l'objet ne s'efface pas : elle passe en `statut: annulee` avec son motif,
  ou se réécrit si la question reste posée sous une autre forme.
- **Se méfier de la formulation brève.** « Nouveau mode de livraison » peut
  désigner un mode visible que l'utilisateur choisit, ou une substitution que le
  produit applique seul. L'écart est mince à l'écrit et structurant à la
  réalisation : demander plutôt que trancher.
- **Vérifier dans le code ce que le commentaire tient pour acquis.** Une demande
  formulée comme un ajout porte souvent sur quelque chose qui existe déjà, sous un
  autre nom. La confirmer avant d'en faire une règle neuve.

Un commentaire qui tranche sans dire pourquoi laisse le motif à reconstituer.
C'est une question à poser, pas un blanc à combler : un cadrage qui invente le
motif d'une décision fait passer pour établi ce que personne n'a arbitré.

## 5. Enchaîner sur le cadrage

Invoquer le skill `cadrage-canon` et suivre son déroulé, en lui apportant ce que
la carte a donné. Deux points où la matière Trello se place précisément :

**Le lien vers la carte**, dans le frontmatter — c'est ce qui referme la boucle
entre l'expression du besoin et son instruction :

```yaml
liens:
  - { tag: carte_trello, url: 'https://trello.com/c/xY2kAbCd' }
```

Le tag `carte_trello` doit être déclaré dans le `ssk-canon.yml` du référentiel.
S'il ne l'est pas, le proposer à l'utilisateur plutôt que d'inventer un autre
tag.

**Les commentaires de la carte** alimentent les décisions. Une discussion où deux
options ont été pesées est déjà une décision au sens du référentiel : elle mérite
son fichier dans `decisions/`, avec les options et le motif qui a tranché. C'est
la matière la plus précieuse de la carte, et la plus facile à perdre.

Quand ils contredisent la description, voir l'étape 4 : ce n'est pas de la matière
en plus, c'est de la matière qui en remplace.

## 6. Reposer le lien sur la carte

**Une fois la demande de fusion du cadrage ouverte**, et pas avant : le
commentaire porte une URL, et une URL qui ne mène encore nulle part est pire
qu'un commentaire absent.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/commenter-carte.mjs <url-de-la-carte> <url-du-cadrage> [titre]
```

Le cadrage porte déjà le lien vers la carte, en `carte_trello`. Sans ce geste, le
rattachement n'existe que du côté que le client ne consulte pas : il regarde
Trello, où rien ne dit que son besoin a été instruit.

**Quelle URL passer.** Celle de la demande de fusion tant que le cadrage n'est
pas livré — c'est là que la discussion se tient et que l'état se voit. Le lien
vers le fichier sur `main` ne vaut qu'une fois la fusion faite, et il ne montre
alors plus la relecture.

| Sortie | Ce qu'elle dit |
|---|---|
| `COMMENTE <url>` | le commentaire est posté |
| `DEJA_COMMENTE <url>` | ce lien est déjà sur la carte — rien n'a été écrit, et c'est le bon comportement |
| `ECRITURE_REFUSEE` | le jeton ne peut pas écrire — presque toujours un jeton `scope=read`, voir plus haut |
| `LIEN_INVALIDE` | le second argument n'est pas une URL absolue |

**Le script ne poste jamais deux fois le même lien.** Reprendre un cadrage,
corriger sa demande de fusion, relancer le skill : autant d'occasions d'empiler
le même commentaire sur une carte que le client lit. La répétition y est du
bruit, et le bruit fait finir par ignorer la colonne entière.

Un cadrage repris à l'étape 3 garde donc son commentaire d'origine, puisque
l'URL de sa demande de fusion n'a pas changé. Rien à refaire.

## 7. La carte suit jusqu'aux issues

Le lien de la carte ne s'arrête pas au cadrage. Les issues ouvertes sur les
dépôts de code le portent aussi, en tête de leur corps : c'est par là qu'un
développeur remonte au besoin d'origine sans avoir à traverser le référentiel, et
c'est le seul rattachement qu'un dépôt de code conserve une fois le cadrage
livré.

Le passer donc à l'étape 8 de `cadrage-canon`, avec l'URL de la demande de fusion
du cadrage. Les deux ouvrent l'issue :

```markdown
Carte : https://trello.com/c/xY2kAbCd
Cadrage : <url de la demande de fusion>
```

## Ce qu'une carte donne, et ce qu'elle ne donne pas

Une carte n'est **pas** un cadrage, et la transposer mot à mot produit un cadrage
creux. Ce que le passage demande :

| La carte porte | Le cadrage demande |
|---|---|
| un titre d'action — « Ajouter un bouton export » | ce que le titre change, en une ligne |
| une description du **comment** | un objectif qui dit le **problème** |
| une checklist de tâches | un parcours utilisateur, y compris quand ça échoue |
| une discussion en commentaires | des décisions, avec leurs options écartées |
| rien sur les règles de gestion | des impacts, et leurs énoncés |

**Les règles de gestion ne sont presque jamais dans la carte.** Elles se
déduisent du besoin, et c'est le travail du cadrage. Ne pas en inventer pour
remplir : un cadrage en brouillon avec ses questions ouvertes vaut mieux qu'un
cadrage complet et faux.

**Si la carte ne porte aucune décision** — une correction sans conséquence sur le
comportement attendu, une tâche de pure forme — le dire. `cadrage-canon` pose la
même exigence, et une carte n'est pas une raison suffisante de cadrer.
