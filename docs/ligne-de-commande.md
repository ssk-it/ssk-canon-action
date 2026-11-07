[Sommaire](../README.md#documentation) · [English](en/ligne-de-commande.md)

# En ligne de commande

Le propagateur et le vérificateur s'utilisent hors CI :

```bash
npm ci
node src/check.mjs     /chemin/du/depot
node src/check.mjs     /chemin/du/depot --base origin/main --livraison
node src/check.mjs     /chemin/du/depot --cites /chemin/des/referentiels-cites
node src/propagate.mjs /chemin/du/depot --dry-run
node src/propagate.mjs /chemin/du/depot
```

`--livraison` demande le contrôle de l'état post-fusion, celui que
l'intégration continue applique aux demandes prêtes à relire. Il tient compte du
travail non encore enregistré : le cadrage qu'on vient d'écrire y compte comme
porté par la demande, ce qui est précisément le moment où l'on veut savoir ce
qui manque.

Une branche que la base a déjà fusionnée — le cas d'un `fetch` qui suit la fusion
— est signalée par un avertissement « branche déjà fusionnée ». Ses index dérivés
n'y sont pas contrôlés : la base porte son cadrage livré sans encore la
propagation qui en écrira les index, et ce retard n'est pas une erreur du
rédacteur. Un cadrage livré repris après la fusion reste refusé.
