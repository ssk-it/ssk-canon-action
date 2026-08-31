---
id: RG-ouverture-cadrage
fonctionnalites: [redaction-cadrage, cycle-vie-cadrage]
statut: actif
cree_par: 2026-014
modifie_par: []
---

L'application **ouvre un cadrage** : elle crée sa branche, y dépose son fichier
et ouvre la demande de fusion, en un seul geste du rédacteur.

Elle ne demande à la création que ce qu'un cadrage doit porter pour exister : un
titre, les domaines concernés, son objectif et le parcours attendu. Les
décisions, les impacts et les énoncés se rédigent ensuite, au fil de la
relecture — les exiger d'emblée confondrait l'ouverture d'un sujet avec sa
conclusion.

Les trois écritures ne forment pas un tout indivisible, la plateforme n'offrant
rien de tel. Leur ordre est choisi pour qu'un échec laisse un état rattrapable :
une branche sans fichier s'ignore, un fichier sans demande de fusion se retrouve
par le nom de sa branche. L'ordre inverse produirait une demande vide.

Le fichier produit doit satisfaire la vérification d'intégrité. Un cadrage
qu'on ouvre et qui bloque aussitôt sa propre demande de fusion serait pire que
pas d'ouverture du tout.
