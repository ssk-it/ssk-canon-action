---
name: consulter-referentiel
description: Dit ce que le référentiel SSK Canon du projet courant sait déjà d'un sujet — règles de gestion en vigueur, décisions prises, cadrages livrés, et surtout cadrages encore en cours sur leur branche — avant de cadrer ou de développer. Lecture seule, sur origin/main et les branches distantes, jamais sur une copie locale en retard. À utiliser avant tout cadrage ou toute implémentation d'une évolution fonctionnelle, quand un skill de dépôt y renvoie, ou quand l'utilisateur demande "qu'a-t-on déjà décidé sur…", "y a-t-il une règle pour…", "quelqu'un travaille-t-il déjà sur…". Passer en argument le texte de la demande, et son issue ou sa carte s'il y en a une : le skill s'exécute dans un sous-agent qui ne voit pas la conversation.
context: fork
agent: Explore
model: inherit
background: false
allowed-tools:
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs *)
  - Bash(git -C * show *)
  - Bash(git -C * ls-tree *)
---

# Consulter le référentiel

La demande à instruire :

> $ARGUMENTS

Si elle est vide, ne rien consulter : répondre seulement « Aucune demande
transmise — passer à consulter-referentiel le texte de la demande, et son issue
s'il y en a une. »

Le code dit ce que le produit fait. Le référentiel dit **pourquoi** — quelles
règles il doit tenir, quelles options ont été écartées et pour quel motif, quels
chantiers sont en cours. Cadrer ou développer sans le lire, c'est risquer trois
fautes qu'aucune lecture de code ne révèle :

- **contredire une règle active**, qu'un autre écran ou un autre dépôt applique ;
- **rouvrir une option déjà écartée**, sans connaître le motif qui l'a écartée ;
- **refaire un chantier en cours**, ou le contredire, parce qu'il vit encore sur
  sa branche et n'apparaît nulle part ailleurs.

Ce skill ne modifie rien. Il produit une section de constats, que l'appelant —
`cadrage-canon`, ou le skill de cadrage ou d'évolution d'un dépôt de code — reprend
dans ce qu'il rend.

**Il s'exécute dans un sous-agent**, déclaré par son frontmatter. Une consultation
lit une quinzaine de milliers de tokens — cadrages en cours, décisions, règles —
dont l'appelant n'a besoin que de la synthèse, un millier environ. Les lire dans
la conversation principale la chargerait d'autant pour le reste du cadrage ou de
l'implémentation. **La réponse finale est donc la section du §5, et rien
d'autre** : c'est tout ce que l'appelant reçoit.

## Les commandes

**Une commande par appel, sans variable, boucle, `;`, `&&` ni `|`.** Seules deux
formes sont pré-autorisées — le script de ce skill, et `git -C <chemin absolu>`
suivi de `show` ou de `ls-tree`. Une commande composée ne correspond à aucune
autorisation : en session interactive elle interrompt l'utilisateur pour une
approbation, en mode non interactif elle est refusée. Plusieurs fichiers d'une
même référence se lisent en un seul appel :

```bash
git -C <REFERENTIEL> show <ref>:<fichier-1> <ref>:<fichier-2> <ref>:<fichier-3>
```

## 1. L'index

Depuis le dépôt de code courant, exécuter, et lire la sortie :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs
```

Le script trouve le référentiel par la même situation que `cadrage-canon` — il
en appelle le script, qui doit être installé à côté —, puis en rafraîchit les
références distantes. Le `fetch` n'écrit que dans `.git` : il ne dérange pas une
session qui aurait une branche de cadrage ouverte dans ce clone. Il n'est refait
qu'au-delà de cinq minutes : les appels suivants d'une même consultation
répondent en moins d'une seconde.

| Ligne | Ce qu'elle dit |
|---|---|
| `REFERENTIEL <chemin> @ origin/main <sha> <date>` | ce qui est lu, et de quand il date |
| `DOMAINE <id> \| <libellé>` | les domaines, points d'entrée de l'étape 2 |
| `ARCHITECTURE <id> \| <nature> \| …` | composants, flux et contextes documentés |
| `EN_COURS <id> \| <titre> \| domaines: … \| <branche>` | un cadrage non fusionné — **à lire avec attention** |
| `REFERENTIEL_NON_RETENU` | la situation a échoué ; sa sortie est relayée au-dessus |
| `FETCH_RECENT il y a <n> s` | le dernier `fetch` date de moins de cinq minutes ; `--fetch` le force |
| `FETCH_ECHOUE` | hors ligne : la lecture porte sur la dernière image connue, à dire |

**Ne jamais lire la copie de travail du référentiel** — ni `cat`, ni `grep` dans
le dossier. Un clone ouvert une fois et jamais tiré accumule les livraisons de
retard ; le lire tel quel présente l'état du produit d'il y a des semaines comme
l'état courant, sans que rien ne le signale. Tout passe par `origin/main` et les
branches distantes, comme le script le fait.

**Sans référentiel** — `REFERENTIEL_NON_RETENU` avec `AUCUN_PROJET_NE_DECLARE_CE_DEPOT`
ou `CONFIG_ABSENTE` : le dire en une ligne et rendre la main. Un projet sans
référentiel n'est pas une erreur. Avec `PLUSIEURS_PROJETS_DECLARENT_CE_DEPOT`,
ne pas choisir : rendre la main en listant les `CANDIDAT`, pour que l'appelant
demande lequel et relance en précisant le chemin dans la demande — le script
l'accepte par `--referentiel <chemin>`.

## 2. Le sujet

Choisir les domaines que la demande touche, et relancer :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs --domaine <id> [--domaine <id>] [--issue <depot#n>]
```

