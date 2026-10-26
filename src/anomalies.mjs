// Les anomalies du format, codées — RG-anomalies-codees.
//
// Une anomalie est un code, une gravité et des paramètres ; son message s'en
// déduit, dans chaque langue, par le catalogue de `messages.mjs`. Le message ne
// s'écrit nulle part ailleurs : l'interface et l'automatisation disent ainsi la
// même chose, chacune dans la langue de qui la lit, et une anomalie se
// reconnaît à son code sans qu'on ait à lire son texte.

import { MESSAGES } from './messages.mjs';

/** Les langues dans lesquelles une anomalie se dit. */
export const LANGUES = ['fr', 'en'];

/** La langue d'un dépôt qui n'en déclare pas, et celle de la forme textuelle d'hier. */
export const LANGUE_PAR_DEFAUT = 'fr';

/**
 * @param {string} code un code du catalogue, stable : il ne change jamais de sens
 * @param {Record<string, unknown>} [params] des valeurs du référentiel et du format, jamais traduites
 */
export function erreur(code, params = {}) {
  return { code, gravite: 'erreur', params };
}

/** Comme `erreur`, sans bloquer la livraison. */
export function avertissement(code, params = {}) {
  return { code, gravite: 'avertissement', params };
}

/**
 * Une anomalie, ou un message que l'appelant a déjà rédigé — une erreur de
 * chargement qu'il a reçue en texte. Ce dernier se rend tel quel : la
 * bibliothèque ne sait pas le dire autrement.
 */
export function versAnomalie(x, gravite = 'erreur') {
  return typeof x === 'string' ? { code: 'message', gravite, params: { texte: x } } : x;
}

/**
 * Le message d'une anomalie, dans une langue. Une langue inconnue se lit en
 * français : une langue mal déclarée ne doit pas rendre un rapport illisible.
 */
export function formaterAnomalie(anomalie, langue = LANGUE_PAR_DEFAUT) {
  const l = LANGUES.includes(langue) ? langue : LANGUE_PAR_DEFAUT;
  const message = MESSAGES[l][anomalie.code];
  // Un code hors catalogue est un défaut de la bibliothèque, que ses tests
  // attrapent ; ici, mieux vaut un rapport qui nomme le code qu'un rapport muet.
  if (!message) return `${anomalie.code} ${JSON.stringify(anomalie.params ?? {})}`;
  return message(anomalie.params ?? {}, (a) => formaterAnomalie(a, l));
}

/** Les anomalies en textes, erreurs et avertissements séparés. */
export function enTexte(anomalies, langue = LANGUE_PAR_DEFAUT) {
  const dire = (gravite) =>
    anomalies.filter((a) => a.gravite === gravite).map((a) => formaterAnomalie(a, langue));
  return { errors: dire('erreur'), warnings: dire('avertissement') };
}

/**
 * La langue d'un dépôt, déclarée dans `ssk-canon.yml` — RG-langue-du-depot.
 *
 * Une langue inconnue se signale, et le dépôt se lit en français : une faute de
 * frappe dans un réglage d'affichage ne justifie pas de bloquer une livraison.
 */
export function langueDuDepot(config) {
  const valeur = config?.langue;
  if (valeur === undefined || valeur === null) return { langue: LANGUE_PAR_DEFAUT, anomalies: [] };
  if (LANGUES.includes(valeur)) return { langue: valeur, anomalies: [] };
  return {
    langue: LANGUE_PAR_DEFAUT,
    anomalies: [avertissement('langue-inconnue', { valeur: String(valeur), langues: LANGUES })],
  };
}
