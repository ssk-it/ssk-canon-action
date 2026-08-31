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

## Licence

Apache-2.0 — voir [LICENSE](LICENSE) et [NOTICE](NOTICE).
