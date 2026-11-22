[Contents](../../README.en.md#documentation) · [Français](../pratiques.md)

# Practices

## The setup scripts

The scripts of [`outillage/`](../../outillage/) write outside the repository: settings, rules, variables and secrets of GitHub repositories and organisations. They are run rarely, often months after being written, and on a repository that is not this one. Each sources [`outillage/lib/ecritures-confirmees.sh`](../../outillage/lib/ecritures-confirmees.sh), which carries the banner, the confirmations, the modes, the locale and the typing of a secret.

The practice holds in nine points, detailed in the reference shared by the ssk-it repositories (`skills/initialiser-projet/references/scripts.md` in the ssk-it/claude-config repository, where the library and the check also come from):

1. **A banner, then one overall confirmation**: the machine, the GitHub account of the `gh` session, the repository or organisation aimed at, what the script may write, its parameters and where each comes from, its mode — then « Commencer ? ».
2. **A confirmation before each write** (`[o/N]`), `--noconfirm` for a run decided beforehand, `--dry-run` which reads and announces everything without writing anything; no secret as an argument, on screen or in a file, and the answer read on the terminal, never on standard input.
3. **Idempotent, with a final check**: what is in place is left as is, a replacement is a write of its own, and a last read-only step checks the result — alone, with `--constat`.
4. **Split into steps**, one responsibility each; a thin orchestrator chains them and does nothing else.
5. **A stable output**: `LC_ALL` on a UTF-8 locale, and bash 3.2, the one of macOS.
6. **A sentence at the top**: what the script does, the command that runs it, and what it deliberately does not do; `--aide` repeats it.
7. **A requested token is explained**: its platform, its role, its lifetime, its least permissions, and where to get it.
8. **A chosen password is offered to the keychain**, under an entry that names the user and the target.
9. **Parameterised**: what varies from one use to another goes through an option or an environment variable, with a safe default; never a secret.

### What is specific to this repository

- **A single target: GitHub, through the `gh` session.** No script asks for a credential, except `jeton-referentiels-cites.sh`, which asks for the token it sets as a secret, says where it comes from and what it may do, and passes it to `gh` on standard input.
- **The usual parameters** are `--depot <organisation>/<depot>` and `--organisation <organisation>`, each with its environment variable (`DEPOT`, `ORGANISATION`). The former positional form is still accepted: `preparer-depot-cadre.sh <organisation>/<depot>`.
- **`preparer-depot-cadre.sh` serves every scoped repository**: it creates the repository from its clone if it does not exist (`--source`, `--visibilite`, `--description`), sets the deletion of merged branches and the opening of pull requests by workflows, and with `--controles` sets the ruleset that requires the verification on the main branch. A référentiel does not copy a GitHub setup script of its own: it runs this one with its parameters.
- **The orchestrator is `preparer-depots-cadres.sh`**: it runs `preparer-depot-cadre.sh` on each référentiel that `~/.claude/cadrage-canon.json` declares, after a single banner, with neither creation nor required checks.
- **The language**: the scripts' comments are in English, like the code; what the user reads — banner, questions, check, `--aide` — is in French, like the library ([Development](developpement.md#language-of-the-code)).

### The check

The « Scripts de mise en place » job of the [Vérification](../../.github/workflows/ci.yml) workflow runs [`outillage/verifier-scripts-de-mise-en-place.sh`](../../outillage/verifier-scripts-de-mise-en-place.sh) on `outillage/`, in the `bash:3.2.57` Docker image pinned by its digest, on GitHub's runners — the repository is public. It checks that each script reads under bash 3.2, uses no bash 4 construct, passes `shellcheck` and answers `--aide` without asking anything; it also checks that each `.ps1` carries its UTF-8 BOM. The repository has no PowerShell script: a first `.ps1` keeps its BOM, and comes with `ecritures-confirmees.ps1`, copied from the same template.

On a Mac, the check runs as is — `/bin/bash` is 3.2 there, and `shellcheck` installs with `brew install shellcheck`:

```bash
outillage/verifier-scripts-de-mise-en-place.sh outillage
```

The library and the check are copies of the template: a fix is made in the template first, then copied here, otherwise the repositories drift apart. The banner, the confirmations, idempotence and the final check are judged in review.
