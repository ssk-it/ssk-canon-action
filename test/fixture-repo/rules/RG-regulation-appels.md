---
id: RG-regulation-appels
fonctionnalites: [stockage-git]
statut: actif
cree_par: 2026-002
modifie_par: [2026-006]
---

Les appels à l'API sont régulés **côté client**, par une file d'attente à
concurrence bornée, avec repli sur le délai d'attente indiqué par le serveur.

Les limites secondaires de la plateforme — requêtes concurrentes, écritures par
heure — s'appliquent au jeton d'accès, donc à l'installation entière : tous les
utilisateurs partagent le même budget. Le relais étant sans état, il ne peut pas
réguler.

**Les canaux non soumis à ces limites disposent de leur propre file, plus
large.** Les brider au même rythme que l'API ralentirait le chargement sans rien
protéger : mesuré, l'écart va du simple au double sur un référentiel de soixante
fichiers.

Corollaire pratique : les écritures sont groupées. Un enregistrement explicite ou
une temporisation longue, jamais un commit à chaque frappe.
