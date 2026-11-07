# @ssk-it/canon-check

La vérification d'intégrité d'un référentiel SSK Canon, publiée comme bibliothèque : une interface qui rédige un cadrage peut signaler, pendant la saisie, ce qui empêcherait sa livraison.

Cette référence est générée à chaque fusion sur `main`, depuis les déclarations de types du paquet. Elle décrit donc la branche principale, qui peut être en avance sur la dernière version publiée sur npm.

```bash
npm install @ssk-it/canon-check
```

```js
import { checkRepo, formaterAnomalie } from '@ssk-it/canon-check';

const { anomalies } = checkRepo(referentiel);
anomalies.map((a) => formaterAnomalie(a, 'en'));
```

## Les points d'entrée

| Import | Contenu |
|---|---|
| `@ssk-it/canon-check` | La vérification d'un référentiel chargé et la mise en texte de ses anomalies ; reprend `identite`, `noms` et `citations`. |
| `@ssk-it/canon-check/format` | Le découpage du frontmatter et l'extraction des énoncés. |
| `@ssk-it/canon-check/pistes` | La lecture des étiquettes d'une piste et son contrôle. |
| `@ssk-it/canon-check/identite` | La règle de l'identité visuelle. |
| `@ssk-it/canon-check/noms` | Les noms qu'un référentiel déclare dans `ssk-canon.yml`. |
| `@ssk-it/canon-check/citations` | La citation d'un autre référentiel. |

Le code source et l'Action GitHub qui utilise cette bibliothèque sont dans le dépôt [ssk-it/ssk-canon-action](https://github.com/ssk-it/ssk-canon-action).
