---
id: RG-reprise-cadrage
fonctionnalites: [redaction-cadrage, cycle-vie-cadrage]
statut: actif
cree_par: 2026-015
modifie_par: []
---

Un cadrage se **reprend tant qu'il n'est pas livré**, depuis l'endroit où son
travail se trouve : sa propre branche.

La branche du cadrage fait autorité sur la branche principale, qui ne le connaît
pas encore. Un cadrage qui n'en a pas — rédigé hors de l'application, ou déjà
dans le référentiel — se reprend depuis la branche principale, et l'application
le signale plutôt que de laisser croire à un travail isolé qui n'existe pas.

Chaque écriture se fonde sur la version lue. Deux rédacteurs travaillant
simultanément sur le même cadrage produisent alors un conflit, plutôt qu'un
écrasement silencieux du travail de l'un par l'autre.

Un cadrage livré ne se reprend plus : ses impacts sont propagés, et le rouvrir
ferait diverger le référentiel des cadrages qui le produisent.
