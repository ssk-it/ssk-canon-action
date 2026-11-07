[Contents](../../README.en.md#documentation) · [Français](../action.md)

# Action inputs and outputs

## Inputs

| Input | Default | Role |
|---|---|---|
| `referentiel` | `.` | Path of the référentiel, relative to the root of the calling repository. |
| `appliquer` | `false` | Actually write. At `false`, reports without modifying any file. |
| `commiter` | `false` | Commit and push. No effect if `appliquer` is `false`. |
| `message` | `Propagation des impacts au référentiel` | First line of the commit message. |
| `jeton-referentiels-cites` | — | Read-only token on private cited référentiels: see [Citing another référentiel](citations.md). |

## Outputs

| Output | Role |
|---|---|
| `ecritures` | Number of rules written, or that would be in a dry run. |
