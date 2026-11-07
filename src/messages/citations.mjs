// The messages for citing another specification (`citations.mjs`).

/** The word naming what cites, in each language. */
const KIND = {
  fr: { regle: 'règle', adr: "décision d'architecture" },
  en: { regle: 'rule', adr: 'architecture decision' },
};

/** Where the target lives: the cited repo, or the specification itself. */
const WHERE = {
  fr: (repo) => (repo ? `dans ${repo}` : 'dans ce référentiel'),
  en: (repo) => (repo ? `in ${repo}` : 'in this repo'),
};

export const citations = {
  fr: {
    'referentiels-cites-mal-forme': () =>
      'ssk-canon.yml → referentiels_cites : attendu une liste de { prefixe, repo } — aucune citation ne se résout',
    'referentiel-cite-mal-forme': (p) =>
      `ssk-canon.yml → referentiels_cites, entrée ${p.position} : attendu { prefixe, repo }, ` +
      `le préfixe fait de lettres, chiffres ou « _ » commençant par une lettre, le dépôt de la forme <propriétaire>/<nom>`,
    'referentiel-cite-prefixe-du-projet': (p) =>
      `ssk-canon.yml → referentiels_cites : le préfixe « ${p.prefixe} » est celui du projet, il ne peut désigner un autre référentiel`,
    'referentiel-cite-en-double': (p) =>
      `ssk-canon.yml → referentiels_cites : le préfixe « ${p.prefixe} » est déclaré deux fois — seule la première déclaration compte`,
    'citation-mal-formee': (p) =>
      `${KIND.fr[p.nature]} ${p.source} → applique « ${p.texte} » : attendu <préfixe>:<identifiant>@<cadrage>, ` +
      `par exemple socle:RG-nommage-des-roles@2026-012`,
    'citation-prefixe-inconnu': (p) =>
      `${KIND.fr[p.nature]} ${p.source} → applique ${p.citation} : préfixe « ${p.prefixe} » inconnu — ` +
      `ni celui du projet, ni un référentiel déclaré dans referentiels_cites`,
    'citation-non-verifiee': (p) =>
      `${KIND.fr[p.nature]} ${p.source} → applique ${p.citation} : non vérifiée, ${p.repo} n’a pas pu être lu — ce qui ne veut pas dire valide`,
    'citation-absente': (p) =>
      `${KIND.fr[p.nature]} ${p.source} → applique ${p.citation} : introuvable ${WHERE.fr(p.repo)}`,
    'citation-abrogee': (p) =>
      `${KIND.fr[p.nature]} ${p.source} → applique ${p.citation} : abrogée` +
      `${p.cadrage ? ` par ${p.cadrage}` : ''} ${WHERE.fr(p.repo)}`,
    'citation-perimee': (p) =>
      `${KIND.fr[p.nature]} ${p.source} → applique ${p.citation} : modifiée depuis par ${p.recents.join(', ')} ` +
      `${WHERE.fr(p.repo)} — un cadrage doit en prendre acte`,
  },
  en: {
    'referentiels-cites-mal-forme': () =>
      'ssk-canon.yml → referentiels_cites: expected a list of { prefixe, repo } — no citation resolves',
    'referentiel-cite-mal-forme': (p) =>
      `ssk-canon.yml → referentiels_cites, entry ${p.position}: expected { prefixe, repo }, ` +
      `the prefix made of letters, digits or “_” starting with a letter, the repo of the form <owner>/<name>`,
    'referentiel-cite-prefixe-du-projet': (p) =>
      `ssk-canon.yml → referentiels_cites: the prefix “${p.prefixe}” is the project’s own, it cannot designate another repo`,
    'referentiel-cite-en-double': (p) =>
      `ssk-canon.yml → referentiels_cites: the prefix “${p.prefixe}” is declared twice — only the first declaration counts`,
    'citation-mal-formee': (p) =>
      `${KIND.en[p.nature]} ${p.source} → applique “${p.texte}”: expected <prefix>:<id>@<scoping>, ` +
      `for example socle:RG-nommage-des-roles@2026-012`,
    'citation-prefixe-inconnu': (p) =>
      `${KIND.en[p.nature]} ${p.source} → applies ${p.citation}: unknown prefix “${p.prefixe}” — ` +
      `neither the project’s nor a repo declared in referentiels_cites`,
    'citation-non-verifiee': (p) =>
      `${KIND.en[p.nature]} ${p.source} → applies ${p.citation}: not verified, ${p.repo} could not be read — which does not mean valid`,
    'citation-absente': (p) =>
      `${KIND.en[p.nature]} ${p.source} → applies ${p.citation}: not found ${WHERE.en(p.repo)}`,
    'citation-abrogee': (p) =>
      `${KIND.en[p.nature]} ${p.source} → applies ${p.citation}: repealed` +
      `${p.cadrage ? ` by ${p.cadrage}` : ''} ${WHERE.en(p.repo)}`,
    'citation-perimee': (p) =>
      `${KIND.en[p.nature]} ${p.source} → applies ${p.citation}: modified since by ${p.recents.join(', ')} ` +
      `${WHERE.en(p.repo)} — a scoping must take note of it`,
  },
};
