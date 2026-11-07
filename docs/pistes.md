[Sommaire](../README.md#documentation) · [English](en/pistes.md)

# Rattachement des pistes

Une **piste** est une issue du dépôt de référentiel étiquetée `piste` : ce qu'on
envisage pour le produit, hors du référentiel. Elle se rattache à au moins un
domaine ou une fonctionnalité par des étiquettes `domaine/<id>` et
`fonctionnalite/<id>` — RG-piste-rattachee. Une piste rattachée à rien, ou par une
étiquette qui ne désigne aucun identifiant, n'apparaît nulle part.

Une piste ne passe par aucune demande de fusion : la vérification du référentiel
ne la voit pas. Une seconde action, sous [`pistes/`](../pistes/), la vérifie à
l'événement de l'issue — ouverture, modification, étiquette posée ou retirée,
réouverture — contre la branche principale, avec le même chargeur :

```yaml
- uses: ssk-it/ssk-canon-action/pistes@main
  with:
    referentiel: '.'
```

Un écart se signale par **un seul commentaire** sur l'issue, retrouvé par un
marqueur caché : mis à jour quand les étiquettes changent, supprimé quand le
rattachement est juste, ou quand l'issue n'est plus une piste. Le commentaire d'une
personne qui citerait le marqueur n'est jamais repris. L'exécution n'échoue pas :
le commentaire est le signal, à l'endroit où le rédacteur corrige.

| Entrée | Défaut | Rôle |
|---|---|---|
| `referentiel` | `.` | Chemin du référentiel, relatif à la racine du dépôt appelant. |
| `commenter` | `true` | À `false`, dit les écarts dans le journal sans rien lire ni écrire sur la plateforme. |
| `evenement` | celui du workflow | Fichier d'événement à vérifier, relatif à la racine. |
| `jeton` | `github.token` | Jeton qui lit l'issue et écrit son commentaire. |

La sortie `ecarts` donne le nombre d'écarts trouvés. En ligne de commande :

```bash
node src/check-roadmap-item.mjs /chemin/du/depot --evenement evenement.json --sans-commentaire
```

## Préparer les étiquettes et les jalons

Un dépôt qui accueille des pistes a besoin de l'étiquette `piste`, d'une étiquette `domaine/<id>` par domaine et `fonctionnalite/<id>` par fonctionnalité de sa branche principale, et des jalons « Maintenant », « Ensuite » et « Plus tard », sans échéance — RG-piste-horizon. Un script les crée, avec la session de `gh` et le droit d'écrire les issues du dépôt :

```bash
npm ci
outillage/preparer-pistes.sh <organisation>/<depot>
```

Les identifiants sont lus sur un clone superficiel de la branche principale, par le chargeur que la vérification utilise (`src/roadmap-item-labels.mjs`) : ceux du frontmatter, et non les noms de fichiers.

Chaque groupe d'écritures est annoncé et confirmé ; ce qui existe est laissé tel quel. Le relancer après l'ajout d'un domaine ou d'une fonctionnalité crée les étiquettes qui manquent. Une étiquette qui ne désigne plus rien est signalée, jamais supprimée : des pistes la portent peut-être encore.
