[Contents](../../README.en.md#documentation) · [Français](../citations.md)

# Citing another référentiel

A rule shared by several products — role naming in a common identity provider, the designated runners — lives once, in the référentiel of the platform that implements it; the applications' référentiels **cite** it without copying it (RG-regle-du-socle-citee, cadrage [ssk-canon#2026-068](https://ssk-canon.s3-website.fr-par.scw.cloud/ssk-it/ssk-canon/cadrages/2026-068)). There is no inheritance: a product applies only what it cites.

The citing référentiel declares, in its `ssk-canon.yml`, the repository each prefix designates. The prefix is an alias of its own, and cannot be the project's:

```yaml
referentiels_cites:
  - { prefixe: socle, repo: Vanex-Proprete/prime-infra-cadrage }
```

A rule or an architecture decision cites through its `applique` field, with the cadrage of the cited référentiel it has taken into account:

```yaml
applique:
  - socle:RG-nommage-des-roles@2026-012
```

A prefix designates the project itself or a cited référentiel; any other prefix is an unknown address (RG-prefixe-projet).

Like the link to features, `applique` is written in the file of the rule or the decision, on the branch of the cadrage that cites it or that takes a change of the target into account; the propagation keeps it on every rewrite, without ever choosing it.

The verification reads the default branch of each cited référentiel, and **warns** (RG-citation-signalee-chez-le-citant) when the target:

- has been modified by a cadrage more recent than the one noted — `citation-perimee`; a cadrage of the citing référentiel takes it into account by updating the noted number;
- is repealed — `citation-abrogee` —, or cannot be found — `citation-absente`;
- could not be read, for lack of access to the cited référentiel — `citation-non-verifiee`, which does not mean valid.

Added to these are `citation-mal-formee`, `citation-prefixe-inconnu`, and for the declaration `referentiels-cites-mal-forme`, `referentiel-cite-mal-forme`, `referentiel-cite-en-double` and `referentiel-cite-prefixe-du-projet`. They are never errors: the target changes in another repository, and blocking would fail pull requests of the citing référentiel that have nothing to do with it. The cited référentiel does not know who cites it.

## Read access to the cited référentiel

A **public** cited référentiel is read without any setting. A **private** cited référentiel needs a token: the workflow's own only reads its own repository. The templates pass the action the `SSK_CANON_JETON_CITES` secret, which it hands to the verification; without it, citations to a private repository say they are unverified, and nothing fails.

The token is created once, by hand, on GitHub — *Settings → Developer settings → Fine-grained tokens*: resource owner, the organisation of the cited référentiels; access to the cited repositories only; *Contents* permission read-only, nothing else. A script sets it on the scoped repository, after checking that it reads each private cited référentiel — the token is typed at the keyboard, without echo, and the script is run again on renewal:

```bash
outillage/jeton-referentiels-cites.sh <organisation>/<depot-cadre>
```

A fine-grained token only covers one owner. Cited référentiels under several owners are read with a token from a GitHub App installed on each (`actions/create-github-app-token`), produced in a step before the action and passed to `jeton-referentiels-cites` instead of the secret. A pull request from a fork does not receive secrets: its private citations stay unverified.

The verification clones each cited référentiel, shallowly, into a temporary directory it deletes afterwards. Git's output is silenced, since the address may carry the token. On the command line, `--cites <dossier>` first reads a cited référentiel under `<dossier>/<owner>/<name>`, for a workflow that fetched it itself; otherwise the clone goes through the machine's Git credentials, or through `SSK_CANON_JETON_CITES` if it is set.
