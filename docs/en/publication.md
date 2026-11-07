[Contents](../../README.en.md#documentation) · [Français](../publication.md)

# Publishing a version

Publishing happens from continuous integration, never by hand: a version published from a workstation does not say which commit it comes from, and the gap between the repository and the registry goes unnoticed.

**The action and the package share a single numbering.** They live in the same repository and evolve together: two version series on the same tags would only bring ambiguity about what `v1.3.0` designates.

```bash
npm version patch          # or minor, major — updates package.json and tags
git push && git push --tags
gh release create v1.5.0 --generate-notes
```

It is **publishing the release** that triggers npm, not pushing the tag. A tag alone used to publish without anything telling the story of the version: the notes were caught up afterwards, when someone thought of it.

The notes are generated from the pull requests merged since the previous version — which is why changes to this repository go through a pull request, even alone.

The workflow then checks that the tag matches the package version, runs the tests and the verification again, then publishes. A release created without bumping the version fails before any publishing.

The major version alias, which scoped repositories consume, is moved separately:

```bash
git tag -f -a v1 -m "Alias vers la dernière v1.x" && git push --force origin v1
```

## No token to hold

Publishing authenticates through attestation — npm recognises the workflow itself rather than a secret. Nothing to rotate, nothing that can leak, and the origin of each published version can be verified publicly.

The setup is done once, on npmjs.com, in the package settings → *Trusted Publisher*:

| Field | Value |
|---|---|
| Provider | GitHub Actions |
| Organization | `ssk-it` |
| Repository | `ssk-canon-action` |
| Workflow filename | `publier.yml` |

The file name must match **exactly**, case included: it is what npm checks in the attestation. Renaming this workflow without updating this setting would make publishing fail.
