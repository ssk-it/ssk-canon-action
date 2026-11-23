[Contents](../../README.en.md#documentation) · [Français](../developpement.md)

# Development

`test/fixture-repo/` is a copy of the reference repository [`ssk-it/ssk-canon`](https://github.com/ssk-it/ssk-canon), which describes SSK Canon in its own format. It serves as a realistic test set, alongside the unit tests that build their own temporary repositories.

```bash
npm test              # propagator unit tests
npm run check         # fixture integrity
npm run propagate:dry # the fixture must not drift
```

## The Action's steps

Every step of the composite actions (`action.yml`, `pistes/action.yml`) is a Node script — `shell: node {0}` — that hands over to a module of `src/action/` through `launcher.cjs`. None is written in bash, pwsh or cmd: the shell a self-hosted runner has depends on how it was installed (a Windows service has bash only if its PATH says so), whereas Node is already required by the Action.

- What a step is given reaches it through the environment (`env:`), never pasted into the script: a message or a workflow name that holds a quote or a `$(…)` stays a string.
- A module exports `main(env, …)`; what it calls and a test must replace (`gh`, the two command-line tools) is passed as the second argument. `git` is the real one: the tests build real repos, with a throwaway `origin`.
- A command-line tool runs only if it is the main module: `isMainModule(import.meta.url)`, never a comparison with `file://${process.argv[1]}`, which is false on Windows and through a symbolic link.
- `npm` is launched through `runNpm`: on Windows it is `npm.cmd`, which Node refuses to start without a shell.

CI runs the action on Linux, Windows and macOS, and the steps' tests on Windows. A self-hosted runner does not have the image of GitHub's runners: `git`, `gh` and an SSH client must be installed on it.

## Language of the code

The code is in English: identifiers, comments, test descriptions, internal module names. Domain vocabulary takes the English name the glossary below gives it, and only that one — the same as [skanon-web](https://github.com/ssk-it/skanon-web/blob/main/docs/glossary.md), so that a word searched in one is found in the other.

What stays in French, because the code does not own it:

- **the format**: YAML keys (`cree_par`, `domaines`, `dossiers`), status, operation and kind values (`cree`, `livree`, `regle`), folder names (`cadrages/`, `identite/`), labels (`piste`, `domaine/<id>`) — RG-textes-traduits, RG-noms-declares;
- **anomaly codes and their parameters**, stable for life, and the `erreur` / `avertissement` severity — RG-anomalies-codees;
- **what the user reads**: the catalogue messages, already in both languages, the logs, the prompts of the `outillage/` scripts;
- **public contracts, until their migration**: the exports of `@ssk-it/canon-check` and the fields of its objects, the inputs and outputs of the actions, the command-line options. They move to English with deprecated French aliases, never all at once: their consumers follow `main`.

| Format term | Code term |
|---|---|
| référentiel | `specification` |
| dépôt | `repo` |
| domaine, fonctionnalité, règle, énoncé | `domain`, `feature`, `rule`, `statement` |
| décision d'architecture, document d'architecture | `adr`, architecture document |
| cadrage, livraison | `scoping`, `delivery` |
| impact, cible, nature, opération | `impact`, `target`, `kind`, `operation` |
| créé par, modifié par | `createdBy`, `modifiedBy` |
| propagation, écritures | `propagation`, `writes` |
| piste, rattachement, étiquette | `roadmapItem`, `link`, `label` |
| écart, anomalie, gravité | `discrepancy`, `anomaly`, `severity` |
| citation, préfixe | `citation`, `prefix` |
| identité, symbole, variante | `identity`, `symbol`, `variant` |
| noms déclarés, dossier | `names`, `folder` |
| pièce jointe, empreinte | `attachment`, `fingerprint` |
| langue, jeton | `language`, `token` |
