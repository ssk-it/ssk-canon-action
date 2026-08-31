---
id: 03-instant-reel-affiche
titre: 'Quel instant afficher : celui demandé, ou celui retenu ?'
statut: retenue
option_retenue: l-instant-retenu
---

## Description

Un référentiel n'existe qu'aux moments où il a été enregistré. Demander son état
à un instant quelconque revient donc à demander le dernier enregistrement
antérieur — lequel peut être bien plus ancien que l'instant demandé.

La première réalisation affichait l'instant demandé. Une vérification à l'écran
l'a montré : la borne demandée était vingt heures quarante-cinq, l'état affiché
datait de vingt heures trente-huit, et la page annonçait vingt heures
quarante-cinq.

L'écart était de sept minutes sur un dépôt actif. Sur une borne reculée de trois
mois, il peut atteindre des semaines.

## Options

### l-instant-demande

Afficher ce que le lecteur a saisi.

**Pour** — correspond à son geste, donc sans surprise apparente.
**Contre** — affirme un état à un instant où personne ne l'a produit. Le lecteur
qui recoupe avec l'historique du dépôt constate un décalage inexplicable.

### les-deux

Afficher l'instant demandé et, à côté, celui retenu.

**Pour** — complet, rien n'est caché.
**Contre** — la borne demandée n'apprend rien une fois la comparaison lancée :
elle est déjà dans le champ juste au-dessus. La répéter encombre sans informer.

### l-instant-retenu

**Retenue.** Afficher l'instant du dernier enregistrement antérieur à la borne,
en disant que c'est de cela qu'il s'agit.

**Pour** — chaque date affichée correspond à un état qui a réellement existé.
**Contre** — peut surprendre un lecteur qui ne verrait pas la mention explicative.

## Décision

**Afficher l'instant retenu.**

C'est une application directe du principe qui gouverne le traitement de
l'histoire : elle se dérive et ne s'invente pas. Une date affichée doit
correspondre à quelque chose qui a eu lieu, sans quoi le référentiel affirme un
fait qu'il ne peut pas soutenir.

Rejoint un enseignement déjà consigné à propos des entrées de chronologie sans
enregistrement : mieux vaut dire ce qui est établi que ce qui a été demandé.
Deux occurrences du même défaut en deux boucles — le remplissage par défaut
d'une donnée incertaine est un piège récurrent, pas un accident.
