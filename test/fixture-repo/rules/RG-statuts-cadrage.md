---
id: RG-statuts-cadrage
fonctionnalites: [cycle-vie-cadrage]
statut: actif
cree_par: 2026-001
modifie_par: [2026-002, 2026-014]
---

Un cadrage passe par quatre statuts : **brouillon**, **en relecture**,
**validée**, **livrée**.

Le statut est **porté par le cadrage lui-même**, dans son fichier. C'est la
source unique : la vérification d'intégrité et la propagation le lisent là, et un
référentiel reste ainsi entièrement lisible sans interroger aucune demande de
fusion — y compris dans une copie locale, ou une fois le dépôt archivé.

Chaque statut a néanmoins son reflet dans le cycle d'une demande de fusion :
branche créée, demande ouverte, demande approuvée, demande fusionnée. Le
rapprochement se lit, il ne se substitue pas au champ : deux sources de vérité
divergeraient, et c'est celle qui vit dans le dépôt qui fait foi.

L'historique des transitions, lui, n'est pas stocké : il se dérive des
événements de la demande de fusion, chacun daté et attribué.
