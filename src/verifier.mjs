// Integrity check of a specification, with no file-system dependency.
//
// This module runs in the Action, which reads a directory, and in a browser,
// which reads a remote repo. The format's rules thus live in a single place:
// duplicating them would guarantee that they diverge, and the product already
// knows what a second implementation costs.
//
// What it catches, that the format alone cannot guarantee: cross references,
// missing statements, consistency of statuses.

import { createError, createWarning, toAnomaly, enTexte, langueDuDepot } from './anomalies.mjs';
import { extractEnonces } from './format.mjs';
import { checkIdentite } from './identite.mjs';
import { resoudreNoms, verifierDossiersDeclares } from './noms.mjs';
import { FORME_PREFIXE, verifierCitations } from './citations.mjs';

// The visual identity falls under the same shared rules: the application takes
// them from here, without having to know the package's internal layout.
export * from './identite.mjs';
export * from './noms.mjs';
// Citing another specification — RG-regle-du-socle-citee.
export * from './citations.mjs';
// Anomalies and their messages, for whoever says them in their language —
// RG-anomalies-codees.
export { LANGUES, formaterAnomalie, enTexte, langueDuDepot } from './anomalies.mjs';

const OPERATIONS = new Set(['cree', 'modifie', 'abroge', 'touche']);
const RULE_STATUSES = new Set(['actif', 'abroge']);

/**
 * The kinds an impact can target, and the word that names them in a message.
 *
 * An impact designates what it changes: a business rule, an architecture
 * decision, or an architecture document. All three follow the same regime —
 * same operations, same statement requirement, same projection — and differ
 * only by the directory that holds them and the way they are named.
 *
 * Handling them through a table rather than successive branches is what
 * guarantees that a kind added tomorrow inherits the checks without having to
 * think of each one.
 */
export const CIBLES = [
  { champ: 'regle', collection: 'rules', libelle: 'règle' },
  { champ: 'adr', collection: 'decisions', libelle: "décision d'architecture" },
  { champ: 'architecture', collection: 'architecture', libelle: "document d'architecture" },
];

/**
 * What an impact targets, whatever the kind.
 *
 * An impact that designates none is an input error, distinguished from an
 * unknown target: « no target » sends one to reread the field, « unknown
 * target » sends one to check an identifier.
 */
export function cibleDe(impact) {
  for (const t of CIBLES) if (impact[t.champ] !== undefined) return { ...t, id: impact[t.champ] };
  return null;
}

/**
 * Checks an already loaded specification.
 *
 * Separate from `check()` so as to depend on no file system: the same function
 * runs in the Action, which reads a directory, and in the browser, which reads
 * a remote repo. The rules thus live in a single place — duplicating them
 * would guarantee that they diverge, and the product already knows what a
 * second implementation of the format costs.
 *
 * `livres` carries the identifiers of delivered scopings. A scoping does not
 * declare its status — it is deduced from the repo's state, and only the
 * caller knows how to read it: the main branch for the Action, the platform
 * for the browser. Without this set, no scoping is considered delivered, which
 * is the case of a specification checked outside any repo.
 *
 * @param {{domains: Map, features: Map, rules: Map, cadrages: Map, errors: string[]}} repo
 * `cites` carries, by prefix, the specifications this one cites, already
 * loaded, or `null` for those that could not be. Only the caller knows how to
 * read them — a clone for the Action, the platform for the browser — and what
 * it has not read is reported as unchecked.
 *
 * @param {{ignorerIndexDerives?: boolean, livres?: Set<string>, cites?: Map<string, object | null>}} [options]
 */
