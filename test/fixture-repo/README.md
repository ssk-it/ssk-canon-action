# SSK Canon — le référentiel du produit, dans son propre format

Ce dépôt est le référentiel de SSK Canon décrit avec SSK Canon. Les
décisions prises pendant la conception du produit y sont consignées comme des
cadrages, avec leurs options écartées et leurs motifs.

Il sert donc à deux choses : **jeu de test** du prototype, et **spécification
vivante** du produit. Si le format ne sait pas exprimer les décisions qui l'ont
créé, il ne saura rien exprimer.

## Les cadrages

| Id | Titre | Statut |
|---|---|---|
| 2026-001 | Socle du produit — référentiel, cadrages et persistance dans Git | livrée |
| 2026-002 | Révision sur faits vérifiés — historique, chemins immuables et pièces jointes | livrée |
| 2026-003 | Choix du fournisseur de stockage objet | livrée |
| 2026-004 | Initialisation du prototype | en relecture |
| 2026-005 | Commentaires du client sur un cadrage | brouillon |
| 2026-006 | Lecture du référentiel depuis un dépôt public | livrée |
| 2026-007 | Navigation dans une fiche de cadrage | livrée |
| 2026-008 | Connexion facultative pour relever les limites d'appels | livrée |
| 2026-009 | Repères temporels et ordre de la liste des cadrages | livrée |
| 2026-010 | Mécanique de la propagation des impacts | livrée |

## Ce que ce dépôt couvre volontairement

- **Les quatre statuts de cadrage**, dont un brouillon sans impact et un cadrage
  en relecture dont la règle créée n'existe pas encore dans `rules/` — ce qui est
  correct tant qu'il n'est pas livré.
- **Les quatre opérations d'impact** : crée, modifie, abroge, touche.
- **Deux décisions annulées** — `2026-003/02-duree-autorisations`, dont
  l'hypothèse de départ s'est révélée fausse, et
  `2026-009/03-date-de-changement-de-statut`, écartée faute de source à la fois
  exacte et abordable. Toutes deux sont conservées avec leur motif : savoir
  qu'une question a été posée et pourquoi elle est restée sans réponse vaut mieux
  que son effacement.
- **Des règles modifiées par un cadrage ultérieur** — `RG-rattachement-multiple`,
  `RG-statuts-cadrage` et `RG-propagation-livraison` sont créées par 2026-001 puis
  précisées par 2026-002. Les énoncés de 2026-001 disent moins que les actuels :
  c'est voulu, un cadrage porte l'énoncé au moment de sa livraison.
- **Des règles rattachées à plusieurs fonctionnalités**, et des fonctionnalités
  rattachées à plusieurs domaines.
- **Des impacts `touche`** qui tracent une dépendance sans rien écrire.

## Vérifier l'intégrité

```bash
cd ../actions && npm install
node src/check.mjs ../example-repo
```

Et vérifier que le référentiel n'a pas dérivé de ses cadrages :

```bash
node src/propagate.mjs ../example-repo --dry-run
```

Cette seconde commande doit répondre « rien à propager ». Si elle propose des
écritures, c'est qu'une règle a été modifiée sans passer par un cadrage — la
dérive la plus insidieuse, puisqu'elle ne rompt aucune référence et ne produit
aucun symptôme.

La vérification contrôle notamment que les index `cree_par` et `modifie_par`
correspondent aux impacts réellement déclarés par les cadrages livrés — ces champs
sont dérivés, jamais édités à la main.

## Structure

```
ssk-canon.yml        configuration et version du schéma
domains/             les domaines fonctionnels
features/            les fonctionnalités, à plat
rules/               les règles de gestion, à plat — chemins immuables
cadrages/<id>/       un dossier par cadrage
  cadrage.md         objectif, parcours, impacts, énoncés
  decisions/         une décision par fichier
  attachments.md     pointeurs vers le stockage objet
```

Les règles et les fonctionnalités sont à plat parce qu'aucune API GitHub ne suit
les renommages : un fichier déplacé perdrait son historique. C'est la décision
`2026-002/01-topologie-fichiers`.
