---
name: consulter-referentiel
description: >-
  Dit ce que le référentiel SSK Canon du projet courant sait déjà d'un sujet — règles de gestion en vigueur, décisions prises, cadrages livrés, et surtout cadrages encore en cours sur leur branche — avant de cadrer ou de développer. Lecture seule, sur origin/main et les branches distantes, jamais sur une copie locale en retard. À utiliser avant tout cadrage ou toute implémentation d'une évolution fonctionnelle, quand un skill de dépôt y renvoie, ou quand l'utilisateur demande "qu'a-t-on déjà décidé sur…", "y a-t-il une règle pour…", "quelqu'un travaille-t-il déjà sur…". Passer en argument le texte de la demande, et son issue ou sa carte s'il y en a une : le skill s'exécute dans un sous-agent qui ne voit pas la conversation.
context: fork
agent: Explore
model: inherit
background: false
allowed-tools:
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs *)
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
formes sont pré-autorisées — le script de ce skill, et `git -C <chemin absolu>
ls-tree`. Une commande composée ne correspond à aucune autorisation : en session
interactive elle interrompt l'utilisateur pour une approbation, en mode non
interactif elle est refusée.

**Ce qui coûte, ce sont les tours, non la lecture.** Le script répond en une ou
deux secondes ; chaque appel, lui, coûte un tour entier de l'agent. D'où deux
habitudes, qui ne retirent rien à ce qu'on lit :

- **réunir dans un appel** ce qui peut l'être — toutes les options du script se
  combinent, et `--lire` se répète autant qu'il y a de fichiers à lire ;
- **lancer dans un même message** les appels qui ne dépendent pas l'un de
  l'autre, plutôt que l'un après l'autre.

**Le script ne rend jamais plus de 25 000 caractères.** Au-delà de 30 000, Claude
Code ne montrerait de la sortie qu'un aperçu de deux kilo-octets, et le reste
coûterait plusieurs tours à relire. Quand il doit couper, il le fait entre deux
lignes, sans séparer un fichier ou un cadrage qui tiendrait entier sur la page
suivante, et finit par :

```
SUITE lignes <n> à <total> sur <total> non rendues, fichiers non lus : … — lire la suite : node … --depuis <n>
```

**Une sortie qui finit par `SUITE` n'est pas lue en entier** : relancer la commande
donnée, telle quelle, jusqu'à ce qu'aucune ligne `SUITE` ne termine la sortie —
pour une lecture `--lire` comme pour les autres. Les fichiers que la ligne nomme
n'ont pas été lus, ou seulement en partie : s'arrêter là, c'est restituer comme
lu ce qui ne l'a pas été. La page suivante commence par `REPRISE à la ligne <n>
sur <total>, dans : …`, qui dit de quel domaine, de quel cadrage ou de quel
fichier elle poursuit la lecture.

## 1. L'index

L'index a été calculé au chargement de ce skill, depuis le dépôt de code
courant ; inutile de relancer le script sans option :

```
!`node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs`
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
| `DEPOT_COURANT (inconnu) — <cause>` | git n'a pas dit quel est le dépôt courant ; sa réponse suit |
| `REFERENTIEL_ILLISIBLE <chemin> — <cause>` | git refuse de lire le référentiel ; sa réponse suit |
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

**Le dépôt de la demande n'est pas celui de la session.** L'index injecté se
calcule depuis le dossier où la session est ouverte, que `DEPOT_COURANT` nomme.
Si ce n'est pas le dépôt de code de la demande — une session ouverte dans un
dossier de travail, ou sur un autre dépôt —, relancer en le désignant ;
`--depot` se combine avec toutes les autres options :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs --depot <organisation/depot>
```

**Un référentiel que ce poste ne connaît pas.** `AUCUN_PROJET_NE_DECLARE_CE_DEPOT`
ne dit que ce qu'ont déclaré les `PROJET` listés, ceux de
`~/.claude/cadrage-canon.json`. Si le dépôt de code nomme pourtant son
référentiel — dans son `CLAUDE.md`, son `README` —, ce n'est pas un projet sans
référentiel : c'est ce poste qui ne l'a pas déclaré. Le dire à l'appelant, avec
le dépôt nommé, qui une fois cloné s'ajoute à `projets`. Ne pas conclure qu'il
n'y a rien.

**Git refuse de lire : sous Windows, un dépôt cloné sous WSL.** Une cause
« dubious ownership », sur `DEPOT_COURANT` ou `REFERENTIEL_ILLISIBLE` : Git pour
Windows ne tient pas pour sien un dépôt de `\\wsl.localhost\…`, dont le
propriétaire est l'utilisateur Linux. Le remède relâche une protection de git,
une fois par poste : il revient à l'utilisateur, non à ce skill. Le rendre à
l'appelant avec la commande, pour le dossier qui contient les dépôts :

```bash
git config --global --add safe.directory '%(prefix)///wsl.localhost/<distribution>/home/<utilisateur>/<dossier>/*'
```

Le référentiel se déclare alors dans `~/.claude/cadrage-canon.json` par ce même
chemin, en barres obliques : `"//wsl.localhost/<distribution>/home/…"`.

## 2. Le sujet

Choisir les domaines que la demande touche, et relancer :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs --domaine <id> [--domaine <id>] [--issue <depot#n>]
```

