voir aussi: [Skanon UI](https://ssk-canon.s3-website.fr-par.scw.cloud/)
# SSK Canon — action de propagation

Vérifie l'intégrité d'un référentiel [SSK Canon](https://github.com/ssk-it/ssk-canon)
et applique aux règles de gestion les impacts des cadrages livrés.

Le **référentiel** — domaines, fonctionnalités, règles de gestion — décrit l'état
courant d'un produit. Les **cadrages** sont les unités de changement, datées, qui
le transforment. Cette action maintient le premier comme projection des seconds.

## Ce qu'elle fait

Elle compare l'état déclaré par les cadrages livrés à l'état réel du
référentiel, et n'écrit que l'écart. Deux propriétés en découlent :

- **idempotente** : sur un référentiel conforme, elle n'écrit rien. Elle peut
  donc se déclencher à chaque arrivée sur la branche principale, et être rejouée
  après un échec — ou à heure fixe : GitHub ne transmet pas toujours la poussée
  d'un merge, et le modèle de workflow rattrape ainsi seul une propagation
  perdue ;
- **tout ou rien** : une incohérence l'arrête avant la première écriture, ce qui
  laisse le référentiel dans son état précédent, cohérent.

Le commit de propagation est distinct de celui de la livraison : le premier
porte l'intention rédigée par un humain, le second l'écriture faite par la
machine.

## Installation dans un dépôt cadré

Trois workflows à copier depuis [`modeles/`](modeles/) :

```bash
# depuis la racine du dépôt cadré
mkdir -p .github/workflows
curl -o .github/workflows/verification.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/verification-depot-cadre.yml
curl -o .github/workflows/propagation.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/propagation-depot-cadre.yml
curl -o .github/workflows/pistes.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/pistes-depot-cadre.yml
```

Le troisième vérifie les pistes : voir « Rattachement des pistes ». Il ne demande
aucun réglage du dépôt — ses permissions, `contents: read` et `issues: write`, se
déclarent dans le workflow.

Puis, dans les réglages du dépôt :

1. **Actions → General → Workflow permissions** : *Read and write
   permissions*, et *Allow GitHub Actions to create and approve pull
   requests*. Sans la première, la propagation ne peut rien écrire ; sans la
   seconde, elle ne peut pas ouvrir sa demande de fusion sur une branche
   protégée — elle pousse sa branche `propagation/<sha>` puis échoue, et le
   cadrage fusionné reste sans ses index. Un script les règle et le vérifie,
   avec la session de `gh` et les droits d'administration du dépôt :

   ```bash
   outillage/preparer-depot-cadre.sh <organisation>/<depot>
   ```

   Le même script règle **General → Pull Requests → Automatically delete head
   branches** : chaque cadrage et chaque propagation laissent sinon leur branche
   derrière eux, et un commit poussé après la fusion — jamais livré — s'y perd
   parmi des dizaines d'autres.

2. **Les runners, pour un dépôt privé.** Les modèles tirent leur runner de la variable d'organisation `SSK_RUNNER_PRIVE`, visible des seuls dépôts privés : sans elle, chaque exécution — une vérification par demande de fusion, une propagation par livraison et sa reprise toutes les heures — tourne sur les runners de GitHub et se décompte du forfait de l'organisation. Un dépôt public, et une organisation sans la variable, restent sur `ubuntu-latest`. Un script la pose, une fois par organisation, et vérifie qu'un runner en ligne porte ses labels :

   ```bash
   outillage/runner-prive-organisation.sh <organisation>
   ```

3. **Branches → règle de protection sur la branche principale** : ajouter la
   vérification comme contrôle requis. Sans cela, elle signale sans bloquer, et
   un cadrage incohérent peut être livré.

La demande de propagation, ouverte par le jeton de l'automatisation, ne
déclenche aucun workflow : GitHub n'en crée pour aucun événement de ce jeton,
sauf `workflow_dispatch`. La propagation lance donc elle-même la vérification
sur la branche de sa demande — d'où `workflow_dispatch` dans le modèle de
vérification, et `actions: write` dans celui de la propagation. Un dépôt
installé avant ce lancement garde des demandes bloquées, faute du contrôle
requis : la propagation le signale, et reprendre les deux modèles y remédie.
L'entrée `verification` de l'action désigne le workflow, par son nom —
« Vérification du référentiel » par défaut — ou par son fichier.

### Pourquoi `@main` et non un tag de version

Les workflows référencent `ssk-it/ssk-canon-action@main`. Un tag mobile `v1` a
existé, et il a fait la démonstration de ce qu'on lui reproche : il est resté sur
la version 1.4.0 pendant que la branche principale prenait vingt-six commits
d'avance, si bien que les dépôts cadrés consommaient un vérificateur qui ignorait
le statut déduit. Rien ne signalait ce retard, puisqu'un tag qu'on oublie de
déplacer ne se plaint pas.

La contrepartie est réelle : ce qui arrive sur la branche principale part aussitôt
chez tous les dépôts cadrés, sans palier. Elle est assumée tant que l'outil sert
à une seule main. Le jour où d'autres équipes en dépendront, il faudra revenir à
un tag déplacé par le workflow de release, plutôt que par la mémoire de qui
publie.

Le paquet npm, lui, reste versionné : c'est une dépendance qu'on résout, non une
action qu'on exécute.

Une branche protégée refuse le push direct de la propagation, puisque ce push ne
porte aucun des contrôles qu'elle exige. La propagation ouvre alors une demande
de fusion, que les contrôles vérifient comme n'importe quelle autre — il reste à
la merger pour que le référentiel soit à jour. Le workflow doit pour cela
déclarer `pull-requests: write` à côté de `contents: write`.
Tant que cette demande attend, aucune exécution n'en ouvre une seconde.

Ce dépôt étant public, aucun réglage d'accès n'est nécessaire, y compris depuis
un dépôt cadré privé ou appartenant à une autre organisation.

## Entrées

| Entrée | Défaut | Rôle |
|---|---|---|
| `referentiel` | `.` | Chemin du référentiel, relatif à la racine du dépôt appelant. |
| `appliquer` | `false` | Écrire réellement. À `false`, signale sans modifier de fichier. |
| `commiter` | `false` | Commiter et pousser. Sans effet si `appliquer` est `false`. |
| `message` | `Propagation des impacts au référentiel` | Première ligne du message de commit. |

## Sorties

| Sortie | Rôle |
|---|---|
| `ecritures` | Nombre de règles écrites, ou qui le seraient en simulation. |

## Vérification seule

`appliquer: false` ne modifie jamais le référentiel. L'action échoue si un
cadrage est incohérent, ou si le référentiel a dérivé de ses cadrages :

```yaml
- uses: actions/checkout@v4
  with:
    # le contrôle d'immuabilité compare deux états : sans l'historique, il
    # échoue au lieu de laisser croire qu'il a eu lieu
    fetch-depth: 0
- uses: ssk-it/ssk-canon-action@main
  with:
    referentiel: '.'
    appliquer: 'false'
```

Ce qu'elle attrape, que le format seul ne garantit pas : un impact vers une
règle inexistante, un énoncé manquant pour une création ou une modification, un
rattachement vers une entité inconnue, une règle abrogée par un cadrage non
livré.

Elle contrôle aussi le répertoire `identite/`, où un référentiel peut porter
l'identité visuelle de son projet. Rien ne la déclare : c'est le nom des
fichiers qui fait foi, et un fichier mal nommé serait sinon ignoré sans bruit.

- **Noms admis** : `symbole` et `logotype`, suivis ou non de `-clair` ou
  `-sombre` — `symbole.svg`, `logotype-sombre.png` —, et un `README.md`.
- **Formats admis** : SVG, WebP et PNG, dans cet ordre de préférence.
- **Poids** : 100 Kio au plus par fichier.

Un autre nom, un autre format ou un poids dépassé est une erreur. Un même nom
en plusieurs formats, ou une variante sans sa jumelle quand aucune version sans
suffixe ne couvre l'autre fond, est signalé sans bloquer. Le répertoire n'est
pas un répertoire de contenu : ses fichiers ne sont pas lus comme des entités.

Dès que la demande de fusion est **proposée à la relecture**, elle contrôle en
outre l'état qu'aura le référentiel **une fois cette demande fusionnée** : les
cadrages qu'elle porte y sont tenus pour livrés. Ce que la livraison exigera —
le fichier de chaque règle créée, son rattachement à une fonctionnalité — est
ainsi réclamé tant qu'il est encore temps de l'écrire, et non découvert après la
fusion, quand la propagation s'arrête et qu'il n'y a plus de demande à corriger.
Un brouillon en est dispensé : il n'annonce pas de livraison, et le rendre rouge
en permanence ferait cesser de le lire.

Les index dérivés — `cree_par`, `modifie_par` — sont exclus de ce contrôle :
c'est la propagation qui les écrit, après la fusion.

Sur la branche principale, **la vérification n'a pas à être déclenchée** : la
propagation s'y exécute déjà, et vérifie le référentiel qu'elle vient d'écrire.
Deux contrôles sur la même poussée se lisent à contretemps — celui qui n'écrit
pas rapporte l'état d'avant l'autre, et échoue à chaque livraison d'un cadrage
créant une règle.

## Rattachement des pistes

Une **piste** est une issue du dépôt de référentiel étiquetée `piste` : ce qu'on
envisage pour le produit, hors du référentiel. Elle se rattache à au moins un
domaine ou une fonctionnalité par des étiquettes `domaine/<id>` et
`fonctionnalite/<id>` — RG-piste-rattachee. Une piste rattachée à rien, ou par une
étiquette qui ne désigne aucun identifiant, n'apparaît nulle part.

Une piste ne passe par aucune demande de fusion : la vérification du référentiel
ne la voit pas. Une seconde action, sous [`pistes/`](pistes/), la vérifie à
l'événement de l'issue — ouverture, modification, étiquette posée ou retirée,
réouverture — contre la branche principale, avec le même chargeur :

```yaml
- uses: ssk-it/ssk-canon-action/pistes@main
  with:
    referentiel: '.'
```

Un écart se signale par **un seul commentaire** sur l'issue, retrouvé par un
marqueur caché : mis à jour quand les étiquettes changent, supprimé quand le
rattachement est juste, ou quand l'issue n'est plus une piste. Le commentaire d'une
personne qui citerait le marqueur n'est jamais repris. L'exécution n'échoue pas :
le commentaire est le signal, à l'endroit où le rédacteur corrige.

| Entrée | Défaut | Rôle |
|---|---|---|
| `referentiel` | `.` | Chemin du référentiel, relatif à la racine du dépôt appelant. |
| `commenter` | `true` | À `false`, dit les écarts dans le journal sans rien lire ni écrire sur la plateforme. |
| `evenement` | celui du workflow | Fichier d'événement à vérifier, relatif à la racine. |
| `jeton` | `github.token` | Jeton qui lit l'issue et écrit son commentaire. |

La sortie `ecarts` donne le nombre d'écarts trouvés. En ligne de commande :

```bash
node src/verifier-piste.mjs /chemin/du/depot --evenement evenement.json --sans-commentaire
```

### Préparer les étiquettes et les jalons

Un dépôt qui accueille des pistes a besoin de l'étiquette `piste`, d'une étiquette `domaine/<id>` par domaine et `fonctionnalite/<id>` par fonctionnalité de sa branche principale, et des jalons « Maintenant », « Ensuite » et « Plus tard », sans échéance — RG-piste-horizon. Un script les crée, avec la session de `gh` et le droit d'écrire les issues du dépôt :

```bash
npm ci
outillage/preparer-pistes.sh <organisation>/<depot>
```

Les identifiants sont lus sur un clone superficiel de la branche principale, par le chargeur que la vérification utilise (`src/etiquettes-pistes.mjs`) : ceux du frontmatter, et non les noms de fichiers.

Chaque groupe d'écritures est annoncé et confirmé ; ce qui existe est laissé tel quel. Le relancer après l'ajout d'un domaine ou d'une fonctionnalité crée les étiquettes qui manquent. Une étiquette qui ne désigne plus rien est signalée, jamais supprimée : des pistes la portent peut-être encore.

## Comme bibliothèque

Le vérificateur est aussi publié comme paquet, pour être exécuté ailleurs que
dans l'intégration continue — une interface qui rédige un cadrage peut ainsi
signaler ce qui empêcherait sa livraison pendant la saisie, plutôt que de
laisser le rédacteur le découvrir après coup.

```bash
npm install @ssk-it/canon-check
```

```js
import { checkRepo } from '@ssk-it/canon-check';

// domaines, fonctionnalités, règles et cadrages indexés par identifiant
const { errors, warnings, counts } = checkRepo(referentiel);
```

`errors` et `warnings` sont des textes français. Les mêmes anomalies sont
rendues codées dans `anomalies` (RG-anomalies-codees) : un code stable, une
gravité — `erreur` ou `avertissement` — et des paramètres, valeurs du
référentiel et du format qui ne se traduisent jamais. Leur message se déduit du
code, en français ou en anglais, par la bibliothèque et nulle part ailleurs :
une interface les dit dans sa langue sans relancer la vérification, et dit
toujours ce que dit la demande de fusion.

```js
import { checkRepo, formaterAnomalie, enTexte } from '@ssk-it/canon-check';

const { anomalies } = checkRepo(referentiel);
anomalies.map((a) => formaterAnomalie(a, 'en'));
// [ 'scoping 2026-001 → unknown rule: RG-x', … ]
enTexte(anomalies, 'en'); // { errors: [...], warnings: [...] }
```

Un code ne change jamais de sens : un nouveau message, c'est un nouveau code.

Un dépôt déclare sa langue dans `ssk-canon.yml` (RG-langue-du-depot) — `fr` par
défaut, `en` sinon. C'est la langue de tout ce que l'Action écrit pour lui : le
rapport de vérification, celui de la propagation, la demande de propagation et
les commentaires sur les pistes. Une langue inconnue se signale, et le dépôt se
lit en français. `langueDuDepot(config)` la lit comme l'Action.

```yaml
# ssk-canon.yml
langue: en
```

Le paquet ne dépend d'aucun système de fichiers : il prend un référentiel déjà
chargé, d'où qu'il vienne. C'est ce qui permet aux mêmes règles de s'appliquer
dans l'intégration continue et dans un navigateur — les dupliquer garantirait
qu'elles divergent.

`@ssk-it/canon-check/format` expose le découpage du frontmatter et l'extraction
des énoncés, pour construire ce référentiel depuis des fichiers Markdown.

`@ssk-it/canon-check/pistes` expose la lecture des étiquettes d'une piste
(`estPiste`, `lireRattachementsPiste`) et son contrôle (`checkPiste`), pour qu'une
application qui affiche les pistes les rattache comme l'Action les vérifie.

`@ssk-it/canon-check/identite` expose la règle de l'identité visuelle : les
noms, les variantes et les formats admis dans leur ordre de préférence
(`FORMATS_IDENTITE`), la borne de poids, la lecture d'un nom
(`lireNomIdentite`) et le contrôle du répertoire (`checkIdentite`). Les mêmes
exports sont repris à la racine du paquet. `checkRepo` contrôle l'identité
quand le référentiel chargé porte `identite`, la liste des fichiers du
répertoire avec leur poids :

```js
checkRepo({ ...referentiel, identite: [{ chemin: 'symbole-clair.svg', taille: 812 }] });
```

`@ssk-it/canon-check/noms` résout les noms qu'un référentiel déclare dans
`ssk-canon.yml` (RG-noms-declares) : `resoudreNoms(config)` rend ses dossiers et
ses fichiers convenus, ceux du format pour toute clé absente ou fautive, et les
erreurs de la déclaration. Les mêmes exports sont repris à la racine du paquet.
`checkRepo` signale ces erreurs, et, quand le référentiel chargé porte `chemins`
— la liste de ses fichiers —, un dossier déclaré introuvable alors que celui du
nom du format existe encore.

```yaml
# ssk-canon.yml — chaque clé est facultative
dossiers:
  domaines: domaines           # domains
  fonctionnalites: fonctionnalites  # features
  regles: exigences            # rules
  cadrages: evolutions         # cadrages
  decisions: adr               # decisions — les décisions d'architecture
  architecture: conception     # architecture
  identite: marque             # identite
  decisions_cadrage: arbitrages  # decisions — dans chaque cadrage
fichiers:
  cadrage: evolution.md        # cadrage.md
  pieces_jointes: pieces-jointes.md  # attachments.md
```

Le nom se choisit à la création : sur une demande de fusion, la vérification
refuse qu'un nom déclaré change une fois son dossier créé.

Les scripts des skills tournent sans rien d'installé : `cadrage-canon` et
`consulter-referentiel` portent une copie de `src/noms.mjs` et une lecture de
`ssk-canon.yml` sans dépendance (`scripts/config-noms.mjs`).
`test/skills-noms.test.mjs` garde la copie identique et confronte la lecture à
YAML : après avoir changé `src/noms.mjs`, le recopier dans les deux skills.

## En ligne de commande

Le propagateur et le vérificateur s'utilisent hors CI :

```bash
npm ci
node src/check.mjs     /chemin/du/depot
node src/check.mjs     /chemin/du/depot --base origin/main --livraison
node src/propagate.mjs /chemin/du/depot --dry-run
node src/propagate.mjs /chemin/du/depot
```

`--livraison` demande le contrôle de l'état post-fusion, celui que
l'intégration continue applique aux demandes prêtes à relire. Il tient compte du
travail non encore enregistré : le cadrage qu'on vient d'écrire y compte comme
porté par la demande, ce qui est précisément le moment où l'on veut savoir ce
qui manque.

Une branche que la base a déjà fusionnée — le cas d'un `fetch` qui suit la fusion
— est signalée par un avertissement « branche déjà fusionnée ». Ses index dérivés
n'y sont pas contrôlés : la base porte son cadrage livré sans encore la
propagation qui en écrira les index, et ce retard n'est pas une erreur du
rédacteur. Un cadrage livré repris après la fusion reste refusé.

## Développement

`test/fixture-repo/` est une copie du dépôt de référence
[`ssk-it/ssk-canon`](https://github.com/ssk-it/ssk-canon), qui décrit SSK Canon
dans son propre format. Elle sert de jeu de test réaliste, en complément des
tests unitaires qui construisent leurs propres dépôts temporaires.

```bash
npm test              # tests unitaires du propagateur
npm run check         # intégrité de la fixture
npm run propagate:dry # la fixture ne doit pas dériver
```

## Publier une version

La publication se fait depuis l'intégration continue, jamais à la main : une
version publiée depuis un poste ne dit pas de quel commit elle vient, et le
décalage entre le dépôt et le registre passe inaperçu.

**L'action et le paquet partagent une seule numérotation.** Ils vivent dans le
même dépôt et évoluent ensemble : deux suites de versions sur les mêmes tags
n'apporteraient qu'une ambiguïté sur ce que `v1.3.0` désigne.

```bash
npm version patch          # ou minor, major — met à jour package.json et tague
git push && git push --tags
gh release create v1.5.0 --generate-notes
```

C'est la **publication de la release** qui déclenche npm, non la pose du tag. Un
tag seul publiait sans que rien ne raconte la version : les notes se rattrapaient
après coup, quand on y pensait.

Les notes se génèrent depuis les demandes de fusion mergées depuis la version
précédente — raison pour laquelle les modifications de ce dépôt passent par une
demande de fusion, même seul.

Le workflow vérifie ensuite que l'étiquette correspond à la version du paquet,
rejoue les tests et la vérification, puis publie. Une release posée sans avoir
incrémenté la version échoue avant toute publication.

L'alias de version majeure, que les dépôts cadrés consomment, se déplace
séparément :

```bash
git tag -f -a v1 -m "Alias vers la dernière v1.x" && git push --force origin v1
```

### Aucun jeton à détenir

La publication s'authentifie par attestation — npm reconnaît le workflow lui-même
plutôt qu'un secret. Rien à faire tourner, rien qui puisse fuir, et l'origine de
chaque version publiée est vérifiable publiquement.

Le paramétrage se fait une fois, sur npmjs.com, dans les réglages du paquet →
*Trusted Publisher* :

| Champ | Valeur |
|---|---|
| Provider | GitHub Actions |
| Organization | `ssk-it` |
| Repository | `ssk-canon-action` |
| Workflow filename | `publier.yml` |

Le nom du fichier doit correspondre **exactement**, casse comprise : c'est lui
que npm vérifie dans l'attestation. Renommer ce workflow sans mettre à jour ce
réglage ferait échouer la publication.

## Le skill de cadrage

`skills/cadrage-canon/` porte un skill Claude Code qui rédige un cadrage dans le
format décrit ici. Il vit auprès du vérificateur plutôt que dans un projet
client : quand le format change, le skill suit, et une seule description du
format existe au monde.

L'installer chez soi :

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/cadrage-canon ~/.claude/skills/
```

Puis dire où les référentiels sont clonés sur cette machine, dans
`~/.claude/cadrage-canon.json` :

```json
{ "projets": ["~/chemin/vers/le-depot-de-cadrage"] }
```

Un champ `arret` facultatif dit jusqu'où le skill va une fois le cadrage écrit :
`ecriture` (le défaut, il n'enregistre rien), `commit`, `push` ou `pr`. Il se
règle globalement ou par projet, celui du projet primant :

```json
{
  "arret": "commit",
  "projets": [{ "chemin": "~/chemin/vers/un-autre", "arret": "pr" }]
}
```

L'ouverture du chantier — une issue par dépôt de code impacté, une fois la
demande de fusion du cadrage ouverte — ne relève pas de ce réglage : elle écrit
dans un autre dépôt que le référentiel, et ne se fait donc jamais sans validation
explicite, quel que soit l'`arret`.

Rien n'est à configurer dans les dépôts de code : le skill reconnaît le dépôt
courant à son `origin`, et cherche le projet dont le `ssk-canon.yml` déclare ce
dépôt. Le lien est ainsi déclaré une seule fois, du côté qui a autorité :

```yaml
depots_code:
  - { repo: organisation/depot-front, role: Application web }
  - { repo: organisation/depot-back, role: API }
```

L'application de cadrage propose ce skill au téléchargement depuis ses réglages.

### Le mettre à jour

`skills/cadrage-canon-update/` dit par où passer. Le skill existe en trois
exemplaires — la source ici, la copie installée chez le développeur, et ce que
la branche principale sert — et modifier la copie installée est le piège : le
changement fonctionne chez soi, disparaît à la réinstallation suivante, et
n'atteint personne.

```bash
node ~/.claude/skills/cadrage-canon-update/scripts/comparer.mjs
```

Le script dit lequel des trois a bougé avant qu'on n'écrase quoi que ce soit.

Rien en intégration continue ne vérifie ces skills : ce que `cadrage-canon-update`
décrit est la seule vérification qui existe.

## Cadrer depuis une carte Trello

`skills/cadrage-depuis-trello/` part d'une carte plutôt que d'une page blanche :
il en lit le titre, la description, les checklists, les commentaires et les
pièces jointes, puis passe la matière à `cadrage-canon`. Une carte exprime un
besoin succinctement ; le cadrage l'instruit.

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/cadrage-depuis-trello ~/.claude/skills/
```

Il lui faut des identifiants Trello, dans `~/.claude/trello.json` :

```json
{ "cle": "<clé API>", "jeton": "<jeton>" }
```

Le jeton s'émet en `scope=read,write`. L'écriture ne sert qu'à deux choses :
reposer sur la carte, en commentaire, le lien du cadrage qui en est né, et y
attacher en pièce jointe chaque demande de fusion que la carte fait ouvrir. Sans
ce geste le rattachement n'existe que dans le cadrage, du côté que le client ne
consulte pas — il regarde Trello, où rien ne dit que son besoin a été instruit.
Le skill ne déplace aucune carte et n'en change ni le statut ni les étiquettes.

Le commentaire ne se poste qu'une fois par lien, la pièce jointe ne s'attache
qu'une fois par URL : reprendre un cadrage ou relancer le skill n'empile pas de
doublons sur une carte que le client lit.

## Consulter le référentiel avant de cadrer ou de développer

`skills/consulter-referentiel/` dit ce que le référentiel sait déjà d'un sujet :
les règles en vigueur d'un domaine, les décisions prises, les cadrages livrés, et
ceux encore en cours sur leur branche — les seuls qu'on ne voit nulle part
ailleurs, et donc ceux qu'on risque de refaire ou de contredire.

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/consulter-referentiel ~/.claude/skills/
```

Il s'installe à côté de `cadrage-canon`, dont il emprunte la situation : une seule
manière de trouver le référentiel du dépôt courant. `cadrage-canon` l'applique
avant d'écrire ; les skills de cadrage et d'évolution des dépôts de code y
renvoient d'une ligne, plutôt que d'en recopier chacun la méthode.

Il lit `origin/main` et les branches distantes, jamais la copie de travail : un
clone de référentiel ouvert une fois et jamais tiré a vite des dizaines de
livraisons de retard.

Il s'exécute dans un sous-agent (`context: fork`) : une consultation lit une
quinzaine de milliers de tokens de cadrages et de règles, dont l'appelant ne
reçoit que la synthèse. Il faut donc lui passer en argument le texte de la
demande — le sous-agent ne voit pas la conversation.

```bash
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs                      # index
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --domaine commande   # un domaine
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --issue depot#123    # le cadrage d'une issue
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --motif "QR code"    # un terme métier
```

## Licence

Apache-2.0 — voir [LICENSE](LICENSE) et [NOTICE](NOTICE).
