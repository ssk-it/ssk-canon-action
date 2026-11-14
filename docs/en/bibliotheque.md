[Contents](../../README.en.md#documentation) · [Français](../bibliotheque.md)

# As a library

The checker is also published as a package, to be run elsewhere than in continuous integration — an interface that writes a cadrage can thus report what would prevent its delivery while it is being typed, rather than letting the author find out afterwards.

```bash
npm install @ssk-it/canon-check
```

Every exported function, type and constant is described in the [API reference](https://ssk-it.github.io/ssk-canon-action/), generated from the type declarations on every merge to `main`. It is written in French, like the declarations it comes from.

```js
import { checkRepo } from '@ssk-it/canon-check';

// domains, features, rules and cadrages indexed by identifier
const { errors, warnings, counts } = checkRepo(referentiel);
```

`errors` and `warnings` are French texts. The same anomalies are returned coded in `anomalies` (RG-anomalies-codees): a stable code, a severity — `erreur` or `avertissement` — and parameters, values from the référentiel and the format that are never translated. Their message is derived from the code, in French or in English, by the library and nowhere else: an interface states them in its own language without running the verification again, and always says what the pull request says.

```js
import { checkRepo, formaterAnomalie, enTexte } from '@ssk-it/canon-check';

const { anomalies } = checkRepo(referentiel);
anomalies.map((a) => formaterAnomalie(a, 'en'));
// [ 'scoping 2026-001 → unknown rule: RG-x', … ]
enTexte(anomalies, 'en'); // { errors: [...], warnings: [...] }
```

A code never changes meaning: a new message is a new code.

A repository declares its language in `ssk-canon.yml` (RG-langue-du-depot) — `fr` by default, `en` otherwise. It is the language of everything the Action writes for it: the verification report, the propagation report, the propagation pull request and the comments on tracks. An unknown language is reported, and the repository is read in French. `langueDuDepot(config)` reads it as the Action does.

```yaml
# ssk-canon.yml
langue: en
```

The package depends on no file system: it takes an already loaded référentiel, wherever it comes from. This is what lets the same rules apply in continuous integration and in a browser — duplicating them would guarantee they diverge.

`@ssk-it/canon-check/format` exposes the frontmatter split and the extraction of statements, to build that référentiel from Markdown files.

`@ssk-it/canon-check/pistes` exposes the reading of a track's labels (`estPiste`, `lireRattachementsPiste`) and its check (`checkPiste`), so that an application displaying tracks links them as the Action checks them.

`@ssk-it/canon-check/identite` exposes the visual identity rule: the allowed names, variants and formats in their order of preference (`FORMATS_IDENTITE`), the weight limit, the reading of a name (`lireNomIdentite`) and the check of the directory (`checkIdentite`). The same exports are repeated at the package root. `checkRepo` checks the identity when the loaded référentiel carries `identite`, the list of the directory's files with their weight:

```js
checkRepo({ ...referentiel, identite: [{ chemin: 'symbole-clair.svg', taille: 812 }] });
```

`@ssk-it/canon-check/noms` resolves the names a référentiel declares in `ssk-canon.yml` (RG-noms-declares): `resoudreNoms(config)` returns its agreed folders and files, the format's for any absent or faulty key, and the errors of the declaration. The same exports are repeated at the package root. `checkRepo` reports these errors, and, when the loaded référentiel carries `chemins` — the list of its files —, a declared folder that cannot be found while the one with the format's name still exists.

```yaml
# ssk-canon.yml — every key is optional
dossiers:
  domaines: domaines           # domains
  fonctionnalites: fonctionnalites  # features
  regles: exigences            # rules
  cadrages: evolutions         # cadrages
  decisions: adr               # decisions — architecture decisions
  architecture: conception     # architecture
  identite: marque             # identite
  decisions_cadrage: arbitrages  # decisions — in each cadrage
fichiers:
  cadrage: evolution.md        # cadrage.md
  pieces_jointes: pieces-jointes.md  # attachments.md
```

The name is chosen at creation: on a pull request, the verification refuses that a declared name changes once its folder exists.

`@ssk-it/canon-check/citations` exposes the citation of another référentiel ([Citing another référentiel](citations.md)): `lireCitation(texte)` returns `{ prefixe, id, cadrage }` or `null`, `referentielsCites(config)` the repositories declared by prefix, `resoudrePrefixe(prefixe, config)` what a prefix designates (`projet`, `cite` with its `repo`, or `inconnue`), `comparerCadrages(a, b)` the order of two cadrages, and `etatDesCitations(referentiel, { cites })` the state of each citation — `a-jour`, `perimee`, `abrogee`, `absente`, `non-verifiee`, `prefixe-inconnu` or `mal-formee` —, so that an interface displays it on the citation; `etatDeCible(citation, cible, { lu })` returns the same state for a single citation, against the target one has read oneself. The same exports are repeated at the package root. `checkRepo` returns their warnings when given `cites`, the already loaded cited référentiels by prefix, `null` for those that could not be; an absent prefix says it is unverified.

```js
checkRepo(referentiel, { cites: new Map([['socle', referentielDuSocle], ['autre', null]]) });
```

The skills' scripts run with nothing installed: `cadrage-canon` and `consulter-referentiel` carry a copy of `src/noms.mjs` and a dependency-free reading of `ssk-canon.yml` (`scripts/config-noms.mjs`). `test/skills-names.test.mjs` keeps the copy identical and checks the reading against YAML: after changing `src/noms.mjs`, copy it again into both skills.
