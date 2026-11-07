[Contents](../../README.en.md#documentation) · [Français](../developpement.md)

# Development

`test/fixture-repo/` is a copy of the reference repository [`ssk-it/ssk-canon`](https://github.com/ssk-it/ssk-canon), which describes SSK Canon in its own format. It serves as a realistic test set, alongside the unit tests that build their own temporary repositories.

```bash
npm test              # propagator unit tests
npm run check         # fixture integrity
npm run propagate:dry # the fixture must not drift
```
