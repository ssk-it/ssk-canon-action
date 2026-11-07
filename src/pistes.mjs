// Linking a roadmap item, with no file-system dependency.
//
// A roadmap item is an issue of the specification repo, labelled `piste`,
// linked to domains and features by `domaine/<id>` and `fonctionnalite/<id>`
// labels — RG-piste-definition, RG-piste-rattachee. It goes through no pull
// request: it is checked on the issue event, and reported by a comment.
//
// Reading the labels lives here, next to reading the format, for the same
// reason: the Action that checks a roadmap item and the application that
// displays it must read it the same way, and two readings would end up
// diverging.
//
// A discrepancy is a coded anomaly (RG-anomalies-codees); its textual form,
// `ecarts`, is said in the requested language, French by default.

import { createWarning, formaterAnomalie, DEFAULT_LANGUAGE } from './anomalies.mjs';

/** The label that makes an issue a roadmap item. */
export const ETIQUETTE_PISTE = 'piste';

/**
 * The link prefixes, and what they designate in a loaded specification. A
 * table, like the targets of an impact: a link added tomorrow inherits the
 * checks without having to think of each one.
 *
 * `libelle` and `connus` remain for whoever read them: the messages are said
 * through the catalogue (`messages/roadmap-items.mjs`), in each language.
 */
export const RATTACHEMENTS_PISTE = [
  { prefixe: 'domaine/', collection: 'domains', libelle: 'aucun domaine', connus: 'domaines connus' },
  { prefixe: 'fonctionnalite/', collection: 'features', libelle: 'aucune fonctionnalité', connus: 'fonctionnalités connues' },
];

/** The hidden marker used to find the check's comment again. */
export const MARQUEUR_PISTE = '<!-- ssk-canon:piste-rattachee -->';

const labelName = (l) => (typeof l === 'string' ? l : l?.name ?? '');

/**
 * The links carried by labels, in their order.
 *
 * A label unrelated to links is not included; a link label without an
 * identifier is included with an empty identifier, so that it can be
 * reported.
 *
 * @param {ReadonlyArray<string | { name?: string }>} labels
 */
export function lireRattachementsPiste(labels) {
  const out = [];
  for (const l of labels) {
    const name = labelName(l);
    const r = RATTACHEMENTS_PISTE.find((r) => name.startsWith(r.prefixe));
    if (r) out.push({ etiquette: name, collection: r.collection, id: name.slice(r.prefixe.length) });
  }
  return out;
}

/** True when the labels make the issue a roadmap item. */
export function estPiste(labels) {
  return labels.some((l) => labelName(l) === ETIQUETTE_PISTE);
}

/**
 * Checks how a roadmap item is linked to a loaded specification.
 *
 * An issue that is not a roadmap item is not checked. A label that designates
 * nothing does not count as a link: the roadmap item that only has such a
 * label appears nowhere, and that is reported too.
 *
 * Each discrepancy is a coded warning, in `anomalies`; `ecarts` is its textual
 * form, in `language`.
 *
 * @param {ReadonlyArray<string | { name?: string }>} labels
 * @param {{ domains: ReadonlyMap<string, unknown>, features: ReadonlyMap<string, unknown> }} repo
 * @param {string} [language]
 */
export function checkPiste(labels, repo, language = DEFAULT_LANGUAGE) {
  if (!estPiste(labels)) return { piste: false, ecarts: [], anomalies: [] };

  const anomalies = [];
  let linked = false;
  for (const { etiquette, collection, id } of lireRattachementsPiste(labels)) {
    if (!id) anomalies.push(createWarning('etiquette-piste-sans-identifiant', { etiquette }));
    else if (!repo[collection]?.has(id)) {
      const connus = [...(repo[collection]?.keys() ?? [])].sort();
      anomalies.push(createWarning('etiquette-piste-inconnue', { etiquette, collection, connus }));
    } else linked = true;
  }

  if (!linked) anomalies.unshift(createWarning('piste-non-rattachee'));

  return { piste: true, ecarts: anomalies.map((a) => formaterAnomalie(a, language)), anomalies };
}

/** The comment that reports discrepancies, marker first, in `language`. */
export function corpsCommentairePiste(discrepancies, language = DEFAULT_LANGUAGE) {
  const say = (code) => formaterAnomalie({ code, params: {} }, language);
  return [
    MARQUEUR_PISTE,
    say('piste-commentaire-titre'),
    '',
    ...discrepancies.map((d) => `- ${d}`),
    '',
    say('piste-commentaire-regle'),
  ].join('\n');
}

/**
 * What to do with the check's comment, given the issue's comments and the
 * discrepancies found.
 *
 * A single comment, kept up to date: repeating it on each label set would
 * drown the discussion. Only a bot comment that starts with the marker is its
 * own — that of a person quoting it is never taken over.
 *
 * @param {ReadonlyArray<{ id: number, body?: string, user?: { type?: string } }>} comments
 * @param {readonly string[]} discrepancies
 * @param {string} [language] the comment's, which is the repo's
 * @returns {{ action: 'rien' } | { action: 'creer', corps: string }
 *   | { action: 'modifier', id: number, corps: string } | { action: 'supprimer', id: number }}
 */
export function planifierCommentairePiste(comments, discrepancies, language = DEFAULT_LANGUAGE) {
  const existing = comments.find(
    (c) => c.user?.type === 'Bot' && (c.body ?? '').startsWith(MARQUEUR_PISTE),
  );
  if (!discrepancies.length) return existing ? { action: 'supprimer', id: existing.id } : { action: 'rien' };

  const corps = corpsCommentairePiste(discrepancies, language);
  if (!existing) return { action: 'creer', corps };
  if (existing.body === corps) return { action: 'rien' };
  return { action: 'modifier', id: existing.id, corps };
}

/**
 * The link labels a specification expects: one per domain, then one per
 * feature, in identifier order.
 *
 * The identifiers are those the loader read in the frontmatter — the same ones
 * the check accepts. Taking them from file names would create, for a file not
 * named after its identifier, a label the check would reject.
 *
 * @param {{ domains: ReadonlyMap<string, unknown>, features: ReadonlyMap<string, unknown> }} repo
 */
export function etiquettesRattachementPiste(repo) {
  return RATTACHEMENTS_PISTE.flatMap(({ prefixe, collection }) =>
    [...(repo[collection]?.keys() ?? [])]
      .filter(Boolean)
      .sort()
      .map((id) => `${prefixe}${id}`),
  );
}
