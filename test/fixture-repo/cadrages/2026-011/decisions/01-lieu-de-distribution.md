---
id: 01-lieu-de-distribution
titre: Où héberger l'automatisation pour qu'un dépôt cadré puisse l'atteindre ?
statut: retenue
option_retenue: depot-public-dedie
---

## Description

L'automatisation vivait dans le dépôt de l'outil, aux côtés de l'application. Un
dépôt cadré la référence par son adresse, ce qui suppose de pouvoir la lire.

Le fait vérifié qui contraint le choix : le réglage de partage d'un dépôt fermé
propose trois niveaux — inaccessible, accessible depuis la même organisation,
accessible depuis la même entreprise. **Aucun ne désigne une organisation
tierce.** Un client ne pourrait donc jamais consommer l'automatisation, quel que
soit le réglage.

La question n'est pas technique mais de découpage : qu'est-ce qui doit être
atteignable, et à quel prix ?

## Options

### tout-ouvrir

Rendre public le dépôt entier, application comprise.

**Pour** — un seul dépôt, aucune synchronisation, la question disparaît.
**Contre** — l'application est la seule partie difficile à refaire et la seule
qui s'exécute chez l'éditeur. L'ouvrir donnerait sans contrepartie ce que le
reste du montage cherche à préserver.

### publier-comme-paquet

Distribuer l'automatisation comme paquet installable, appelé en ligne de commande
depuis le workflow du dépôt cadré.

**Pour** — atteignable de partout, versionné par construction, fonctionne même si
tous les dépôts restent fermés.
**Contre** — le dépôt cadré perd l'intégration native : les paramètres, le
compte-rendu d'exécution et l'enregistrement des écritures redeviennent du script
à écrire et à maintenir chez chaque client.

### copier-chez-le-client

Chaque dépôt cadré embarque sa copie de l'automatisation.

**Pour** — aucune dépendance externe, fonctionne dans tout environnement, même
isolé.
**Contre** — la mise à jour est manuelle et l'écart s'installe en silence. Des
clients tourneraient durablement sur des versions différentes sans le savoir.
Acceptable en dépannage, mauvais comme montage durable.

### jeton-chez-le-client

Installer chez le client un jeton d'accès en lecture au dépôt fermé.

**Pour** — le dépôt outil reste fermé.
**Contre** — un secret à durée de vie longue, à renouveler, déposé chez chaque
client, pour lire du code qui n'a rien de confidentiel. L'exposition est réelle,
le bénéfice nul.

### depot-public-dedie

**Retenue.** Extraire l'automatisation dans un dépôt public dédié, en publiant
l'application et le reste séparément.

**Pour** — atteignable depuis n'importe quelle organisation sans réglage ni
secret ; l'intégration native est conservée ; seul est ouvert ce qui doit
l'être.
**Contre** — un second dépôt à maintenir, et une cohérence à tenir entre le
format que l'automatisation applique et celui que l'application lit.

## Décision

**Un dépôt public dédié à l'automatisation.**

Le coût — un dépôt de plus — est le prix d'un montage qui vaut pour un client
quelconque, sans démarche ni configuration de sa part. Les autres options
demandaient soit d'ouvrir ce qui a de la valeur, soit de faire porter au client
une complexité qui ne le concerne pas.

La cohérence entre les deux lectures du format était déjà un sujet avant cette
séparation : elle est éprouvée par un jeu de test commun, non par le voisinage
des fichiers dans un même dépôt.
