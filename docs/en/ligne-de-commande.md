[Contents](../../README.en.md#documentation) · [Français](../ligne-de-commande.md)

# Command line

The propagator and the checker can be used outside CI:

```bash
npm ci
node src/check.mjs     /chemin/du/depot
node src/check.mjs     /chemin/du/depot --base origin/main --livraison
node src/check.mjs     /chemin/du/depot --cites /chemin/des/referentiels-cites
node src/propagate.mjs /chemin/du/depot --dry-run
node src/propagate.mjs /chemin/du/depot
```

`--livraison` asks for the post-merge state check, the one continuous integration applies to pull requests ready for review. It takes uncommitted work into account: the cadrage one has just written counts as carried by the pull request, which is precisely when one wants to know what is missing.

A branch the base has already merged — the case of a `fetch` following the merge — is reported by a « branche déjà fusionnée » (branch already merged) warning. Its derived indexes are not checked there: the base carries its delivered cadrage without yet the propagation that will write its indexes, and that lag is not the author's mistake. A delivered cadrage modified after the merge is still refused.
