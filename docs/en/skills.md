[Contents](../../README.en.md#documentation) · [Français](../skills.md)

# The skills

## The scoping skill

`skills/cadrage-canon/` holds a Claude Code skill that writes a cadrage in the format this action checks. It lives next to the checker rather than in a client project: when the format changes, the skill follows, and a single description of the format exists in the world.

Installing it on your machine:

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/cadrage-canon ~/.claude/skills/
```

Then say where the référentiels are cloned on this machine, in `~/.claude/cadrage-canon.json`:

```json
{ "projets": ["~/chemin/vers/le-depot-de-cadrage"] }
```

An optional `arret` field says how far the skill goes once the cadrage is written: `ecriture` (the default, it records nothing), `commit`, `push` or `pr`. It is set globally or per project, the project's taking precedence:

```json
{
  "arret": "commit",
  "projets": [{ "chemin": "~/chemin/vers/un-autre", "arret": "pr" }]
}
```

Opening the work — one issue per impacted code repository, once the cadrage's pull request is open — does not depend on this setting: it writes in another repository than the référentiel, and is therefore never done without explicit approval, whatever the `arret`.

Nothing is to be configured in the code repositories: the skill recognises the current repository by its `origin`, and looks for the project whose `ssk-canon.yml` declares that repository. The link is thus declared once, on the side that has authority:

```yaml
depots_code:
  - { repo: organisation/depot-front, role: Application web }
  - { repo: organisation/depot-back, role: API }
```

The scoping application offers this skill for download from its settings.

### Updating it

`skills/cadrage-canon-update/` says which way to go. The skill exists in three copies — the source here, the copy installed on the developer's machine, and what the main branch serves — and modifying the installed copy is the trap: the change works locally, disappears at the next reinstall, and reaches nobody.

```bash
node ~/.claude/skills/cadrage-canon-update/scripts/comparer.mjs
```

The script says which of the three has moved before anything is overwritten.

Nothing in continuous integration checks these skills: what `cadrage-canon-update` describes is the only check there is.

## Scoping from a Trello card

`skills/cadrage-depuis-trello/` starts from a card rather than a blank page: it reads its title, description, checklists, comments and attachments, then hands the material to `cadrage-canon`. A card expresses a need briefly; the cadrage investigates it.

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/cadrage-depuis-trello ~/.claude/skills/
```

It needs Trello credentials, in `~/.claude/trello.json`:

```json
{ "cle": "<API key>", "jeton": "<token>" }
```

The token is issued with `scope=read,write`. Writing serves only two things: posting back on the card, as a comment, the link of the cadrage born from it, and attaching to it each pull request the card has opened. Without this the link exists only in the cadrage, on the side the client does not look at — they look at Trello, where nothing says their need has been investigated. The skill moves no card and changes neither its status nor its labels.

The comment is posted only once per link, the attachment is attached only once per URL: resuming a cadrage or running the skill again does not pile up duplicates on a card the client reads.

## Consult the référentiel before scoping or developing

`skills/consulter-referentiel/` says what the référentiel already knows about a subject: the rules in force for a domain, the decisions taken, the delivered cadrages, and those still in progress on their branch — the only ones seen nowhere else, and therefore those one risks redoing or contradicting.

```bash
git clone -q --depth 1 https://github.com/ssk-it/ssk-canon-action /tmp/canon
cp -R /tmp/canon/skills/consulter-referentiel ~/.claude/skills/
```

It is installed next to `cadrage-canon`, from which it borrows how to locate things: a single way to find the référentiel of the current repository. `cadrage-canon` applies it before writing; the scoping and evolution skills of the code repositories refer to it in one line, rather than each copying its method.

It reads `origin/main` and the remote branches, never the working copy: a référentiel clone opened once and never pulled is soon dozens of deliveries behind.

**A merged branch left on the origin misleads the consultation.** The skill takes every remote branch for work in progress: it cannot know that a squash merge has already brought its content to `main`. A branch left behind a merged pull request therefore announces as in progress changes that `main` has already absorbed, then moved past, and the summary reports these false overlaps to the caller, who submits them to the user. On 6 November 2026, of 84 delivered files the consultation said were modified on a branch, 62 came from such branches; 244 lingered in 22 référentiels. The only lasting remedy is deleting the branch on merge, which `outillage/preparer-depot-cadre.sh` sets ([Installation in a scoped repository](../../README.en.md#installation-in-a-scoped-repository)): a référentiel without this setting sees its consultations degrade with every delivered cadrage.

It runs in a subagent (`context: fork`): a consultation reads some fifteen thousand tokens of cadrages and rules, of which the caller receives only the summary. The request's text must therefore be passed to it as an argument — the subagent does not see the conversation.

```bash
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs                      # index
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --domaine commande   # one domain
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --issue depot#123    # an issue's cadrage
node ~/.claude/skills/consulter-referentiel/scripts/consulter.mjs --motif "QR code"    # a business term
```
