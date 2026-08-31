---
id: 02-element-signale
titre: Quel élément signaler quand plusieurs sont visibles ?
statut: retenue
option_retenue: priorite-au-detail
---

## Description

Pendant la lecture, plusieurs entrées du sommaire correspondent souvent à des
éléments simultanément à l'écran : le titre d'une section et l'un de ses
éléments. Le sommaire ne peut en signaler qu'un.

La question paraît anodine ; elle décide en réalité si le sommaire renseigne ou
se contente de bouger.

## Options

### priorite-a-la-section

Signaler la section englobante.

**Pour** — le repère change peu, donc l'affichage est stable.
**Contre** — n'apprend rien. Quelqu'un qui lit la troisième décision sait déjà
qu'il est dans les décisions. Le sommaire s'agite sans informer.

### premier-element-rencontre

Signaler le premier élément visible dans l'ordre du document, quel qu'en soit le
niveau.

**Pour** — règle simple, sans cas particulier.
**Contre** — la section précédant immédiatement ses éléments, c'est presque
toujours elle qui l'emporte. Revient en pratique à l'option précédente.

### priorite-au-detail

**Retenue.** Si un élément détaillé est visible, c'est lui qui est signalé ; à
défaut seulement, la section.

**Pour** — le sommaire répond à « où suis-je ? » avec la précision utile. Le
titre d'une décision situe la lecture ; le mot « Décisions » ne le fait pas.
**Contre** — le repère change plus souvent pendant le défilement.

## Décision

**Priorité au détail.**

Le mouvement plus fréquent du repère n'est pas un défaut : c'est le signe que le
sommaire suit réellement la lecture. Un repère immobile pendant qu'on traverse
quatre décisions ne serait pas de la stabilité, mais de l'inutilité.