- `--domaine` rend, pour chaque domaine, ses fonctionnalités, les règles
  rattachées à chacune avec leur statut et leur énoncé, les décisions créées par
  ses cadrages, les cadrages livrés et ceux en cours.
- `--issue` accepte `depot#n`, `organisation/depot#n` ou l'URL : il rend le cadrage
  qui porte cette issue, livré ou en cours, et la commande pour le lire. **Quand la
  demande part d'une issue, commencer par là** : son cadrage contient les règles
  qu'elle doit réaliser, et l'issue, elle, ne porte que le besoin.

Un domaine se choisit par le **métier** de la demande, pas par le dossier de code
touché : le vocabulaire du référentiel n'est pas celui du code.

Les options se combinent : un seul appel avec `--domaine`, `--issue` et les
`--motif` du §3 rend tout d'un coup, et épargne autant de tours.

## 3. Ce que les domaines ne rattachent pas

Une règle peut contraindre la demande sans appartenir à ses domaines — une règle
de notification déclenchée par une commande, par exemple. Chercher par les mots du
métier :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs --motif "<terme>" [--motif "<synonyme>"]
```

Le script cherche dans l'état livré — règles, décisions, architecture, cadrages —
puis dans chaque cadrage en cours, sur sa branche et **dans son seul dossier** :
une branche porte aussi les cadrages livrés avant qu'elle ne parte, qui
reviendraient sinon une fois par branche ouverte. Les résultats sont regroupés par
fichier, avec leur nombre d'occurrences et une première ligne.

Deux ou trois termes suffisent, pris dans la demande et dans ses synonymes métier —
une « pose » est une installation, un « référencement » s'appelle parfois une
intervention dans le code. La recherche ignore la casse mais non les accents.

## 4. Lire ce qui compte

Le script ne donne que le premier paragraphe. Lire en entier ce qui touche la
demande de près :

```bash
git -C <REFERENTIEL> show origin/main:rules/<id>.md
git -C <REFERENTIEL> show <branche>:cadrages/<id>/cadrage.md
git -C <REFERENTIEL> show <branche>:cadrages/<id>/decisions/<fichier>.md
```

Pour un cadrage en cours, lire aussi ses décisions : ce sont elles qui disent ce
qui est déjà tranché, et qui ne le sera plus par la demande présente.

## 5. Restituer

Une section, à insérer dans ce que l'appelant rend :

```markdown
## Ce que le référentiel dit
Référentiel <nom> @ origin/main <sha> — domaines consultés : <ids> — termes cherchés : <termes>

- **Règles qui contraignent** — RG-… : ce qu'elle impose à la demande
- **Décisions à ne pas rouvrir** — ADR-… ou <cadrage>/decisions/… : ce qui est tranché, et le motif
- **Cadrages en cours qui recouvrent** — <id> (<branche>) : ce qu'il couvre, et le recouvrement
- **Contradictions** — ce que la demande dit, ce que le référentiel dit
```

**Une section vide se dit** : « Rien dans le référentiel ne contraint cette
demande », suivi de ce qui a été consulté. Un constat d'absence vaut s'il dit où
l'on a cherché ; sinon, on ne sait pas s'il y a rien ou si l'on n'a pas regardé.

**Une contradiction ne se tranche pas ici.** Si la demande heurte une règle
active ou une décision, ou recouvre un cadrage en cours, le signaler à
l'utilisateur et le laisser décider : faire évoluer la règle — ce qui appelle un
cadrage —, réduire la demande, ou rejoindre le chantier en cours. Ni le code ni
un nouveau cadrage ne doivent passer outre en silence.

## Interdits

- N'écrire dans le référentiel sous aucune forme — ni fichier, ni branche, ni
  `pull` ou `checkout` dans son clone. Le `fetch` du script est le seul geste
  admis.
- Ne pas citer une règle sans l'avoir lue sur `origin/main` ou sur sa branche.
- Ne pas présenter un cadrage en cours comme décidé : tant qu'il n'est pas
  fusionné, ses règles sont des propositions.
