---
id: 2026-014
titre: Ouvrir un cadrage depuis l'application
domaines: [cadrage, acces, persistance]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon' }
impacts:
  - { regle: RG-ouverture-cadrage, operation: cree }
  - { regle: RG-droits-ecriture, operation: cree }
  - { regle: RG-statuts-cadrage, operation: modifie }
  - { regle: RG-identifiants-stables, operation: modifie }
  - { regle: RG-branche-par-cadrage, operation: touche }
  - { regle: RG-connexion-optionnelle, operation: touche }
  - { regle: RG-message-nomme-la-cause, operation: touche }
---

## Objectif

Ouvrir un cadrage sans quitter l'outil.

Jusqu'ici, l'application ne savait que lire. Rédiger un cadrage demandait de
créer une branche à la main, d'y déposer un fichier au bon format et d'ouvrir une
demande de fusion — trois gestes techniques, pour une action qui est le point de
départ de tout le reste. Un outil de cadrage qui ne sait pas ouvrir un cadrage
laisse à son utilisateur la partie la plus rebutante du travail.

La réalisation a tranché une question restée en suspens depuis le socle : **d'où
vient le statut d'un cadrage ?** Le format le porte dans le fichier, une règle
plus ancienne le faisait dériver de l'état de la demande de fusion. Les deux ne
peuvent pas être vrais.

## Parcours utilisateur

1. Depuis la liste des cadrages, le rédacteur ouvre un nouveau cadrage.
2. L'application lui montre l'identifiant qui sera attribué, avant toute saisie.
3. Il saisit un titre, les domaines concernés, l'objectif et le parcours attendu.
4. À la validation, l'application crée la branche du cadrage, y dépose le
   fichier, et ouvre la demande de fusion.
5. Elle le conduit vers cette demande, où le cadrage se relit et se commente
   jusqu'à sa livraison.
6. Sans les droits nécessaires, l'application le dit avant d'échouer, et nomme
   ce qui manque.

## Énoncés

### RG-ouverture-cadrage

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

### RG-droits-ecriture

Rédiger demande des droits que la consultation n'exige pas, et l'application les
**nomme lorsqu'ils manquent** plutôt que de rapporter le refus de la plateforme.

Deux droits distincts sont nécessaires, et les confondre égare : l'un autorise à
écrire dans le dépôt — créer la branche, y déposer le fichier — l'autre à ouvrir
la demande de fusion. Le premier agit sans qu'aucune demande existe encore.

Ces droits n'ouvrent pas pour autant le référentiel : la protection de la branche
principale exige que la vérification d'intégrité soit passée. Un accès en
écriture permet d'ouvrir un cadrage, jamais de le livrer seul.

### RG-statuts-cadrage

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

### RG-identifiants-stables

Chaque entité porte un identifiant **stable à vie**, lisible, qui ne change jamais
même si son intitulé ou son contenu est réécrit.

Les règles suivent le format `RG-<slug-kebab>`, les cadrages `<année>-<séquence
sur 3 chiffres>`. Les identifiants ne sont jamais réutilisés, y compris après
abrogation.

L'identifiant d'un cadrage est attribué à son ouverture, en suivant la plus haute
séquence déjà employée dans l'année. La séquence ne comble jamais un trou : un
identifiant abandonné reste brûlé, sans quoi une référence ancienne désignerait
un cadrage sans rapport avec ce qu'elle visait.

Il est montré au rédacteur avant qu'il ne saisisse quoi que ce soit — un
identifiant qui apparaît après coup se découvre au lieu de se choisir.
