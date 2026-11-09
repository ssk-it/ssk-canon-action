see also: [Skanon UI](https://ssk-canon.s3-website.fr-par.scw.cloud/) · [Français](README.md)
# SSK Canon — propagation action

Checks the integrity of an [SSK Canon](https://github.com/ssk-it/ssk-canon) repository and applies the impacts of delivered scopings (*cadrages*) to the business rules.

The **référentiel** — domains, features, business rules — describes the current state of a product. **Cadrages** (scopings) are the dated units of change that transform it. This action keeps the former a projection of the latter.

## What it does

It compares the state declared by the delivered cadrages with the actual state of the référentiel, and writes only the difference. Two properties follow:

- **idempotent**: on a compliant référentiel, it writes nothing. It can therefore run on every push to the main branch, and be replayed after a failure — or on a schedule: GitHub does not always deliver the push of a merge, and the workflow template thus catches up on a lost propagation by itself;
- **all or nothing**: an inconsistency stops it before the first write, which leaves the référentiel in its previous, consistent state.

The propagation commit is separate from the delivery commit: the latter carries the intent written by a human, the former the write made by the machine.

## Installation in a scoped repository

Three workflows to copy from [`modeles/`](modeles/):

```bash
# from the root of the scoped repository
mkdir -p .github/workflows
curl -o .github/workflows/verification.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/verification-depot-cadre.yml
curl -o .github/workflows/propagation.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/propagation-depot-cadre.yml
curl -o .github/workflows/pistes.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/pistes-depot-cadre.yml
```

The third one checks the tracks (*pistes*): see [Linking tracks](docs/en/pistes.md). It needs no repository setting — its permissions, `contents: read` and `issues: write`, are declared in the workflow.

Then, in the repository settings:

1. **Actions → General → Workflow permissions**: *Read and write permissions*, and *Allow GitHub Actions to create and approve pull requests*. Without the first, the propagation cannot write anything; without the second, it cannot open its pull request on a protected branch — it pushes its `propagation/<sha>` branch then fails, and the merged cadrage is left without its indexes. A script sets them and checks them, with the `gh` session and admin rights on the repository:

   ```bash
   outillage/preparer-depot-cadre.sh <organisation>/<depot>
   ```

   The same script sets **General → Pull Requests → Automatically delete head branches**: otherwise every cadrage and every propagation leaves its branch behind, and a commit pushed after the merge — never delivered — gets lost among dozens of others. Above all, the référentiel consultation goes through them as work in progress: see [Consult the référentiel before scoping or developing](docs/en/skills.md#consult-the-référentiel-before-scoping-or-developing).

   A setting added to the script only reaches the repositories it is run again on. A second script runs it on every référentiel that `~/.claude/cadrage-canon.json` declares, with the same confirmations, and names at the end those still to be set:

   ```bash
   outillage/preparer-depots-cadres.sh
   ```

2. **Runners, for a private repository.** The templates take their runner from the organisation variable `SSK_RUNNER_PRIVE`, visible to private repositories only: without it, every run — one verification per pull request, one propagation per delivery and its hourly retry — runs on GitHub's runners and counts against the organisation's plan. A public repository, and an organisation without the variable, stay on `ubuntu-latest`. A script sets it, once per organisation, and checks that an online runner carries its labels:

   ```bash
   outillage/runner-prive-organisation.sh <organisation>
   ```

3. **Branches → protection rule on the main branch**: add the verification as a required check. Without it, the verification reports without blocking, and an inconsistent cadrage can be delivered.

4. **The automation's app.** A main branch that refuses direct pushes receives the propagation's writes through a pull request. Opened with the workflow token, that pull request gets its checks put in an approval-required state, and the pending run blocks the merge even once `verifier` is green: on ssk-terrarium-cadrage, #24 and #25 waited for it. The propagation therefore opens its pull request under the identity of a dedicated GitHub App, `ssk-canon-propagation`, whose installation token triggers the checks without approval, and asks for its automatic merge: the pull request merges by itself once `verifier` is green, and never before ([RG-propagation-identite-dediee](https://ssk-canon.s3-website.fr-par.scw.cloud/ssk-it/ssk-canon/referentiel/regle/RG-propagation-identite-dediee)). A script creates the app, once, sets its client ID (variable `SSK_CANON_APP_ID`) and its private key (secret `SSK_CANON_APP_CLE`) on the organisations — visible to their specifications only — or on each specification of a personal account, then guides its installation:

   ```bash
   outillage/application-propagation.sh
   ```

   `preparer-depot-cadre.sh` then allows automatic merge on the repository, and has the propagation workflow pass the identity, through a pull request. Without it, the propagation falls back on the workflow token and says so: it then starts the verification itself on its pull request's branch, by `workflow_dispatch`, the one event of that token that creates a run at once — hence `workflow_dispatch` in the verification template, and `actions: write` in the propagation one —, and the pull request waits for an approval. The action's `verification` input names that workflow, by its name — « Vérification du référentiel » by default — or by its file.

   A pending propagation pull request that the main branch has overtaken — a cadrage merged in the meantime — is updated by the next run: a main branch that requires an up-to-date branch would block it otherwise.

### Why `@main` and not a version tag

The workflows reference `ssk-it/ssk-canon-action@main`. A moving `v1` tag existed, and it demonstrated what it is blamed for: it stayed on version 1.4.0 while the main branch got twenty-six commits ahead, so that scoped repositories consumed a checker that ignored the deduced status. Nothing reported the lag, since a tag one forgets to move does not complain.

The trade-off is real: whatever lands on the main branch reaches every scoped repository at once, without a stage. It is accepted as long as the tool serves a single hand. The day other teams depend on it, a tag moved by the release workflow, rather than by the memory of whoever publishes, will have to come back.

The npm package, on the other hand, stays versioned: it is a dependency one resolves, not an action one runs.

A protected branch refuses the propagation's direct push, since that push carries none of the checks it requires. The propagation then opens a pull request, which the checks verify like any other — it remains to merge it for the référentiel to be up to date. The workflow must for this declare `pull-requests: write` next to `contents: write`. While that pull request waits, no run opens a second one.

This repository being public, no access setting is needed, including from a private scoped repository or one belonging to another organisation.

## Documentation

- [Action inputs and outputs](docs/en/action.md)
- [Verification only](docs/en/verification.md) — what the verification catches, the visual identity, the post-merge state check
- [Citing another référentiel](docs/en/citations.md) — `referentiels_cites`, `applique`, and read access to private cited référentiels
- [Linking tracks](docs/en/pistes.md) — the `pistes/` action, labels and milestones
- [As a library](docs/en/bibliotheque.md) — the `@ssk-it/canon-check` package, its submodules and `ssk-canon.yml`
- `@ssk-it/canon-check` API reference — coming
- [Command line](docs/en/ligne-de-commande.md)
- [Development](docs/en/developpement.md)
- [Publishing a version](docs/en/publication.md)
- [The skills](docs/en/skills.md) — [scoping](docs/en/skills.md#the-scoping-skill), [keeping it up to date](docs/en/skills.md#updating-it), [scoping from a Trello card](docs/en/skills.md#scoping-from-a-trello-card), [consulting the référentiel](docs/en/skills.md#consult-the-référentiel-before-scoping-or-developing)

## The scoping skill

`skills/cadrage-canon/` holds a Claude Code skill that writes a cadrage in the format this action checks. Its installation and settings are described in [The skills](docs/en/skills.md#the-scoping-skill).

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
