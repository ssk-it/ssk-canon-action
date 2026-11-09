voir aussi: [Skanon UI](https://ssk-canon.s3-website.fr-par.scw.cloud/) · [English](README.en.md)
# SSK Canon — action de propagation

Vérifie l'intégrité d'un référentiel [SSK Canon](https://github.com/ssk-it/ssk-canon)
et applique aux règles de gestion les impacts des cadrages livrés.

Le **référentiel** — domaines, fonctionnalités, règles de gestion — décrit l'état
courant d'un produit. Les **cadrages** sont les unités de changement, datées, qui
le transforment. Cette action maintient le premier comme projection des seconds.

## Ce qu'elle fait

Elle compare l'état déclaré par les cadrages livrés à l'état réel du
référentiel, et n'écrit que l'écart. Deux propriétés en découlent :

- **idempotente** : sur un référentiel conforme, elle n'écrit rien. Elle peut
  donc se déclencher à chaque arrivée sur la branche principale, et être rejouée
  après un échec — ou à heure fixe : GitHub ne transmet pas toujours la poussée
  d'un merge, et le modèle de workflow rattrape ainsi seul une propagation
  perdue ;
- **tout ou rien** : une incohérence l'arrête avant la première écriture, ce qui
  laisse le référentiel dans son état précédent, cohérent.

Le commit de propagation est distinct de celui de la livraison : le premier
porte l'intention rédigée par un humain, le second l'écriture faite par la
machine.

## Installation dans un dépôt cadré

Trois workflows à copier depuis [`modeles/`](modeles/) :

```bash
# depuis la racine du dépôt cadré
mkdir -p .github/workflows
curl -o .github/workflows/verification.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/verification-depot-cadre.yml
curl -o .github/workflows/propagation.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/propagation-depot-cadre.yml
curl -o .github/workflows/pistes.yml \
  https://raw.githubusercontent.com/ssk-it/ssk-canon-action/main/modeles/pistes-depot-cadre.yml
```

Le troisième vérifie les pistes : voir [Rattachement des pistes](docs/pistes.md). Il ne demande
aucun réglage du dépôt — ses permissions, `contents: read` et `issues: write`, se
déclarent dans le workflow.

Puis, dans les réglages du dépôt :

1. **Actions → General → Workflow permissions** : *Read and write
   permissions*, et *Allow GitHub Actions to create and approve pull
   requests*. Sans la première, la propagation ne peut rien écrire ; sans la
   seconde, elle ne peut pas ouvrir sa demande de fusion sur une branche
   protégée — elle pousse sa branche `propagation/<sha>` puis échoue, et le
   cadrage fusionné reste sans ses index. Un script les règle et le vérifie,
   avec la session de `gh` et les droits d'administration du dépôt :

   ```bash
   outillage/preparer-depot-cadre.sh <organisation>/<depot>
   ```

   Le même script règle **General → Pull Requests → Automatically delete head
   branches** : chaque cadrage et chaque propagation laissent sinon leur branche
   derrière eux, et un commit poussé après la fusion — jamais livré — s'y perd
   parmi des dizaines d'autres. Surtout, la consultation du référentiel les
   parcourt comme des travaux en cours : voir [Consulter
   le référentiel avant de cadrer ou de développer](docs/skills.md#consulter-le-référentiel-avant-de-cadrer-ou-de-développer).

   Un réglage ajouté au script n'atteint que les dépôts sur lesquels on le relance. Un second script le passe sur chaque référentiel que déclare `~/.claude/cadrage-canon.json`, avec les mêmes confirmations, et nomme à la fin ceux qui restent à régler :

   ```bash
   outillage/preparer-depots-cadres.sh
   ```

2. **Les runners, pour un dépôt privé.** Les modèles tirent leur runner de la variable d'organisation `SSK_RUNNER_PRIVE`, visible des seuls dépôts privés : sans elle, chaque exécution — une vérification par demande de fusion, une propagation par livraison et sa reprise toutes les heures — tourne sur les runners de GitHub et se décompte du forfait de l'organisation. Un dépôt public, et une organisation sans la variable, restent sur `ubuntu-latest`. Un script la pose, une fois par organisation, et vérifie qu'un runner en ligne porte ses labels :

   ```bash
   outillage/runner-prive-organisation.sh <organisation>
   ```

3. **Branches → règle de protection sur la branche principale** : ajouter la
   vérification comme contrôle requis. Sans cela, elle signale sans bloquer, et
   un cadrage incohérent peut être livré.

4. **L'application de l'automatisation.** Une branche principale qui refuse la poussée directe reçoit les écritures de la propagation par une demande de fusion. Ouverte avec le jeton du workflow, cette demande voit ses contrôles mis en attente d'une approbation humaine, et le run en attente bloque la fusion même une fois `verifier` vert : sur ssk-terrarium-cadrage, #24 et #25 l'ont attendue. La propagation ouvre donc sa demande sous l'identité d'une application GitHub dédiée, `ssk-canon-propagation`, dont le jeton d'installation déclenche les contrôles sans approbation, et en demande la fusion automatique : la demande se fusionne d'elle-même une fois `verifier` vert, et jamais avant ([RG-propagation-identite-dediee](https://ssk-canon.s3-website.fr-par.scw.cloud/ssk-it/ssk-canon/referentiel/regle/RG-propagation-identite-dediee)). Un script crée l'application, une fois, pose son identifiant client (variable `SSK_CANON_APP_ID`) et sa clé privée (secret `SSK_CANON_APP_CLE`) sur les organisations — visibles de leurs seuls référentiels — ou sur chaque référentiel d'un compte personnel, puis guide son installation :

   ```bash
   outillage/application-propagation.sh
   ```

   `preparer-depot-cadre.sh` autorise ensuite la fusion automatique sur le dépôt, et fait transmettre l'identité au workflow de propagation par une demande de fusion. Sans elle, la propagation se replie sur le jeton du workflow et le dit : elle lance alors elle-même la vérification sur la branche de sa demande, par `workflow_dispatch`, seul événement de ce jeton qui crée un run d'emblée — d'où `workflow_dispatch` dans le modèle de vérification, et `actions: write` dans celui de la propagation —, et la demande attend une approbation. L'entrée `verification` de l'action désigne ce workflow, par son nom — « Vérification du référentiel » par défaut — ou par son fichier.

   Une demande de propagation en attente que la branche principale a dépassée — un cadrage fusionné entre-temps — est mise à jour par l'exécution suivante : une branche principale qui exige une branche à jour la bloquerait sinon.

### Pourquoi `@main` et non un tag de version

Les workflows référencent `ssk-it/ssk-canon-action@main`. Un tag mobile `v1` a
existé, et il a fait la démonstration de ce qu'on lui reproche : il est resté sur
la version 1.4.0 pendant que la branche principale prenait vingt-six commits
d'avance, si bien que les dépôts cadrés consommaient un vérificateur qui ignorait
le statut déduit. Rien ne signalait ce retard, puisqu'un tag qu'on oublie de
déplacer ne se plaint pas.

La contrepartie est réelle : ce qui arrive sur la branche principale part aussitôt
chez tous les dépôts cadrés, sans palier. Elle est assumée tant que l'outil sert
à une seule main. Le jour où d'autres équipes en dépendront, il faudra revenir à
un tag déplacé par le workflow de release, plutôt que par la mémoire de qui
publie.

Le paquet npm, lui, reste versionné : c'est une dépendance qu'on résout, non une
action qu'on exécute.

Une branche protégée refuse le push direct de la propagation, puisque ce push ne
porte aucun des contrôles qu'elle exige. La propagation ouvre alors une demande
de fusion, que les contrôles vérifient comme n'importe quelle autre — il reste à
la merger pour que le référentiel soit à jour. Le workflow doit pour cela
déclarer `pull-requests: write` à côté de `contents: write`.
Tant que cette demande attend, aucune exécution n'en ouvre une seconde.

Ce dépôt étant public, aucun réglage d'accès n'est nécessaire, y compris depuis
un dépôt cadré privé ou appartenant à une autre organisation.

## Documentation

- [Entrées et sorties de l'action](docs/action.md)
- [Vérification seule](docs/verification.md) — ce que la vérification attrape, l'identité visuelle, le contrôle de l'état post-fusion
- [Citer un autre référentiel](docs/citations.md) — `referentiels_cites`, `applique`, et l'accès en lecture aux référentiels cités privés
- [Rattachement des pistes](docs/pistes.md) — l'action `pistes/`, les étiquettes et les jalons
- [Comme bibliothèque](docs/bibliotheque.md) — le paquet `@ssk-it/canon-check`, ses sous-modules et `ssk-canon.yml`
- Référence API de `@ssk-it/canon-check` — à venir
- [En ligne de commande](docs/ligne-de-commande.md)
- [Développement](docs/developpement.md)
- [Publier une version](docs/publication.md)
- [Les skills](docs/skills.md) — [cadrage](docs/skills.md#le-skill-de-cadrage), [sa mise à jour](docs/skills.md#le-mettre-à-jour), [cadrer depuis une carte Trello](docs/skills.md#cadrer-depuis-une-carte-trello), [consulter le référentiel](docs/skills.md#consulter-le-référentiel-avant-de-cadrer-ou-de-développer)

## Le skill de cadrage

`skills/cadrage-canon/` porte un skill Claude Code qui rédige un cadrage dans le
format que vérifie cette action. Son installation et ses réglages sont décrits
dans [Les skills](docs/skills.md#le-skill-de-cadrage).

## Licence

Apache-2.0 — voir [LICENSE](LICENSE) et [NOTICE](NOTICE).
