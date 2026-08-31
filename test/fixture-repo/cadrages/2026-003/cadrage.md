---
id: 2026-003
titre: Choix du fournisseur de stockage objet
statut: livree
domaines: [persistance]
liens:
  - { tag: document, url: 'https://www.scaleway.com/en/docs/object-storage/' }
impacts:
  - { regle: RG-pj-retention, operation: cree }
  - { regle: RG-pj-ordre-upload, operation: modifie }
  - { regle: RG-pj-adressage-contenu, operation: touche }
---

## Objectif

Le principe du stockage objet adressé par contenu étant retenu, il reste à choisir
le fournisseur et à en tirer les conséquences concrètes.

Le choix se porte sur Scaleway, pour des raisons de cohérence avec
l'infrastructure existante. Sa compatibilité avec le protocole S3 fait que
l'architecture posée s'applique sans modification : URLs signées, adressage par
contenu, configuration des origines autorisées.

La vérification de ses caractéristiques réelles apporte cependant quatre
enseignements, dont un favorable et trois contraignants.

## Parcours utilisateur

1. Le rédacteur joint une maquette à son cadrage. Le navigateur calcule le hash du
   fichier avant tout envoi.
2. Le relais lui remet une autorisation d'écriture temporaire, valable pour cette
   clé précise.
3. Le fichier part directement du navigateur vers le stockage, sans transiter par
   le relais.
4. Le relais vérifie que le fichier est bien arrivé, puis seulement le cadrage est
   enregistré.
5. Périodiquement, les objets non référencés sont marqués, puis supprimés passé le
   délai de rétention.

## Énoncés

### RG-pj-retention

Un objet référencé par la branche principale ou par un tag n'est **jamais
supprimé**. Les autres relèvent d'une politique de rétention.

La rejouabilité intégrale de l'historique et le bornage du stockage sont
mutuellement exclusifs : ce partage tranche en faveur de la rejouabilité sur ce
qui compte.

Deux garde-fous obligatoires. Le comptage de références est **global au dépôt**,
jamais local à un cadrage — la déduplication par hash fait que plusieurs cadrages
partagent un objet. Et un objet créé depuis moins de vingt-quatre heures n'est
jamais collecté, faute de quoi une collecte concurrente d'un téléversement en
cours produirait un pointeur mort.

### RG-pj-ordre-upload

Une pièce jointe est **téléversée avant** que le fichier Markdown qui la référence
ne soit commité.

L'ordre inverse produirait un pointeur désignant un objet absent. Comme le
stockage n'émet aucune notification, la réussite du téléversement est vérifiée
explicitement avant le commit.

