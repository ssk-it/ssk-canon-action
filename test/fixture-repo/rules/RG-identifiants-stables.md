---
id: RG-identifiants-stables
fonctionnalites: [modele-referentiel, stockage-git]
statut: actif
cree_par: 2026-001
modifie_par: [2026-014]
---

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
