---
id: 2026-004
titre: Initialisation du prototype
domaines: [persistance, cadrage]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon-pwa/issues/1' }
impacts:
  - { regle: RG-parseur-partage, operation: cree }
  - { regle: RG-format-fichier, operation: touche }
  - { regle: RG-verification-integrite, operation: touche }
---

## Objectif

Mettre en place la structure du projet et valider le format des fichiers en
l'écrivant à la main, avant qu'une ligne de code applicatif n'en dépende.

Le raisonnement : le code est jetable, le format ne l'est pas. Une fois qu'un
projet réel a des centaines de fichiers, une migration de schéma se paie. Écrire
le dépôt à la main est le seul test honnête — si le format est pénible à écrire
ainsi, il sera pénible à lire.

Ce cadrage décrit sa propre production : le dépôt d'exemple est le référentiel de
SSK Canon décrit dans son propre format.

## Parcours utilisateur

1. Un développeur clone le projet et lit les invariants avant de toucher au code.
2. Il lance la vérification d'intégrité sur le dépôt d'exemple pour s'assurer que
   son environnement fonctionne.
3. En modifiant le format, il fait échouer la vérification, ce qui lui indique
   précisément ce qui ne va plus.

## Énoncés

### RG-parseur-partage

La lecture du format est implémentée **deux fois** : dans l'application pour le
navigateur, dans l'automatisation pour la plateforme.

Les deux implémentations doivent rester d'accord. Tant que le format n'est pas
stabilisé, la duplication est assumée plutôt qu'extraite dans un paquet partagé,
dont le montage coûterait plus que le risque qu'il éviterait.

Le dépôt d'exemple sert de test commun : toute divergence entre les deux lectures
doit s'y manifester.