- `--domaine` rend, pour chaque domaine, ses fonctionnalités, les règles
  rattachées à chacune avec leur statut et leur énoncé, les décisions du dossier
  `decisions/` créées par ses cadrages, puis ses cadrages livrés et ceux en cours —
  chacun suivi de ses propres décisions.
- `--issue` accepte `depot#n`, `organisation/depot#n` ou l'URL : il rend le cadrage
  qui porte cette issue, livré ou en cours, ses décisions, et l'argument `--lire`
  qui le lit. **Quand la demande part d'une issue, commencer par là** : son cadrage
  contient les règles qu'elle doit réaliser, et l'issue, elle, ne porte que le
  besoin.

Les décisions d'un cadrage, **livré comme en cours**, viennent chacune sur une
ligne :

```
DECISION_DE_CADRAGE <ref>:cadrages/<id>/decisions/<fichier>.md [<statut> → <option retenue>] | <question> | <premier paragraphe>
```

La question et l'option retenue servent à **choisir** les décisions à lire,
jamais à s'en passer : ce qu'une décision a écarté, et pourquoi, n'est que dans
son fichier. Le `<ref>:<chemin>` en tête de ligne se passe tel quel à `--lire`.

Sous un cadrage en cours, une ligne `IMPACTS` dit ce qu'il changerait au
référentiel — `cree`, `modifie`, `abroge` ou `touche`, règle par règle et ADR par
ADR. Une règle qui contraint la demande et qu'un cadrage en cours abroge ou
modifie est un recouvrement : c'est ce cadrage qu'il faut lire, au §4.

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

Le script ne donne que le premier paragraphe. Lire ce qui touche la demande de
près — règles, cadrages, décisions —, **en un seul appel** :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/consulter.mjs --lire origin/main:rules/<id>.md --lire <branche>:cadrages/<id>/cadrage.md --lire <ref>:cadrages/<id>/decisions/<fichier>.md
```

Chaque fichier vient sous une ligne `LIRE <ref>:<chemin> (<n> lignes)` ; un
fichier qui n'existe pas sur la référence est signalé par `ABSENT`. Seules
`origin/main` et les branches distantes `origin/…` sont admises, pour la raison du
§1 : une branche locale du clone peut être en retard.

**Ce qui est livré vient condensé**, et l'en-tête le dit : `(<n> lignes, condensé
— --entier pour le fichier entier)`.

- **Un cadrage livré** vient sans le texte de ses Énoncés. La livraison les a
  recopiés dans `rules/`, `decisions/` ou `architecture/`, et un cadrage ultérieur
  a pu les modifier depuis : l'énoncé d'époque n'est plus forcément en vigueur.
  Chacun devient une ligne
  `ENONCE <id> [<opération>] → --lire origin/main:<chemin> | modifié depuis par <cadrages>`.
  Une règle qui contraint la demande se lit par cette commande, et une règle
  `abroge` ne se cite pas comme en vigueur.
- **Une décision livrée** vient réduite à ce qui est tranché : la question, le
  premier paragraphe de sa description, chaque option suivie de `(retenue)` ou,
  pour une option `(écartée)`, de son « Contre » — le motif de l'écart —, et la
  section Décision entière. Toute autre section, comme le motif d'une annulation,
  reste entière. Un repère que le format ne garantit pas et qui manque se dit :
  `RETENUE_NON_IDENTIFIEE`, `CONTRE_ABSENT`, `DECISION_ABSENTE`.

Relancer avec `--entier` quand le condensé ne suffit pas : pour citer l'énoncé
d'époque d'un cadrage, pour une décision dont un repère manque, ou quand le
« Contre » d'une option écartée ne dit pas pourquoi elle l'a été au regard de la
demande.

Lire aussi les décisions des cadrages qui touchent la demande, livrés comme en
cours : ce sont elles qui disent ce qui est déjà tranché, et qui ne le sera plus
par la demande présente.

**Un cadrage en cours qui recouvre la demande se lit en entier**, ce que le
script fait de lui-même sur une branche — son `cadrage.md` et chacune de ses
décisions, dans le même appel. C'est le chantier qu'on risque de refaire ou de
contredire : ses énoncés et ses options sont sa proposition, qu'aucun autre
fichier ne porte encore, et ni ses premiers paragraphes ni sa ligne `IMPACTS` ne
disent ce qu'il change à la demande présente.

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

**Tout ce qui a été rencontré et qui contraint la demande y figure** : chaque
règle, chaque ADR rattachée aux domaines (`DECISION`), chaque décision de cadrage
(`DECISION_DE_CADRAGE`), chaque cadrage en cours qui recouvre. La synthèse est
courte parce qu'elle écarte ce qui ne touche pas la demande, jamais parce qu'elle
omet ce qui la touche.

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
