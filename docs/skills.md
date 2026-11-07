[Sommaire](../README.md#documentation) · [English](en/skills.md)

# Les skills

## Le skill de cadrage

`skills/cadrage-canon/` porte un skill Claude Code qui rédige un cadrage dans le
format que vérifie cette action. Il vit auprès du vérificateur plutôt que dans un projet
client : quand le format change, le skill suit, et une seule description du
format existe au monde.

L'installer chez soi :

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/cadrage-canon ~/.claude/skills/
```

Puis dire où les référentiels sont clonés sur cette machine, dans
`~/.claude/cadrage-canon.json` :

```json
{ "projets": ["~/chemin/vers/le-depot-de-cadrage"] }
```

Un champ `arret` facultatif dit jusqu'où le skill va une fois le cadrage écrit :
`ecriture` (le défaut, il n'enregistre rien), `commit`, `push` ou `pr`. Il se
règle globalement ou par projet, celui du projet primant :

```json
{
  "arret": "commit",
  "projets": [{ "chemin": "~/chemin/vers/un-autre", "arret": "pr" }]
}
```

L'ouverture du chantier — une issue par dépôt de code impacté, une fois la
demande de fusion du cadrage ouverte — ne relève pas de ce réglage : elle écrit
dans un autre dépôt que le référentiel, et ne se fait donc jamais sans validation
explicite, quel que soit l'`arret`.

Rien n'est à configurer dans les dépôts de code : le skill reconnaît le dépôt
courant à son `origin`, et cherche le projet dont le `ssk-canon.yml` déclare ce
dépôt. Le lien est ainsi déclaré une seule fois, du côté qui a autorité :

```yaml
depots_code:
  - { repo: organisation/depot-front, role: Application web }
  - { repo: organisation/depot-back, role: API }
```

L'application de cadrage propose ce skill au téléchargement depuis ses réglages.

### Le mettre à jour

`skills/cadrage-canon-update/` dit par où passer. Le skill existe en trois
exemplaires — la source ici, la copie installée chez le développeur, et ce que
la branche principale sert — et modifier la copie installée est le piège : le
changement fonctionne chez soi, disparaît à la réinstallation suivante, et
n'atteint personne.

```bash
node ~/.claude/skills/cadrage-canon-update/scripts/comparer.mjs
```

Le script dit lequel des trois a bougé avant qu'on n'écrase quoi que ce soit.

Rien en intégration continue ne vérifie ces skills : ce que `cadrage-canon-update`
décrit est la seule vérification qui existe.

## Cadrer depuis une carte Trello

`skills/cadrage-depuis-trello/` part d'une carte plutôt que d'une page blanche :
il en lit le titre, la description, les checklists, les commentaires et les
pièces jointes, puis passe la matière à `cadrage-canon`. Une carte exprime un
besoin succinctement ; le cadrage l'instruit.

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/cadrage-depuis-trello ~/.claude/skills/
```

Il lui faut des identifiants Trello, dans `~/.claude/trello.json` :

```json
{ "cle": "<clé API>", "jeton": "<jeton>" }
```

Le jeton s'émet en `scope=read,write`. L'écriture ne sert qu'à deux choses :
reposer sur la carte, en commentaire, le lien du cadrage qui en est né, et y
attacher en pièce jointe chaque demande de fusion que la carte fait ouvrir. Sans
ce geste le rattachement n'existe que dans le cadrage, du côté que le client ne
consulte pas — il regarde Trello, où rien ne dit que son besoin a été instruit.
Le skill ne déplace aucune carte et n'en change ni le statut ni les étiquettes.

Le commentaire ne se poste qu'une fois par lien, la pièce jointe ne s'attache
qu'une fois par URL : reprendre un cadrage ou relancer le skill n'empile pas de
doublons sur une carte que le client lit.

## Consulter le référentiel avant de cadrer ou de développer

`skills/consulter-referentiel/` dit ce que le référentiel sait déjà d'un sujet :
les règles en vigueur d'un domaine, les décisions prises, les cadrages livrés, et
ceux encore en cours sur leur branche — les seuls qu'on ne voit nulle part
ailleurs, et donc ceux qu'on risque de refaire ou de contredire.

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/consulter-referentiel ~/.claude/skills/
```

Il s'installe à côté de `cadrage-canon`, dont il emprunte la situation : une seule
manière de trouver le référentiel du dépôt courant. `cadrage-canon` l'applique
avant d'écrire ; les skills de cadrage et d'évolution des dépôts de code y
renvoient d'une ligne, plutôt que d'en recopier chacun la méthode.

Il lit `origin/main` et les branches distantes, jamais la copie de travail : un
clone de référentiel ouvert une fois et jamais tiré a vite des dizaines de
livraisons de retard.

**Une branche fusionnée qui reste sur l'origine trompe la consultation.** Le skill tient chaque branche distante pour un travail en cours : il ne peut pas savoir qu'une fusion par squash a déjà porté son contenu sur `main`. Une branche laissée derrière une demande fusionnée annonce donc comme en cours des modifications que `main` a déjà absorbées, puis dépassées, et la synthèse remonte ces faux recouvrements à l'appelant, qui les soumet à l'utilisateur. Le 6 novembre 2026, sur 84 fichiers livrés que la consultation disait modifiés sur une branche, 62 venaient de telles branches ; 244 traînaient dans 22 référentiels. Le seul remède durable est la suppression de la branche à la fusion, que `outillage/preparer-depot-cadre.sh` règle ([Installation dans un dépôt cadré](../README.md#installation-dans-un-dépôt-cadré)) : un référentiel sans ce réglage voit ses consultations se dégrader à chaque cadrage livré.

Il s'exécute dans un sous-agent (`context: fork`) : une consultation lit une
quinzaine de milliers de tokens de cadrages et de règles, dont l'appelant ne
reçoit que la synthèse. Il faut donc lui passer en argument le texte de la
demande — le sous-agent ne voit pas la conversation.

```bash
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs                      # index
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --domaine commande   # un domaine
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --issue depot#123    # le cadrage d'une issue
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --motif "QR code"    # un terme métier
```
