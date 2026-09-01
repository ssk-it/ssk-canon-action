---
name: cadrage-canon-update
description: Met à jour le skill cadrage-canon — le corriger, l'enrichir, ou le remettre à niveau depuis sa source publiée. À utiliser quand l'utilisateur signale un défaut du skill de cadrage, veut y ajouter quelque chose, ou demande de le mettre à jour. Le skill vit dans ssk-it/ssk-canon-action et non chez le développeur : ce skill-ci dit par où passer pour que les exemplaires ne divergent pas.
---

# Mettre à jour le skill de cadrage

`cadrage-canon` existe en **trois exemplaires**, et c'est tout le problème :

| Où | Rôle |
|---|---|
| `ssk-it/ssk-canon-action`, dossier `skills/cadrage-canon/` | **la source** — la seule qui fait autorité |
| `~/.claude/skills/cadrage-canon/` | la copie installée, celle qui s'exécute |
| ce que `raw.githubusercontent.com` sert depuis `main` | ce que les autres installeront |

**Modifier la copie installée sans toucher la source est le piège.** Le
changement fonctionne chez soi, disparaît à la prochaine réinstallation, et
n'atteint personne d'autre. La règle tient en une phrase : **modifier la source,
publier, puis réinstaller chez soi.**

## 0. Vérifier que les trois sont d'accord

Avant toute modification. S'ils divergent déjà, le comprendre d'abord : une
divergence est le signe d'une modification faite au mauvais endroit, et
l'écraser perdrait ce que quelqu'un avait voulu.

```bash
node ${CLAUDE_SKILL_DIR}/scripts/comparer.mjs
```

- **Tous identiques** — continuer.
- **Installé ≠ source** — quelqu'un a modifié sa copie. Récupérer ce qu'elle
  porte de bon avant de la remplacer.
- **Source ≠ publié** — un travail attend d'être fusionné. Le vérifier avant
  d'en empiler un autre.

## 1. Modifier la source, jamais la copie

Le dépôt est cloné en `~/dev/ssk-it/ssk-canon-action` (sinon, le cloner).

```bash
cd ~/dev/ssk-it/ssk-canon-action
git checkout main && git pull
git checkout -b <ce-que-la-branche-fait>
```

Ce qui compose le skill :

```
skills/cadrage-canon/
├── SKILL.md            le format, les étapes, les pièges
└── scripts/situer.mjs  trouve le référentiel du dépôt courant
```

**Ce dépôt passe par des demandes de fusion**, même si `main` n'est pas protégée
techniquement : les notes de version sont composées à partir d'elles. Une
poussée directe sur `main` ne casse rien mais fait disparaître le changement des
notes.

## 2. Ce qui vaut d'être su avant d'écrire

**Ne jamais employer l'injection de commande dans un SKILL.md** — la forme qui
préfixe par un point d'exclamation une commande entourée d'accents graves, pour
en insérer la sortie. Elle demande une approbation à chaque invocation et fait
échouer le chargement du skill. Écrire la commande dans un bloc `bash` en
demandant de l'exécuter — c'est ce que fait l'étape 0 de `cadrage-canon`.

**Ne pas l'écrire littéralement non plus, même pour la citer.** Le harnais ne
distingue pas une citation d'une vraie injection : la première version de ce
skill-ci échouait au chargement à cause de la ligne même qui met en garde
contre elle. La décrire en mots, comme ci-dessus.

**`${CLAUDE_SKILL_DIR}` se substitue**, y compris hors injection. C'est ainsi
que `SKILL.md` atteint ses scripts sans supposer où le skill est installé.

**Le `situer.mjs` ne dépend de rien.** Il lit un `ssk-canon.yml` ligne à ligne
plutôt que par un analyseur YAML : le skill ne doit rien avoir à installer pour
se situer. Garder cette propriété — ajouter une dépendance obligerait chaque
développeur à un `npm install` avant de pouvoir cadrer.

**Le format décrit dans `SKILL.md` doit s'accorder avec ce que vérifie
`src/verifier.mjs`**, dans le même dépôt. C'est la raison pour laquelle le skill
vit là : une description du format et le contrôle qui l'applique doivent changer
ensemble. Quand l'un bouge, relire l'autre.

## 3. Éprouver pour de bon

**Rien en intégration continue ne vérifie le skill** — ni sa forme, ni son
comportement. Ce qui suit est la seule vérification qui existe.

Une sonde simplifiée ne suffit pas : c'est ainsi que le défaut de l'injection
était passé, une sonde ayant employé une commande autorisée d'emblée là où la
vraie demandait une approbation. **Éprouver dans les conditions du rédacteur.**

Le script de situation, depuis un dépôt de code réel :

```bash
cd <un-dépôt-de-code-déclaré-par-un-projet>
node ~/dev/ssk-it/ssk-canon-action/skills/cadrage-canon/scripts/situer.mjs
```

Attendu : `CADRAGE_RETENU <chemin>` désignant le bon référentiel. Éprouver aussi
les cas qui échouent — un dépôt qu'aucun projet ne déclare, un chemin de config
qui ne mène à aucun `ssk-canon.yml`, hors dépôt git : chacun doit **nommer sa
cause**, jamais échouer en silence.

Le skill entier, chargé comme il le sera :

```bash
cd <un-dépôt-de-code-déclaré-par-un-projet>
claude -p "Invoque le skill cadrage-canon et suis son étape 0. Ne rédige aucun cadrage. Dis seulement le dépôt de cadrage retenu." --allowedTools "Skill" "Bash(node:*)" "Read"
```

Une session neuve est nécessaire : les skills sont chargés au démarrage, une
modification n'est pas visible de la session en cours.

## 4. Publier

```bash
git add skills/ && git commit && git push -u origin <branche>
gh pr create --fill
```

Puis, **une fois la demande fusionnée**, vérifier que `main` sert bien la
nouvelle version, et se réinstaller :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/comparer.mjs
```

S'il indique que l'installé est en retard :

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon \
  && cp -R /tmp/canon/skills/cadrage-canon ~/.claude/skills/ \
  && rm -rf /tmp/canon
```

C'est la commande que l'application de cadrage affiche dans ses réglages : la
même pour installer et pour mettre à jour, ce qui évite d'en tenir deux.

## 5. Ce qui reste à faire à la main

**Prévenir ceux qui l'ont installé.** Rien ne les avertit ni ne les met à jour :
chacun réexécute la commande d'installation quand il le veut. Une modification
qui change la façon de travailler mérite d'être dite.

**Cadrer si une décision a été prise.** Le skill décrit le format du produit :
en changer la description, c'est souvent changer le format. Si un choix a été
tranché, invoquer `cadrer-la-boucle` depuis `ssk-canon-pwa`.

## Si le changement touche au format lui-même

Alors il ne concerne pas que le skill. Vérifier ce qui doit bouger avec :

- `src/verifier.mjs` — le contrôle qui applique le format ;
- `example-repo/` dans `ssk-canon-pwa` — le référentiel de référence ;
- l'application, si elle lit ou écrit le champ concerné.

Un format décrit d'un côté et vérifié de l'autre ne se contredit jamais
longtemps sans que quelqu'un le paie.
