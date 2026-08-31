---
id: RG-referentiel-a-une-date
fonctionnalites: [historique]
statut: actif
cree_par: 2026-002
modifie_par: [2026-013]
---

Le référentiel est reconstituable **tel qu'il était à un instant passé**.

La reconstitution s'appuie sur le dernier enregistrement antérieur à l'instant,
puis sur l'arborescence complète à cet enregistrement. Elle ne coûte que deux
appels décomptés, quelle que soit la taille du référentiel : les contenus sont
servis par le canal non décompté, y compris adressés par un enregistrement
passé.

Cette reconstitution ne se consulte pas seule. Elle sert de fondement à la
comparaison entre deux instants, qui répond à la question réellement posée :
consulter un état ancien obligerait le lecteur à se souvenir de l'état courant
pour en repérer l'écart.
