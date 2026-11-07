// The format's anomalies, coded — RG-anomalies-codees.
//
// An anomaly is a code, a severity and parameters; its message derives from
// them, in each language, through the catalogue in `messages.mjs`. The message
// is written nowhere else: the interface and the automation thus say the same
// thing, each in its reader's language, and an anomaly is recognised by its
// code without having to read its text.

import { MESSAGES } from './messages.mjs';

/** The languages an anomaly can be told in. */
export const LANGUES = ['fr', 'en'];

/** The language of a repo that declares none, and that of yesterday's text form. */
export const DEFAULT_LANGUAGE = 'fr';

/**
 * @param {string} code a catalogue code, stable: it never changes meaning
 * @param {Record<string, unknown>} [params] values from the specification and the format, never translated
 */
export function createError(code, params = {}) {
  return { code, gravite: 'erreur', params };
}

/** Like `createError`, without blocking the delivery. */
export function createWarning(code, params = {}) {
  return { code, gravite: 'avertissement', params };
}

/**
 * An anomaly, or a message the caller has already written — a loading error
 * it received as text. The latter is returned as is: the library cannot tell
 * it any other way.
 */
export function toAnomaly(x, severity = 'erreur') {
  return typeof x === 'string' ? { code: 'message', gravite: severity, params: { texte: x } } : x;
}

/**
 * The message of an anomaly, in a language. An unknown language reads as
 * French: a badly declared language must not make a report unreadable.
 */
export function formaterAnomalie(anomaly, language = DEFAULT_LANGUAGE) {
  const l = LANGUES.includes(language) ? language : DEFAULT_LANGUAGE;
  const message = MESSAGES[l][anomaly.code];
  // A code outside the catalogue is a library defect, which its tests catch;
  // here, a report naming the code beats a silent report.
  if (!message) return `${anomaly.code} ${JSON.stringify(anomaly.params ?? {})}`;
  return message(anomaly.params ?? {}, (a) => formaterAnomalie(a, l));
}

/** The anomalies as texts, errors and warnings apart. */
export function enTexte(anomalies, language = DEFAULT_LANGUAGE) {
  const tell = (severity) =>
    anomalies.filter((a) => a.gravite === severity).map((a) => formaterAnomalie(a, language));
  return { errors: tell('erreur'), warnings: tell('avertissement') };
}

/**
 * The language of a repo, declared in `ssk-canon.yml` — RG-langue-du-depot.
 *
 * An unknown language is reported, and the repo reads in French: a typo in a
 * display setting does not justify blocking a delivery.
 */
export function langueDuDepot(config) {
  const value = config?.langue;
  if (value === undefined || value === null) return { langue: DEFAULT_LANGUAGE, anomalies: [] };
  if (LANGUES.includes(value)) return { langue: value, anomalies: [] };
  return {
    langue: DEFAULT_LANGUAGE,
    anomalies: [createWarning('langue-inconnue', { valeur: String(value), langues: LANGUES })],
  };
}
