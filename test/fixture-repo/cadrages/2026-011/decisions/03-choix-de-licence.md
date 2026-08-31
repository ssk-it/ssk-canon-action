---
id: 03-choix-de-licence
titre: Sous quelle licence publier l'automatisation ?
statut: retenue
option_retenue: permissive-avec-clause-de-brevet
---

## Description

Une fois décidé que l'automatisation serait publiée, restait à choisir sous quel
régime. Le choix engage : revenir sur une licence après diffusion suppose
l'accord de tous les contributeurs.

Le critère n'est pas la protection du code — quelques centaines de lignes
appliquant un format public sont reproductibles par quiconque veut le faire. Il
est ailleurs : ne pas créer de friction chez l'utilisateur, et ne pas s'exposer
à une revendication ultérieure.

## Options

### permissive-simple

Une licence courte autorisant tout usage, sans autre condition que la mention
d'origine.

**Pour** — la plus connue, jamais discutée, comprise sans lecture.
**Contre** — muette sur les brevets. Un contributeur pourrait céder son code puis
revendiquer un droit sur la méthode qu'il implémente, contre l'éditeur comme
contre ses utilisateurs.

### usage-restreint

Code lisible et modifiable, mais dont certains usages sont interdits —
typiquement la revente comme service concurrent.

**Pour** — protège d'une reprise commerciale directe.
**Contre** — protège d'un scénario qui n'existe pas ici : une automatisation qui
s'exécute chez le client ne peut pas être revendue comme service. Elle
déclencherait en revanche un examen juridique chez chaque utilisateur, et
contredirait la promesse d'une spécification qui reste exploitable sans
l'éditeur.

### permissive-avec-clause-de-brevet

**Retenue.** Une licence permissive incluant une concession de brevet réciproque
et la perte de cette concession pour qui engage une action en contrefaçon.

**Pour** — reconnue par défaut dans les organisations qui examinent les licences
avant adoption ; la concession joue dans les deux sens, protégeant l'éditeur des
contributions autant que l'utilisateur de l'éditeur.
**Contre** — plus longue, et impose de joindre un fichier de mentions.

## Décision

**Une licence permissive incluant la clause de brevet.**

Le risque de brevet sur une automatisation qui lit du texte structuré est
théorique. Ce qui ne l'est pas, c'est le temps perdu quand la licence d'une
dépendance n'est pas dans la liste habituelle d'une direction juridique : la
clause n'est pas tant une protection qu'un signal, et il ne coûte rien.

L'usage restreint a été écarté sur un raisonnement transposable : **une
protection dont le scénario ne s'applique pas n'est pas neutre, elle coûte.** Ici
elle aurait coûté un examen juridique chez chaque utilisateur, et une
contradiction avec ce que le produit promet.
