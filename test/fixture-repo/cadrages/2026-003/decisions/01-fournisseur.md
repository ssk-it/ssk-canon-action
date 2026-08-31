---
id: 01-fournisseur
titre: Quel fournisseur de stockage objet ?
statut: retenue
option_retenue: scaleway
---

## Description

Le principe étant arrêté, reste à choisir où les objets vivent réellement. Le
critère dominant dépend du profil de charge : ici, la consultation de maquettes
domine largement le dépôt, donc le trafic sortant pèse plus que le stockage.

## Options

### fournisseur-egress-gratuit

Un fournisseur pratiquant la gratuité du trafic sortant.

**Pour** — sur une charge dominée par la lecture, c'est le poste qui pèse le plus.
**Contre** — un service de plus, chez un acteur qui n'héberge rien d'autre du
projet.

### fournisseur-historique

Le fournisseur de référence du marché.

**Pour** — l'écosystème et la documentation les plus fournis.
**Contre** — trafic sortant facturé dès le premier palier dépassé, ce qui frappe
exactement notre profil de charge.

### auto-heberge

Un stockage compatible S3 déployé sur l'infrastructure existante.

**Pour** — pas de facture au volume, pas de dépendance externe, souveraineté
complète.
**Contre** — exploitation à assurer : sauvegardes, disponibilité, capacité. Un
coût humain récurrent sans rapport avec le volume réellement en jeu.

### scaleway

**Retenue.** Scaleway Object Storage.

**Pour** — cohérent avec l'infrastructure du projet, compatible S3 donc sans
impact sur l'architecture, et soixante-quinze gigaoctets de trafic sortant offerts
chaque mois — largement au-delà de nos besoins prévisibles. Les requêtes ne sont
pas facturées.
**Contre** — quelques limitations à contourner, traitées ci-dessous.

## Décision

**Scaleway.** Le choix est d'abord un choix de cohérence avec l'infrastructure
existante, et les caractéristiques techniques le confirment plutôt qu'elles ne le
contredisent.
