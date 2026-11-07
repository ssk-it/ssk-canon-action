[Contents](../../README.en.md#documentation) · [Français](../pistes.md)

# Linking tracks

A **track** (*piste*) is an issue of the référentiel repository labelled `piste`: what is being considered for the product, outside the référentiel. It is linked to at least one domain or feature through `domaine/<id>` and `fonctionnalite/<id>` labels — RG-piste-rattachee. A track linked to nothing, or through a label that designates no identifier, appears nowhere.

A track goes through no pull request: the référentiel verification does not see it. A second action, under [`pistes/`](../../pistes/), checks it on the issue event — opening, edit, label added or removed, reopening — against the main branch, with the same loader:

```yaml
- uses: ssk-it/ssk-canon-action/pistes@main
  with:
    referentiel: '.'
```

A discrepancy is reported by **a single comment** on the issue, found again through a hidden marker: updated when the labels change, deleted when the link is right, or when the issue is no longer a track. A comment by someone quoting the marker is never taken over. The run does not fail: the comment is the signal, where the author makes the fix.

| Input | Default | Role |
|---|---|---|
| `referentiel` | `.` | Path of the référentiel, relative to the root of the calling repository. |
| `commenter` | `true` | At `false`, reports discrepancies in the log without reading or writing anything on the platform. |
| `evenement` | the workflow's | Event file to check, relative to the root. |
| `jeton` | `github.token` | Token that reads the issue and writes its comment. |

The `ecarts` output gives the number of discrepancies found. On the command line:

```bash
node src/verifier-piste.mjs /chemin/du/depot --evenement evenement.json --sans-commentaire
```

## Preparing labels and milestones

A repository that hosts tracks needs the `piste` label, one `domaine/<id>` label per domain and one `fonctionnalite/<id>` per feature of its main branch, and the milestones « Maintenant », « Ensuite » and « Plus tard » (now, next, later), without due date — RG-piste-horizon. A script creates them, with the `gh` session and the right to write the repository's issues:

```bash
npm ci
outillage/preparer-pistes.sh <organisation>/<depot>
```

The identifiers are read on a shallow clone of the main branch, by the loader the verification uses (`src/etiquettes-pistes.mjs`): those of the frontmatter, not the file names.

Each group of writes is announced and confirmed; what exists is left as it is. Running it again after adding a domain or a feature creates the missing labels. A label that no longer designates anything is reported, never deleted: tracks may still carry it.
