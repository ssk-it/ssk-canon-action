// Les messages du contrôle de livraison et de l'Action (`check.mjs`, `livraison.mjs`).

export const livraison = {
  fr: {
    'branche-deja-fusionnee': (p) =>
      `branche déjà fusionnée dans « ${p.reference} », jusqu'à ${p.fusion} : ses index dérivés ` +
      `y attendent la propagation et ne sont pas contrôlés ici — repartir de ` +
      `« ${p.reference} », et changer un cadrage livré par un nouveau cadrage`,
    'nom-change': (p) =>
      `ssk-canon.yml → ${p.bloc}.${p.cle} : passe de « ${p.ancien} » à « ${p.nom} » — ` +
      `un nom se choisit à la création, et ne change plus`,
    'livraison-hors-d-atteinte': (p) =>
      `livraison : « ${p.base} » est hors d'atteinte, le contrôle n'a pas pu ` +
      `avoir lieu — récupérer l'historique avec « fetch-depth: 0 »`,
    'immuabilite-hors-d-atteinte': (p) =>
      `immuabilité : « ${p.base} » est hors d'atteinte, le contrôle n'a pas pu ` +
      `avoir lieu — récupérer l'historique avec « fetch-depth: 0 »`,
    'cadrage-livre-modifie': (p) =>
      `cadrage ${p.cadrage} : livré, donc figé — ${p.chemins.join(', ')} ; ` +
      `ce qui doit changer se change par un nouveau cadrage`,

    // le rapport de la vérification en ligne de commande
    'rapport-comptes': (p) =>
      `${p.domaines} domaines · ${p.fonctionnalites} fonctionnalités · ` +
      `${p.regles} règles · ${p.cadrages} cadrages`,
    'rapport-avertissements': (p) => `${p.nombre} avertissement(s) :`,
    'rapport-erreurs': (p) => `${p.nombre} erreur(s) :`,
    'rapport-integrite-verifiee': () => 'Intégrité vérifiée.',

    // ce que l'Action écrit elle-même
    'action-immuabilite-suspendue': () =>
      "Contrôle d'immuabilité suspendu — un cadrage livré peut être modifié.",
  },
  en: {
    'branche-deja-fusionnee': (p) =>
      `branch already merged into “${p.reference}”, up to ${p.fusion}: its derived indexes ` +
      `await propagation there and are not checked here — start again from ` +
      `“${p.reference}”, and change a delivered scoping with a new scoping`,
    'nom-change': (p) =>
      `ssk-canon.yml → ${p.bloc}.${p.cle}: changes from “${p.ancien}” to “${p.nom}” — ` +
      `a name is chosen at creation, and never changes`,
    'livraison-hors-d-atteinte': (p) =>
      `delivery: “${p.base}” is out of reach, the check could not run — ` +
      `fetch the history with “fetch-depth: 0”`,
    'immuabilite-hors-d-atteinte': (p) =>
      `immutability: “${p.base}” is out of reach, the check could not run — ` +
      `fetch the history with “fetch-depth: 0”`,
    'cadrage-livre-modifie': (p) =>
      `scoping ${p.cadrage}: delivered, hence frozen — ${p.chemins.join(', ')}; ` +
      `what must change is changed by a new scoping`,

    'rapport-comptes': (p) =>
      `${p.domaines} domains · ${p.fonctionnalites} features · ` +
      `${p.regles} rules · ${p.cadrages} scopings`,
    'rapport-avertissements': (p) => `${p.nombre} warning(s):`,
    'rapport-erreurs': (p) => `${p.nombre} error(s):`,
    'rapport-integrite-verifiee': () => 'Integrity verified.',

    'action-immuabilite-suspendue': () =>
      'Immutability check suspended — a delivered scoping can be modified.',
  },
};
