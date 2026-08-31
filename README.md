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
   permissions*. Sans cela, la propagation ne peut pas pousser son commit.
2. **Branches → règle de protection sur la branche principale** : ajouter la
   vérification comme contrôle requis. Sans cela, elle signale sans bloquer, et
   un cadrage incohérent peut être livré.

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
- uses: ssk-it/ssk-canon-action@v1
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
```

Le workflow vérifie que le tag correspond à la version du paquet, rejoue les
tests et la vérification, puis publie. Un tag posé sans avoir incrémenté la
version échoue avant toute publication.

L'alias de version majeure, que les dépôts cadrés consomment, se déplace
séparément :

```bash
git tag -f -a v1 -m "Alias vers la dernière v1.x" && git push --force origin v1
```

Le secret `NPM_TOKEN` doit être un jeton **Automation** créé sur npmjs.com :
c'est le seul type qui contourne la double authentification, laquelle ne peut
pas être saisie depuis un runner.

## Licence

Apache-2.0 — voir [LICENSE](LICENSE) et [NOTICE](NOTICE).
