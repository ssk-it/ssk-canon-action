[Sommaire](../README.md#documentation) · [English](en/publication.md)

# Publier une version

La publication se fait depuis l'intégration continue, jamais à la main : une
version publiée depuis un poste ne dit pas de quel commit elle vient, et le
décalage entre le dépôt et le registre passe inaperçu.

**L'action et le paquet partagent une seule numérotation.** Ils vivent dans le
même dépôt et évoluent ensemble : deux suites de versions sur les mêmes tags
n'apporteraient qu'une ambiguïté sur ce que `v1.3.0` désigne.

```bash
npm version patch          # ou minor, major — met à jour package.json et tague
git push && git push --tags
gh release create v1.5.0 --generate-notes
```

C'est la **publication de la release** qui déclenche npm, non la pose du tag. Un
tag seul publiait sans que rien ne raconte la version : les notes se rattrapaient
après coup, quand on y pensait.

Les notes se génèrent depuis les demandes de fusion mergées depuis la version
précédente — raison pour laquelle les modifications de ce dépôt passent par une
demande de fusion, même seul.

Le workflow vérifie ensuite que l'étiquette correspond à la version du paquet,
rejoue les tests et la vérification, puis publie. Une release posée sans avoir
incrémenté la version échoue avant toute publication.

L'alias de version majeure, que les dépôts cadrés consomment, se déplace
séparément :

```bash
git tag -f -a v1 -m "Alias vers la dernière v1.x" && git push --force origin v1
```

## Aucun jeton à détenir

La publication s'authentifie par attestation — npm reconnaît le workflow lui-même
plutôt qu'un secret. Rien à faire tourner, rien qui puisse fuir, et l'origine de
chaque version publiée est vérifiable publiquement.

Le paramétrage se fait une fois, sur npmjs.com, dans les réglages du paquet →
*Trusted Publisher* :

| Champ | Valeur |
|---|---|
| Provider | GitHub Actions |
| Organization | `ssk-it` |
| Repository | `ssk-canon-action` |
| Workflow filename | `publier.yml` |

Le nom du fichier doit correspondre **exactement**, casse comprise : c'est lui
que npm vérifie dans l'attestation. Renommer ce workflow sans mettre à jour ce
réglage ferait échouer la publication.
