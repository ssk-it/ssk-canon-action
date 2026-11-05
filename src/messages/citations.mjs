// Les messages de la citation d'un autre référentiel (`citations.mjs`).

/** Le mot qui nomme ce qui cite, dans chaque langue. */
const NATURE = {
  fr: { regle: 'règle', adr: "décision d'architecture" },
  en: { regle: 'rule', adr: 'architecture decision' },
};

/** Où vit la cible : le dépôt cité, ou le référentiel lui-même. */
const OU = {
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
      `${NATURE.fr[p.nature]} ${p.source} → applique « ${p.texte} » : attendu <préfixe>:<identifiant>@<cadrage>, ` +
      `par exemple socle:RG-nommage-des-roles@2026-012`,
    'citation-prefixe-inconnu': (p) =>
      `${NATURE.fr[p.nature]} ${p.source} → applique ${p.citation} : préfixe « ${p.prefixe} » inconnu — ` +
      `ni celui du projet, ni un référentiel déclaré dans referentiels_cites`,
    'citation-non-verifiee': (p) =>
      `${NATURE.fr[p.nature]} ${p.source} → applique ${p.citation} : non vérifiée, ${p.repo} n’a pas pu être lu — ce qui ne veut pas dire valide`,
    'citation-absente': (p) =>
      `${NATURE.fr[p.nature]} ${p.source} → applique ${p.citation} : introuvable ${OU.fr(p.repo)}`,
    'citation-abrogee': (p) =>
      `${NATURE.fr[p.nature]} ${p.source} → applique ${p.citation} : abrogée` +
      `${p.cadrage ? ` par ${p.cadrage}` : ''} ${OU.fr(p.repo)}`,
    'citation-perimee': (p) =>
      `${NATURE.fr[p.nature]} ${p.source} → applique ${p.citation} : modifiée depuis par ${p.recents.join(', ')} ` +
      `${OU.fr(p.repo)} — un cadrage doit en prendre acte`,
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
      `${NATURE.en[p.nature]} ${p.source} → applique “${p.texte}”: expected <prefix>:<id>@<scoping>, ` +
      `for example socle:RG-nommage-des-roles@2026-012`,
    'citation-prefixe-inconnu': (p) =>
      `${NATURE.en[p.nature]} ${p.source} → applies ${p.citation}: unknown prefix “${p.prefixe}” — ` +
      `neither the project’s nor a repo declared in referentiels_cites`,
    'citation-non-verifiee': (p) =>
      `${NATURE.en[p.nature]} ${p.source} → applies ${p.citation}: not verified, ${p.repo} could not be read — which does not mean valid`,
    'citation-absente': (p) =>
      `${NATURE.en[p.nature]} ${p.source} → applies ${p.citation}: not found ${OU.en(p.repo)}`,
    'citation-abrogee': (p) =>
      `${NATURE.en[p.nature]} ${p.source} → applies ${p.citation}: repealed` +
      `${p.cadrage ? ` by ${p.cadrage}` : ''} ${OU.en(p.repo)}`,
    'citation-perimee': (p) =>
      `${NATURE.en[p.nature]} ${p.source} → applies ${p.citation}: modified since by ${p.recents.join(', ')} ` +
      `${OU.en(p.repo)} — a scoping must take note of it`,
  },
};
