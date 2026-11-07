[Sommaire](../README.md#documentation) · [English](en/bibliotheque.md)

# Comme bibliothèque

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

`@ssk-it/canon-check/citations` expose la citation d'un autre référentiel ([Citer un autre référentiel](citations.md)) : `lireCitation(texte)` rend `{ prefixe, id, cadrage }` ou `null`, `referentielsCites(config)` les dépôts déclarés par préfixe, `resoudrePrefixe(prefixe, config)` ce que désigne un préfixe (`projet`, `cite` avec son `repo`, ou `inconnue`), `comparerCadrages(a, b)` l'ordre de deux cadrages, et `etatDesCitations(referentiel, { cites })` l'état de chaque citation — `a-jour`, `perimee`, `abrogee`, `absente`, `non-verifiee`, `prefixe-inconnu` ou `mal-formee` —, pour qu'une interface l'affiche sur la citation ; `etatDeCible(citation, cible, { lu })` rend le même état pour une seule citation, face à la cible qu'on a lue soi-même. Les mêmes exports sont repris à la racine du paquet. `checkRepo` en rend les avertissements quand on lui passe `cites`, les référentiels cités déjà chargés par préfixe, `null` pour ceux qui n'ont pas pu l'être ; un préfixe absent se dit non vérifié.

```js
checkRepo(referentiel, { cites: new Map([['socle', referentielDuSocle], ['autre', null]]) });
```

Les scripts des skills tournent sans rien d'installé : `cadrage-canon` et
`consulter-referentiel` portent une copie de `src/noms.mjs` et une lecture de
`ssk-canon.yml` sans dépendance (`scripts/config-noms.mjs`).
`test/skills-names.test.mjs` garde la copie identique et confronte la lecture à
YAML : après avoir changé `src/noms.mjs`, le recopier dans les deux skills.
