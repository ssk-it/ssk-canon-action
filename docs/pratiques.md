[Sommaire](../README.md#documentation) · [English](en/pratiques.md)

# Pratiques

## Les scripts de mise en place

Les scripts d'[`outillage/`](../outillage/) écrivent hors du dépôt : réglages, règles, variables et secrets des dépôts et des organisations GitHub. Ils se lancent rarement, souvent des mois après avoir été écrits, et sur un dépôt qui n'est pas celui-ci. Chacun source [`outillage/lib/ecritures-confirmees.sh`](../outillage/lib/ecritures-confirmees.sh), qui porte le bandeau, les confirmations, les modes, la locale et la saisie d'un secret.

La pratique tient en neuf points, détaillés dans la référence commune aux dépôts de ssk-it (`skills/initialiser-projet/references/scripts.md` du dépôt ssk-it/claude-config, d'où viennent aussi la bibliothèque et le contrôle) :

1. **Un bandeau, puis une confirmation globale** : la machine, le compte GitHub de la session `gh`, le dépôt ou l'organisation visés, ce que le script peut écrire, ses paramètres et d'où vient chacun, son mode — puis « Commencer ? ».
2. **Une confirmation avant chaque écriture** (`[o/N]`), `--noconfirm` pour un lancement décidé à l'avance, `--dry-run` qui lit et annonce tout sans rien écrire ; aucun secret en argument, à l'écran ni dans un fichier, et la réponse lue sur le terminal, jamais sur l'entrée standard.
3. **Idempotent, et un constat final** : ce qui est en place est laissé tel quel, un remplacement est une écriture à part, et une dernière étape en lecture seule constate le résultat — seule, avec `--constat`.
4. **Découpé en étapes**, une responsabilité chacune ; un orchestrateur mince les enchaîne sans rien faire d'autre.
5. **Une sortie stable** : `LC_ALL` sur une locale UTF-8, et du bash 3.2, celui de macOS.
6. **Une phrase en tête** : ce que fait le script, la commande qui le lance, et ce qu'il ne fait volontairement pas ; `--aide` la reprend.
7. **Un jeton demandé est expliqué** : sa plateforme, son rôle, sa durée de vie, ses autorisations au plus juste, et où l'obtenir.
8. **Un mot de passe choisi se propose au trousseau**, sous une entrée qui nomme l'utilisateur et la cible.
9. **Paramétrable** : ce qui varie d'un usage à l'autre passe en option ou en variable d'environnement, avec un défaut sûr ; jamais un secret.

### Ce qui est propre à ce dépôt

- **Une seule cible : GitHub, par la session de `gh`.** Aucun script ne demande d'identifiant, sauf `jeton-referentiels-cites.sh`, qui demande le jeton qu'il pose en secret, en dit la provenance et les autorisations, et le passe à `gh` par l'entrée standard.
- **Les paramètres usuels** sont `--depot <organisation>/<depot>` et `--organisation <organisation>`, chacun avec sa variable d'environnement (`DEPOT`, `ORGANISATION`). La forme positionnelle d'avant reste acceptée : `preparer-depot-cadre.sh <organisation>/<depot>`.
- **`preparer-depot-cadre.sh` sert tous les référentiels de cadrage** : il crée le dépôt depuis son clone s'il n'existe pas (`--source`, `--visibilite`, `--description`), règle la suppression des branches fusionnées et l'ouverture de demandes de fusion par les workflows, et pose avec `--controles` l'ensemble de règles qui exige la vérification sur la branche principale. Un référentiel ne recopie pas de script de mise en place GitHub à lui : il lance celui-ci avec ses paramètres.
- **L'orchestrateur est `preparer-depots-cadres.sh`** : il passe `preparer-depot-cadre.sh` sur chaque référentiel que déclare `~/.claude/cadrage-canon.json`, après un seul bandeau, sans création ni contrôles exigés.
- **La langue** : les commentaires des scripts sont en anglais, comme le code ; ce que lit l'utilisateur — bandeau, questions, constat, `--aide` — est en français, comme la bibliothèque ([Développement](developpement.md#langue-du-code)).

### Le contrôle

Le job « Scripts de mise en place » du workflow [Vérification](../.github/workflows/ci.yml) lance [`outillage/verifier-scripts-de-mise-en-place.sh`](../outillage/verifier-scripts-de-mise-en-place.sh) sur `outillage/`, dans l'image Docker `bash:3.2.57` figée par son empreinte, sur les runners de GitHub — le dépôt est public. Il vérifie que chaque script se lit sous bash 3.2, n'emploie aucune construction de bash 4, passe `shellcheck` et répond à `--aide` sans rien demander ; il vérifie aussi que chaque `.ps1` porte son BOM UTF-8. Le dépôt n'a pas de script PowerShell : un premier `.ps1` garde son BOM, et vient avec `ecritures-confirmees.ps1`, copié du même gabarit.

Sur un Mac, le contrôle se lance tel quel — `/bin/bash` y est en 3.2, et `shellcheck` s'installe par `brew install shellcheck` :

```bash
outillage/verifier-scripts-de-mise-en-place.sh outillage
```

La bibliothèque et le contrôle sont des copies du gabarit : une correction se fait d'abord dans le gabarit, puis se recopie ici, sans quoi les dépôts divergent. Le bandeau, les confirmations, l'idempotence et le constat se jugent en revue.
