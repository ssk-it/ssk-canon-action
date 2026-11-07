// Citing another specification — RG-regle-du-socle-citee,
// RG-citation-signalee-chez-le-citant, RG-prefixe-projet.
//
// A rule shared by several products lives once, in the specification of the
// foundation that implements it; the others cite it through an `applique`
// field, with the foundation's scoping they have acknowledged, under a prefix
// they declare in `referentiels_cites`. The foundation does not know who cites
// it: everything is read and reported on the citing side.
//
// No file-system dependency, like the rest of the format: the check and the
// interface read citations here, and nowhere else.
//
// Everything reported here is a warning, never an error. A target changes in
// another repo: blocking would make pull requests fail, on the citing side,
// that have nothing to do with it, at the moment someone delivers elsewhere.

import { createWarning } from './anomalies.mjs';

/**
 * A project prefix, as it may precede an identifier.
 *
 * Neither a hyphen nor a leading digit, for the same reason: the prefix is
 * separated from the identifier by a hyphen, and the identifier starts with a
 * year. A prefix « PRM-CO » or « 2026 » would make « PRM-CO-2026-001 » and
 * « 2026-2026-001 » impossible to split without guessing — and guessing, here,
 * would lead to the wrong scoping.
 */
export const FORME_PREFIXE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** `<prefix>:<identifier>@<scoping>` — the noted scoping is the cited specification's. */
const CITATION_PATTERN = /^([A-Za-z][A-Za-z0-9_]*):([^\s:@]+)@(\d{4}-\d+)$/;

/** A GitHub repo, `<owner>/<name>`. */
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** What can cite, and where to find it in a loaded specification. */
const SOURCES = [
  { nature: 'regle', collection: 'rules' },
  { nature: 'adr', collection: 'decisions' },
];

/**
 * A parsed citation, or `null` if it does not follow the pattern.
 *
 * @param {unknown} text
 * @returns {{ prefixe: string, id: string, cadrage: string } | null}
 */
export function lireCitation(text) {
  if (typeof text !== 'string') return null;
  const m = CITATION_PATTERN.exec(text);
  return m ? { prefixe: m[1], id: m[2], cadrage: m[3] } : null;
}

/**
 * Compares two scoping identifiers, by year then by number.
 *
 * Not as text: « 2026-1000 » would come before « 2026-999 », and a recent
 * modification would pass for an old one.
 */
export function comparerCadrages(a, b) {
  const [ya, na] = String(a).split('-').map(Number);
  const [yb, nb] = String(b).split('-').map(Number);
  return ya - yb || na - nb;
}

/** The prefix the project declares for itself, if well formed. */
function projectPrefix(config) {
  const p = config?.projet?.prefixe;
  return p !== undefined && FORME_PREFIXE.test(String(p)) ? String(p) : null;
}

/**
 * The specifications the project cites, by prefix, as `ssk-canon.yml`
 * declares them in `referentiels_cites`.
 *
 * A faulty entry is set aside and warned about. The prefix is an alias of the
 * citing side's own: it need not repeat the one the cited specification
 * declares for itself, but cannot take the project's, which already designates
 * the project.
 *
 * @returns {{ cites: Map<string, string>, anomalies: object[] }}
 */
export function referentielsCites(config) {
  const cites = new Map();
  const anomalies = [];
  const block = config?.referentiels_cites;
  if (block === undefined || block === null) return { cites, anomalies };
  if (!Array.isArray(block)) {
    anomalies.push(createWarning('referentiels-cites-mal-forme'));
    return { cites, anomalies };
  }

  const own = projectPrefix(config);
  block.forEach((entry, i) => {
    const { prefixe, repo } = entry && typeof entry === 'object' ? entry : {};
    if (!FORME_PREFIXE.test(String(prefixe ?? '')) || !REPO_PATTERN.test(String(repo ?? '')))
      anomalies.push(createWarning('referentiel-cite-mal-forme', { position: i + 1 }));
    else if (prefixe === own)
      anomalies.push(createWarning('referentiel-cite-prefixe-du-projet', { prefixe }));
    else if (cites.has(prefixe))
      anomalies.push(createWarning('referentiel-cite-en-double', { prefixe }));
    else cites.set(prefixe, repo);
  });
  return { cites, anomalies };
}

/**
 * What a prefix designates: the project itself, a specification it cites, or
 * an unknown address — a well-formed identifier is not enough.
 *
 * @returns {{ nature: 'projet' } | { nature: 'cite', repo: string } | { nature: 'inconnue' }}
 */
export function resoudrePrefixe(prefix, config) {
  if (prefix === projectPrefix(config)) return { nature: 'projet' };
  const repo = referentielsCites(config).cites.get(prefix);
  return repo ? { nature: 'cite', repo } : { nature: 'inconnue' };
}

/** A target in a loaded specification: a rule or an architecture decision. */
function findTarget(specification, id) {
  return specification.rules?.get(id) ?? specification.decisions?.get(id) ?? null;
}