export function checkRepo(repo, { ignorerIndexDerives = false, livres = new Set(), cites = new Map() } = {}) {
  const { domains, features, rules, cadrages: scopings } = repo;
  // Loading errors arrive coded when loading codes them, as text otherwise: a
  // text is rendered as is, for lack of a way to say it otherwise.
  const problems = repo.anomalies ?? repo.errors ?? [];
  const anomalies = problems.map((p) => toAnomaly(p));
  const report = (...a) => anomalies.push(...a.map((x) => toAnomaly(x)));
  const warn = (...a) => anomalies.push(...a.map((x) => toAnomaly(x, 'avertissement')));

  // The repo's language — RG-langue-du-depot. Badly declared, it is reported here.
  report(...langueDuDepot(repo.config).anomalies);

  // --- project configuration ---
  const prefix = repo.config?.projet?.prefixe;
  if (prefix !== undefined && !FORME_PREFIXE.test(String(prefix)))
    report(createError('prefixe-invalide', { prefixe: String(prefix) }));

  // Declared names — RG-noms-declares. A faulty entry has already been set
  // aside on reading; this is where it is reported. The paths, when the caller
  // knows them, reveal a folder renamed without its files.
  const names = resoudreNoms(repo.config);
  report(...names.erreurs);
  if (repo.chemins) report(...verifierDossiersDeclares(names, repo.chemins));

  // Citations of other specifications — RG-citation-signalee-chez-le-citant.
  // Warnings only: a target changes in another repo, and blocking would make
  // pull requests fail here that have nothing to do with it.
  anomalies.push(...verifierCitations(repo, { cites }));

  /** A scoping is delivered if the main branch carries it, and nothing else. */
  const isDelivered = (id) => livres.has(id);

  // --- identifiers and consistency of form ---
  for (const [id, d] of domains)
    if (!id) report(createError('identifiant-manquant', { chemin: d.path }));

  for (const [id, f] of features) {
    if (!id) report(createError('identifiant-manquant', { chemin: f.path }));
    if (!f.domaines?.length) warn(createWarning('fonctionnalite-sans-domaine', { id }));
    for (const d of f.domaines ?? [])
      if (!domains.has(d))
        report(createError('domaine-inconnu', { source: 'fonctionnalite', id, domaine: d }));
  }

  for (const [id, r] of rules) {
    if (!id) report(createError('identifiant-manquant', { chemin: r.path }));
    if (!RULE_STATUSES.has(r.statut))
      report(createError('statut-regle-invalide', { regle: id, statut: r.statut }));
    // Blocking, and not a mere warning: navigating the specification goes
    // through domains then features. A rule linked to nothing cannot be found —
    // it is delivered without existing for its readers.
    if (!r.fonctionnalites?.length)
      report(createError('regle-sans-fonctionnalite', { regle: id }));
    for (const f of r.fonctionnalites ?? [])
      if (!features.has(f)) report(createError('fonctionnalite-inconnue', { regle: id, fonctionnalite: f }));

    // derived indexes must point to real scopings
    if (!ignorerIndexDerives) {
      if (r.cree_par && !scopings.has(r.cree_par))
        report(createError('cree-par-inconnu', { regle: id, cadrage: r.cree_par }));
      for (const c of r.modifie_par ?? [])
        if (!scopings.has(c)) report(createError('modifie-par-inconnu', { regle: id, cadrage: c }));
    }
  }

  // --- scopings ---
  for (const [id, c] of scopings) {
    // A status declared in the file would be a second source for a fact the
    // repo already establishes, and it is this duplication that diverged.
    if (c.statut !== undefined)
      report(createError('statut-declare', { cadrage: id }));
    for (const d of c.domaines ?? [])
      if (!domains.has(d)) report(createError('domaine-inconnu', { source: 'cadrage', id, domaine: d }));

    // Two possible origins: a scoping read from a file carries its raw body, a
    // scoping already parsed carries its indexed statements. Accepting both
    // spares the caller from rebuilding a body it has already split.
    const statements = c.enonces instanceof Map ? c.enonces : extractEnonces(c.body ?? '');
    const seen = new Set();

    for (const impact of c.impacts ?? []) {
      const { operation } = impact;
      const target = cibleDe(impact);

      // Without a target, there is nothing to check next: report and move on,
      // rather than unrolling messages that would all speak of « undefined ».
      if (!target) {
        report(createError('impact-sans-cible', { cadrage: id, champs: CIBLES.map((t) => t.champ) }));
        continue;
      }

      const { id: name, champ: kind, collection } = target;
      if (!OPERATIONS.has(operation))
        report(createError('operation-invalide', { cadrage: id, operation, cible: name }));
      if (seen.has(name)) report(createError('impact-en-double', { cadrage: id, nature: kind, cible: name }));
      seen.add(name);

      // a target created by this scoping does not exist yet if the scoping is
      // not delivered: it is required in its directory only after delivery
      const mustExist = operation !== 'cree' || isDelivered(id);
      if (mustExist && !repo[collection]?.has(name))
        report(createError('cible-inconnue', { cadrage: id, nature: kind, cible: name }));

      // the statement carries the text to write: without it, the propagation
      // has nothing to apply
      if ((operation === 'cree' || operation === 'modifie') && !statements.has(name))
        report(createError('enonce-manquant', { cadrage: id, operation, cible: name }));
    }

    for (const name of statements.keys())
      if (!seen.has(name))
        warn(createWarning('enonce-sans-impact', { cadrage: id, cible: name }));

    for (const a of c.attachments ?? []) {
      if (!/^[0-9a-f]{64}$/.test(a.sha256 ?? ''))
        report(createError('piece-jointe-empreinte', { cadrage: id, nom: a.nom }));
    }
  }

  // --- derived indexes must reflect the impacts of delivered scopings ---
  // cree_par / modifie_par are written by the propagation, never by hand: a
  // divergence signals either a manual edit or a failed propagation.
  const expected = new Map();
  const deliveredScopings = [...scopings.values()]
    .filter((c) => isDelivered(c.id))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const c of deliveredScopings)
    for (const impact of c.impacts ?? []) {
      const target = cibleDe(impact);
      if (!target) continue;
      if (!expected.has(target.id))
        expected.set(target.id, { createdBy: null, modifiedBy: [] });
      const e = expected.get(target.id);
      if (impact.operation === 'cree') e.createdBy = c.id;
      else if (impact.operation === 'modifie' || impact.operation === 'abroge')
        e.modifiedBy.push(c.id);
    }

  // The three kinds share this check: a wrong derived index is the same
  // defect, whether it concerns a rule or an architecture document.
  for (const { collection, champ: kind } of ignorerIndexDerives ? [] : CIBLES)
    for (const [id, r] of repo[collection] ?? []) {
      const e = expected.get(id);
      if (!e) {
        warn(createWarning('cible-jamais-creee', { nature: kind, id }));
        continue;
      }
      if ((r.cree_par ?? null) !== e.createdBy)
        report(
          createError('cree-par-diverge', { nature: kind, id, declare: r.cree_par ?? null, derive: e.createdBy }),
        );
      const declared = r.modifie_par ?? [];
      if (JSON.stringify(declared) !== JSON.stringify(e.modifiedBy))
        report(createError('modifie-par-diverge', { nature: kind, id, declare: declared, derive: e.modifiedBy }));
    }

  // --- consistency of repealed rules ---
  for (const [id, r] of rules) {
    if (r.statut !== 'abroge') continue;
    const last = (r.modifie_par ?? []).at(-1);
    if (!last) {
      warn(createWarning('abrogee-sans-cadrage', { regle: id }));
      continue;
    }
    if (!isDelivered(last))
      report(createError('abrogee-par-non-livre', { regle: id, cadrage: last }));
  }

  // a repealed rule should no longer be impacted by an ongoing scoping
  for (const [id, c] of scopings) {
    if (isDelivered(id)) continue;
    for (const impact of c.impacts ?? []) {
      const target = cibleDe(impact);
      if (!target) continue;
      const r = repo[target.collection]?.get(target.id);
      if (r?.statut === 'abroge' && impact.operation !== 'touche')
        warn(createWarning('opere-sur-abrogee', { cadrage: id, cible: target.id }));
    }
  }

  // --- visual identity ---
  // Missing from what is passed, it is not checked: a specification loaded
  // without its tree remains checkable for the rest.
  if (repo.identite) {
    const identity = checkIdentite(repo.identite, names.dossiers.identite);
    anomalies.push(...identity.anomalies);
  }

  // Yesterday's textual form, in French, word for word: a consumer that does
  // not read codes yet sees nothing change.
  const { errors, warnings } = enTexte(anomalies);
  return {
    errors,
    warnings,
    anomalies,
    counts: {
      domaines: domains.size,
      fonctionnalites: features.size,
      regles: rules.size,
      cadrages: scopings.size,
    },
  };
}
