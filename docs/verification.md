[Sommaire](../README.md#documentation) · [English](en/verification.md)

# Vérification seule

`appliquer: false` ne modifie jamais le référentiel. L'action échoue si un
cadrage est incohérent, ou si le référentiel a dérivé de ses cadrages :

```yaml
- uses: actions/checkout@v4
  with:
    # le contrôle d'immuabilité compare deux états : sans l'historique, il
    # échoue au lieu de laisser croire qu'il a eu lieu
    fetch-depth: 0
- uses: ssk-it/ssk-canon-action@main
  with:
    referentiel: '.'
    appliquer: 'false'
```

Ce qu'elle attrape, que le format seul ne garantit pas : un impact vers une
règle inexistante, un énoncé manquant pour une création ou une modification, un
rattachement vers une entité inconnue, une règle abrogée par un cadrage non
livré.

Elle contrôle aussi le répertoire `identite/`, où un référentiel peut porter
l'identité visuelle de son projet. Rien ne la déclare : c'est le nom des
fichiers qui fait foi, et un fichier mal nommé serait sinon ignoré sans bruit.

- **Noms admis** : `symbole` et `logotype`, suivis ou non de `-clair` ou
  `-sombre` — `symbole.svg`, `logotype-sombre.png` —, et un `README.md`.
- **Formats admis** : SVG, WebP et PNG, dans cet ordre de préférence.
- **Poids** : 100 Kio au plus par fichier.

Un autre nom, un autre format ou un poids dépassé est une erreur. Un même nom
en plusieurs formats, ou une variante sans sa jumelle quand aucune version sans
suffixe ne couvre l'autre fond, est signalé sans bloquer. Le répertoire n'est
pas un répertoire de contenu : ses fichiers ne sont pas lus comme des entités.

Dès que la demande de fusion est **proposée à la relecture**, elle contrôle en
outre l'état qu'aura le référentiel **une fois cette demande fusionnée** : les
cadrages qu'elle porte y sont tenus pour livrés. Ce que la livraison exigera —
le fichier de chaque règle créée, son rattachement à une fonctionnalité — est
ainsi réclamé tant qu'il est encore temps de l'écrire, et non découvert après la
fusion, quand la propagation s'arrête et qu'il n'y a plus de demande à corriger.
Un brouillon en est dispensé : il n'annonce pas de livraison, et le rendre rouge
en permanence ferait cesser de le lire.

Les index dérivés — `cree_par`, `modifie_par` — sont exclus de ce contrôle :
c'est la propagation qui les écrit, après la fusion.

Sur la branche principale, **la vérification n'a pas à être déclenchée** : la
propagation s'y exécute déjà, et vérifie le référentiel qu'elle vient d'écrire.
Deux contrôles sur la même poussée se lisent à contretemps — celui qui n'écrit
pas rapporte l'état d'avant l'autre, et échoue à chaque livraison d'un cadrage
créant une règle.
