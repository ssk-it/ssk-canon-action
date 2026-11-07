[Contents](../../README.en.md#documentation) · [Français](../verification.md)

# Verification only

`appliquer: false` never modifies the référentiel. The action fails if a cadrage is inconsistent, or if the référentiel has drifted from its cadrages:

```yaml
- uses: actions/checkout@v4
  with:
    # the immutability check compares two states: without the history, it
    # fails instead of pretending it took place
    fetch-depth: 0
- uses: ssk-it/ssk-canon-action@main
  with:
    referentiel: '.'
    appliquer: 'false'
```

What it catches, which the format alone does not guarantee: an impact on a rule that does not exist, a missing statement for a creation or a modification, a link to an unknown entity, a rule repealed by an undelivered cadrage.

It also checks the `identite/` directory, where a référentiel can hold its project's visual identity. Nothing declares it: the file names are authoritative, and a misnamed file would otherwise be ignored silently.

- **Allowed names**: `symbole` and `logotype`, optionally followed by `-clair` or `-sombre` — `symbole.svg`, `logotype-sombre.png` —, and a `README.md`.
- **Allowed formats**: SVG, WebP and PNG, in that order of preference.
- **Weight**: 100 KiB at most per file.

Another name, another format or an exceeded weight is an error. The same name in several formats, or a variant without its twin when no unsuffixed version covers the other background, is reported without blocking. The directory is not a content directory: its files are not read as entities.

As soon as the pull request is **ready for review**, the action also checks the state the référentiel will have **once that pull request is merged**: the cadrages it carries are taken as delivered there. What the delivery will require — the file of each created rule, its link to a feature — is thus asked for while there is still time to write it, rather than discovered after the merge, when the propagation stops and there is no pull request left to fix. A draft is exempt: it announces no delivery, and keeping it red all the time would make people stop reading it.

The derived indexes — `cree_par`, `modifie_par` — are excluded from this check: the propagation writes them, after the merge.

On the main branch, **the verification does not need to be triggered**: the propagation already runs there, and checks the référentiel it has just written. Two checks on the same push read each other out of step — the one that does not write reports the state before the other, and fails on every delivery of a cadrage that creates a rule.