/** A cited specification counts as read if it carries at least its rules. */
const isRead = (s) => Boolean(s && typeof s === 'object' && s.rules instanceof Map);

/**
 * The state of each citation of the specification, in the order of rules then
 * architecture decisions.
 *
 * `cites` carries, by prefix, the cited specification already loaded, or
 * `null` if it could not be. A prefix missing from `cites` was not read either:
 * the citation is then unchecked, which does not mean valid.
 *
 * `etat` is `a-jour`, `perimee`, `abrogee`, `absente`, `non-verifiee`,
 * `prefixe-inconnu` or `mal-formee`. `repo` is the cited repo, `null` when the
 * prefix is the project's.
 *
 * @param {{ config?: object, rules: Map, decisions?: Map }} repo
 * @param {{ cites?: ReadonlyMap<string, object | null> }} [options]
 */
export function etatDesCitations(repo, { cites = new Map() } = {}) {
  const states = [];
  for (const { nature, collection } of SOURCES)
    for (const [source, entity] of repo[collection] ?? []) {
      const applique = entity?.applique;
      if (applique === undefined || applique === null) continue;
      if (!Array.isArray(applique)) {
        states.push({ source, nature, texte: String(applique), citation: null, etat: 'mal-formee' });
        continue;
      }
      for (const text of applique) states.push({ source, nature, texte: String(text), ...stateOf(text) });
    }
  return states;

  function stateOf(text) {
    const citation = lireCitation(text);
    if (!citation) return { citation: null, etat: 'mal-formee' };
    const address = resoudrePrefixe(citation.prefixe, repo.config);
    if (address.nature === 'inconnue') return { citation, etat: 'prefixe-inconnu' };

    const citedRepo = address.nature === 'projet' ? null : address.repo;
    const specification = address.nature === 'projet' ? repo : cites.get(citation.prefixe);
    const lu = isRead(specification);
    return {
      citation,
      repo: citedRepo,
      ...etatDeCible(citation, lu ? findTarget(specification, citation.id) : undefined, { lu }),
    };
  }
}

/**
 * The state of a citation against its target alone, as read in the cited
 * specification — for whoever has read the target themselves, an interface for
 * instance, and must say what the check says.
 *
 * `target` is the cited rule or decision, `null` if it cannot be found;
 * `lu: false` says the cited specification could not be read.
 *
 * @param {{ cadrage: string }} citation a citation parsed by `lireCitation`
 * @param {{ statut?: string, modifie_par?: string[] } | null | undefined} target
 * @param {{ lu?: boolean }} [options]
 * @returns {{ etat: 'a-jour' | 'perimee' | 'abrogee' | 'absente' | 'non-verifiee', recents?: string[], cadrage?: string | null }}
 */
export function etatDeCible(citation, target, { lu = true } = {}) {
  if (!lu) return { etat: 'non-verifiee' };
  if (!target) return { etat: 'absente' };
  const modifiedBy = Array.isArray(target.modifie_par) ? target.modifie_par : [];
  if (target.statut === 'abroge') return { etat: 'abrogee', cadrage: modifiedBy.at(-1) ?? null };
  const recents = modifiedBy.filter((c) => comparerCadrages(c, citation.cadrage) > 0);
  return recents.length ? { etat: 'perimee', recents } : { etat: 'a-jour' };
}

/**
 * The warnings of the specification's citations, and of its declaration of
 * cited specifications — RG-citation-signalee-chez-le-citant.
 *
 * @param {{ config?: object, rules: Map, decisions?: Map }} repo
 * @param {{ cites?: ReadonlyMap<string, object | null> }} [options]
 */
export function verifierCitations(repo, options = {}) {
  const anomalies = [...referentielsCites(repo.config).anomalies];
  for (const e of etatDesCitations(repo, options)) {
    const base = { nature: e.nature, source: e.source };
    const cited = { ...base, citation: e.texte };
    switch (e.etat) {
      case 'mal-formee':
        anomalies.push(createWarning('citation-mal-formee', { ...base, texte: e.texte }));
        break;
      case 'prefixe-inconnu':
        anomalies.push(createWarning('citation-prefixe-inconnu', { ...cited, prefixe: e.citation.prefixe }));
        break;
      case 'non-verifiee':
        anomalies.push(createWarning('citation-non-verifiee', { ...cited, repo: e.repo }));
        break;
      case 'absente':
        anomalies.push(createWarning('citation-absente', { ...cited, repo: e.repo }));
        break;
      case 'abrogee':
        anomalies.push(createWarning('citation-abrogee', { ...cited, repo: e.repo, cadrage: e.cadrage }));
        break;
      case 'perimee':
        anomalies.push(
          createWarning('citation-perimee', { ...cited, repo: e.repo, notee: e.citation.cadrage, recents: e.recents }),
        );
        break;
    }
  }
  return anomalies;
}
