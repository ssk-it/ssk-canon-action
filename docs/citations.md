[Sommaire](../README.md#documentation) · [English](en/citations.md)

# Citer un autre référentiel

Une règle commune à plusieurs produits — le nommage des rôles dans un fournisseur d'identité commun, les runners désignés — vit une fois, dans le référentiel du socle qui la réalise ; les référentiels des applications la **citent** sans la recopier (RG-regle-du-socle-citee, cadrage [ssk-canon#2026-068](https://ssk-canon.s3-website.fr-par.scw.cloud/ssk-it/ssk-canon/cadrages/2026-068)). Il n'y a pas d'héritage : un produit n'applique que ce qu'il cite.

Le citant déclare, dans son `ssk-canon.yml`, le dépôt que désigne chaque préfixe. Le préfixe est un alias qui lui est propre, et ne peut pas être celui du projet :

```yaml
referentiels_cites:
  - { prefixe: socle, repo: Vanex-Proprete/prime-infra-cadrage }
```

Une règle ou une décision d'architecture cite par son champ `applique`, avec le cadrage du référentiel cité dont elle a pris acte :

```yaml
applique:
  - socle:RG-nommage-des-roles@2026-012
```

Un préfixe désigne le projet lui-même ou un référentiel cité ; tout autre préfixe est une adresse inconnue (RG-prefixe-projet).

Comme le rattachement aux fonctionnalités, `applique` s'écrit dans le fichier de la règle ou de la décision, sur la branche du cadrage qui la cite ou qui prend acte d'un changement de la cible ; la propagation le garde à chaque réécriture, sans jamais le choisir.

La vérification lit la branche par défaut de chaque référentiel cité, et **avertit** (RG-citation-signalee-chez-le-citant) quand la cible :

- a été modifiée par un cadrage plus récent que celui noté — `citation-perimee` ; un cadrage du citant en prend acte en mettant à jour le numéro noté ;
- est abrogée — `citation-abrogee` —, ou introuvable — `citation-absente` ;
- n'a pas pu être lue, faute d'accès au référentiel cité — `citation-non-verifiee`, ce qui ne veut pas dire valide.

S'y ajoutent `citation-mal-formee`, `citation-prefixe-inconnu`, et pour la déclaration `referentiels-cites-mal-forme`, `referentiel-cite-mal-forme`, `referentiel-cite-en-double` et `referentiel-cite-prefixe-du-projet`. Ce ne sont jamais des erreurs : la cible change dans un autre dépôt, et bloquer ferait échouer des demandes de fusion du citant qui n'y sont pour rien. Le référentiel cité ne sait pas qui le cite.

## L'accès en lecture au référentiel cité

Un référentiel cité **public** se lit sans rien régler. Un référentiel cité **privé** demande un jeton : celui du workflow ne lit que son propre dépôt. Les modèles passent à l'action le secret `SSK_CANON_JETON_CITES`, qu'elle donne à la vérification ; sans lui, les citations vers un dépôt privé se disent non vérifiées, et rien n'échoue.

Le jeton se crée une fois, à la main, sur GitHub — *Settings → Developer settings → Fine-grained tokens* : propriétaire de la ressource, l'organisation des référentiels cités ; accès aux seuls dépôts cités ; permission *Contents* en lecture seule, rien d'autre. Un script le pose sur le dépôt cadré, après avoir vérifié qu'il lit chaque référentiel cité privé — le jeton se tape au clavier, sans écho, et le script se relance au renouvellement :

```bash
outillage/jeton-referentiels-cites.sh <organisation>/<depot-cadre>
```

Un jeton à grain fin ne porte que sur un propriétaire. Des référentiels cités chez plusieurs propriétaires se lisent avec un jeton d'application GitHub installée sur chacun (`actions/create-github-app-token`), produit dans une étape qui précède l'action et passé à `jeton-referentiels-cites` à la place du secret. Une demande de fusion venue d'un fork ne reçoit pas les secrets : ses citations privées restent non vérifiées.

La vérification clone chaque référentiel cité, superficiellement, dans un répertoire temporaire qu'elle efface ensuite. La sortie de Git est tue, l'adresse pouvant porter le jeton. En ligne de commande, `--cites <dossier>` lit d'abord un référentiel cité sous `<dossier>/<propriétaire>/<nom>`, pour un workflow qui l'a récupéré lui-même ; sinon le clone passe par les identifiants Git du poste, ou par `SSK_CANON_JETON_CITES` s'il est défini.
