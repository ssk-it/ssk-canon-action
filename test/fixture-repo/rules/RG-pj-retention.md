---
id: RG-pj-retention
fonctionnalites: [pieces-jointes]
statut: actif
cree_par: 2026-003
modifie_par: []
---

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
