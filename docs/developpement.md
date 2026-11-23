[Sommaire](../README.md#documentation) · [English](en/developpement.md)

# Développement

`test/fixture-repo/` est une copie du dépôt de référence
[`ssk-it/ssk-canon`](https://github.com/ssk-it/ssk-canon), qui décrit SSK Canon
dans son propre format. Elle sert de jeu de test réaliste, en complément des
tests unitaires qui construisent leurs propres dépôts temporaires.

```bash
npm test              # tests unitaires du propagateur
npm run check         # intégrité de la fixture
npm run propagate:dry # la fixture ne doit pas dériver
```

## Les étapes de l'action

Chaque étape des actions composites (`action.yml`, `pistes/action.yml`) est un
script Node — `shell: node {0}` — qui passe la main à un module de
`src/action/` par `launcher.cjs`. Aucune ne s'écrit en bash, pwsh ou cmd : le
shell que porte un runner auto-hébergé dépend de son installation (un service
Windows n'a bash que si son PATH le dit), alors que Node est déjà requis par
l'action.

- Ce qu'une étape reçoit lui parvient par l'environnement (`env:`), jamais
  collé dans le script : un message ou un nom de workflow qui contient un
  guillemet ou un `$(…)` reste une chaîne.
- Un module exporte `main(env, …)` ; ce qu'il appelle et qu'un test doit
  remplacer (`gh`, les deux outils en ligne de commande) se passe en second
  argument. `git` est le vrai : les tests montent de vrais dépôts, avec un
  `origin` jetable.
- Un outil en ligne de commande ne s'exécute que s'il est le module principal :
  `isMainModule(import.meta.url)`, jamais une comparaison avec
  `file://${process.argv[1]}`, fausse sous Windows et par un lien symbolique.
- `npm` se lance par `runNpm` : sous Windows, c'est `npm.cmd`, que Node refuse
  de démarrer sans shell.

La CI joue l'action sur Linux, Windows et macOS, et les tests des étapes sur
Windows. Un runner auto-hébergé n'a pas l'image des runners de GitHub : `git`,
`gh` et un client SSH doivent y être installés.

## Langue du code

Le code est en anglais : identifiants, commentaires, descriptions de tests,
noms des modules internes. Le vocabulaire du domaine prend le nom anglais que
donne le glossaire ci-dessous, et lui seul — le même que celui de
[skanon-web](https://github.com/ssk-it/skanon-web/blob/main/docs/glossary.md),
pour qu'un mot cherché dans l'un se retrouve dans l'autre.

Restent en français, parce que le code ne les possède pas :

- **le format** : clés YAML (`cree_par`, `domaines`, `dossiers`), valeurs de
  statut, d'opération et de nature (`cree`, `livree`, `regle`), noms de
  dossiers (`cadrages/`, `identite/`), étiquettes (`piste`, `domaine/<id>`) —
  RG-textes-traduits, RG-noms-declares ;
- **les codes d'anomalie et leurs paramètres**, stables à vie, et la gravité
  `erreur` / `avertissement` — RG-anomalies-codees ;
- **ce que lit l'utilisateur** : les messages des catalogues, déjà dans les deux
  langues, les journaux, les invites des scripts d'`outillage/` ;
- **les contrats publics, jusqu'à leur migration** : les exports de
  `@ssk-it/canon-check` et les champs de ses objets, les entrées et sorties des
  actions, les options de la ligne de commande. Ils passent à l'anglais avec
  des alias français dépréciés, jamais d'un coup : leurs consommateurs suivent
  `main`.

| Terme du format | Terme du code |
|---|---|
| référentiel | `specification` |
| dépôt | `repo` |
| domaine, fonctionnalité, règle, énoncé | `domain`, `feature`, `rule`, `statement` |
| décision d'architecture, document d'architecture | `adr`, architecture document |
| cadrage, livraison | `scoping`, `delivery` |
| impact, cible, nature, opération | `impact`, `target`, `kind`, `operation` |
| créé par, modifié par | `createdBy`, `modifiedBy` |
| propagation, écritures | `propagation`, `writes` |
| piste, rattachement, étiquette | `roadmapItem`, `link`, `label` |
| écart, anomalie, gravité | `discrepancy`, `anomaly`, `severity` |
| citation, préfixe | `citation`, `prefix` |
| identité, symbole, variante | `identity`, `symbol`, `variant` |
| noms déclarés, dossier | `names`, `folder` |
| pièce jointe, empreinte | `attachment`, `fingerprint` |
| langue, jeton | `language`, `token` |
