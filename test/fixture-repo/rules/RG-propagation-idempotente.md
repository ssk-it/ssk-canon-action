---
id: RG-propagation-idempotente
fonctionnalites: [impacts-regles]
statut: actif
cree_par: 2026-010
modifie_par: []
---

La propagation **compare l'état déclaré par les cadrages livrés à l'état réel du
référentiel**, et n'écrit que l'écart. Elle ne rejoue pas un historique.

Il en découle qu'appliquée à un référentiel déjà conforme, elle n'écrit rien. On
peut donc la relancer sans risque : après un échec, après une correction
manuelle, ou pour rattraper une livraison dont la propagation aurait été manquée.

Une propagation qu'on hésite à relancer est une propagation qu'on n'ose pas
utiliser quand elle est justement nécessaire.
