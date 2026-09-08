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
  après un échec ;
- **tout ou rien** : une incohérence l'arrête avant la première écriture, ce qui
  laisse le référentiel dans son état précédent, cohérent.

Le commit de propagation est distinct de celui de la livraison : le premier
porte l'intention rédigée par un humain, le second l'écriture faite par la
machine.

## Installation dans un dépôt cadré

Deux workflows à copier depuis [`modeles/`](modeles/) :

```bash
# depuis la racine du dépôt cadré
mkdir -p .github/workflows
curl -o .github/workflows/verification.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/verification-depot-cadre.yml
curl -o .github/workflows/propagation.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/propagation-depot-cadre.yml
```

Puis, dans les réglages du dépôt :

1. **Actions → General → Workflow permissions** : choisir *Read and write
   permissions*, et cocher *Allow GitHub Actions to create and approve pull
   requests*. Sans la première, la propagation ne peut rien écrire ; sans la
   seconde, elle ne peut pas ouvrir sa demande de fusion sur une branche
   protégée.
2. **Branches → règle de protection sur la branche principale** : ajouter la
   vérification comme contrôle requis. Sans cela, elle signale sans bloquer, et
   un cadrage incohérent peut être livré.

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

Le paquet ne dépend d'aucun système de fichiers : il prend un référentiel déjà
chargé, d'où qu'il vienne. C'est ce qui permet aux mêmes règles de s'appliquer
dans l'intégration continue et dans un navigateur — les dupliquer garantirait
qu'elles divergent.

`@ssk-it/canon-check/format` expose le découpage du frontmatter et l'extraction
des énoncés, pour construire ce référentiel depuis des fichiers Markdown.

## En ligne de commande

Le propagateur et le vérificateur s'utilisent hors CI :

```bash
npm ci
node src/check.mjs     /chemin/du/depot
node src/propagate.mjs /chemin/du/depot --dry-run
node src/propagate.mjs /chemin/du/depot
```

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

Le jeton s'émet en `scope=read,write`. L'écriture ne sert qu'à une chose :
reposer sur la carte, en commentaire, le lien du cadrage qui en est né. Sans ce
geste le rattachement n'existe que dans le cadrage, du côté que le client ne
consulte pas — il regarde Trello, où rien ne dit que son besoin a été instruit.
Le skill ne déplace aucune carte et n'en change ni le statut ni les étiquettes.

Le commentaire ne se poste qu'une fois par lien : reprendre un cadrage ou
relancer le skill n'empile pas de doublons sur une carte que le client lit.

## Licence

Apache-2.0 — voir [LICENSE](LICENSE) et [NOTICE](NOTICE).
