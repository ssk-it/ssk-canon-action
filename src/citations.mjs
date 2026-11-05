// La citation d'un autre référentiel — RG-regle-du-socle-citee,
// RG-citation-signalee-chez-le-citant, RG-prefixe-projet.
//
// Une règle commune à plusieurs produits vit une fois, dans le référentiel du
// socle qui la réalise ; les autres la citent par un champ `applique`, avec le
// cadrage du socle dont ils ont pris acte, sous un préfixe qu'ils déclarent
// dans `referentiels_cites`. Le socle ne sait pas qui le cite : tout se lit et
// se signale du côté du citant.
//
// Sans dépendance au système de fichiers, comme le reste du format : la
// vérification et l'interface lisent les citations ici, et nulle part ailleurs.
//
// Tout ce qui se signale ici est un avertissement, jamais une erreur. Une cible
// change dans un autre dépôt : bloquer ferait échouer, chez le citant, des
// demandes de fusion qui n'y sont pour rien, au moment où quelqu'un livre
// ailleurs.

import { avertissement } from './anomalies.mjs';

/**
 * Un préfixe de projet, tel qu'il peut précéder un identifiant.
 *
 * Ni tiret ni chiffre en tête, pour une même raison : le préfixe est séparé de
 * l'identifiant par un tiret, et l'identifiant commence par une année. Un
 * préfixe « PRM-CO » ou « 2026 » rendrait « PRM-CO-2026-001 » et
 * « 2026-2026-001 » impossibles à découper sans deviner — et deviner, ici,
 * mènerait au mauvais cadrage.
 */
export const FORME_PREFIXE = /^[A-Za-z][A-Za-z0-9_]*$/;

/** `<préfixe>:<identifiant>@<cadrage>` — le cadrage noté est celui du référentiel cité. */
const FORME_CITATION = /^([A-Za-z][A-Za-z0-9_]*):([^\s:@]+)@(\d{4}-\d+)$/;

/** Un dépôt GitHub, `<propriétaire>/<nom>`. */
const FORME_DEPOT = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Ce qui peut citer, et où le chercher dans un référentiel chargé. */
const SOURCES = [
  { nature: 'regle', collection: 'rules' },
  { nature: 'adr', collection: 'decisions' },
];

/**
 * Une citation lue, ou `null` si elle ne suit pas la forme.
 *
 * @param {unknown} texte
 * @returns {{ prefixe: string, id: string, cadrage: string } | null}
 */
export function lireCitation(texte) {
  if (typeof texte !== 'string') return null;
  const m = FORME_CITATION.exec(texte);
  return m ? { prefixe: m[1], id: m[2], cadrage: m[3] } : null;
}

/**
 * Compare deux identifiants de cadrage, par année puis par numéro.
 *
 * Non par texte : « 2026-1000 » viendrait avant « 2026-999 », et une
 * modification récente passerait pour ancienne.
 */
export function comparerCadrages(a, b) {
  const [ya, na] = String(a).split('-').map(Number);
  const [yb, nb] = String(b).split('-').map(Number);
  return ya - yb || na - nb;
}

/** Le préfixe que le projet déclare pour lui-même, s'il est bien formé. */
function prefixeDuProjet(config) {
  const p = config?.projet?.prefixe;
  return p !== undefined && FORME_PREFIXE.test(String(p)) ? String(p) : null;
}

/**
 * Les référentiels que le projet cite, par préfixe, tels que `ssk-canon.yml`
 * les déclare dans `referentiels_cites`.
 *
 * Une entrée fautive s'écarte et s'avertit. Le préfixe est un alias propre au
 * citant : il n'a pas à reprendre celui que le référentiel cité déclare pour
 * lui-même, mais ne peut pas prendre celui du projet, qui désigne déjà le
 * projet.
 *
 * @returns {{ cites: Map<string, string>, anomalies: object[] }}
 */
export function referentielsCites(config) {
  const cites = new Map();
  const anomalies = [];
  const bloc = config?.referentiels_cites;
  if (bloc === undefined || bloc === null) return { cites, anomalies };
  if (!Array.isArray(bloc)) {
    anomalies.push(avertissement('referentiels-cites-mal-forme'));
    return { cites, anomalies };
  }

  const propre = prefixeDuProjet(config);
  bloc.forEach((entree, i) => {
    const { prefixe, repo } = entree && typeof entree === 'object' ? entree : {};
    if (!FORME_PREFIXE.test(String(prefixe ?? '')) || !FORME_DEPOT.test(String(repo ?? '')))
      anomalies.push(avertissement('referentiel-cite-mal-forme', { position: i + 1 }));
    else if (prefixe === propre)
      anomalies.push(avertissement('referentiel-cite-prefixe-du-projet', { prefixe }));
    else if (cites.has(prefixe))
      anomalies.push(avertissement('referentiel-cite-en-double', { prefixe }));
    else cites.set(prefixe, repo);
  });
  return { cites, anomalies };
}

/**
 * Ce que désigne un préfixe : le projet lui-même, un référentiel qu'il cite, ou
 * une adresse inconnue — un identifiant bien formé ne suffit pas.
 *
 * @returns {{ nature: 'projet' } | { nature: 'cite', repo: string } | { nature: 'inconnue' }}
 */
export function resoudrePrefixe(prefixe, config) {
  if (prefixe === prefixeDuProjet(config)) return { nature: 'projet' };
  const repo = referentielsCites(config).cites.get(prefixe);
  return repo ? { nature: 'cite', repo } : { nature: 'inconnue' };
}

/** Une cible dans un référentiel chargé : une règle ou une décision d'architecture. */
function trouver(referentiel, id) {
  return referentiel.rules?.get(id) ?? referentiel.decisions?.get(id) ?? null;
}

/** Un référentiel cité se tient pour lu s'il porte au moins ses règles. */
const estLu = (r) => Boolean(r && typeof r === 'object' && r.rules instanceof Map);

/**
 * L'état de chaque citation du référentiel, dans l'ordre des règles puis des
 * décisions d'architecture.
 *
 * `cites` porte, par préfixe, le référentiel cité déjà chargé, ou `null` s'il
 * n'a pas pu l'être. Un préfixe absent de `cites` n'a pas été lu non plus : la
 * citation est alors non vérifiée, ce qui ne veut pas dire valide.
 *
 * `etat` vaut `a-jour`, `perimee`, `abrogee`, `absente`, `non-verifiee`,
 * `prefixe-inconnu` ou `mal-formee`. `repo` est le dépôt cité, `null` quand le
 * préfixe est celui du projet.
 *
 * @param {{ config?: object, rules: Map, decisions?: Map }} repo
 * @param {{ cites?: ReadonlyMap<string, object | null> }} [options]
 */
export function etatDesCitations(repo, { cites = new Map() } = {}) {
  const etats = [];
  for (const { nature, collection } of SOURCES)
    for (const [source, entite] of repo[collection] ?? []) {
      const applique = entite?.applique;
      if (applique === undefined || applique === null) continue;
      if (!Array.isArray(applique)) {
        etats.push({ source, nature, texte: String(applique), citation: null, etat: 'mal-formee' });
        continue;
      }
      for (const texte of applique) etats.push({ source, nature, texte: String(texte), ...etatDe(texte) });
    }
  return etats;

  function etatDe(texte) {
    const citation = lireCitation(texte);
    if (!citation) return { citation: null, etat: 'mal-formee' };
    const adresse = resoudrePrefixe(citation.prefixe, repo.config);
    if (adresse.nature === 'inconnue') return { citation, etat: 'prefixe-inconnu' };

    const depot = adresse.nature === 'projet' ? null : adresse.repo;
    const referentiel = adresse.nature === 'projet' ? repo : cites.get(citation.prefixe);
    const lu = estLu(referentiel);
    return { citation, repo: depot, ...etatDeCible(citation, lu ? trouver(referentiel, citation.id) : undefined, { lu }) };
  }
}

/**
 * L'état d'une citation face à sa seule cible, telle que lue dans le
 * référentiel cité — pour qui a lu la cible lui-même, une interface par
 * exemple, et doit dire ce que dit la vérification.
 *
 * `cible` est la règle ou la décision citée, `null` si elle est introuvable ;
 * `lu: false` dit que le référentiel cité n'a pas pu être lu.
 *
 * @param {{ cadrage: string }} citation une citation lue par `lireCitation`
 * @param {{ statut?: string, modifie_par?: string[] } | null | undefined} cible
 * @param {{ lu?: boolean }} [options]
 * @returns {{ etat: 'a-jour' | 'perimee' | 'abrogee' | 'absente' | 'non-verifiee', recents?: string[], cadrage?: string | null }}
 */
export function etatDeCible(citation, cible, { lu = true } = {}) {
  if (!lu) return { etat: 'non-verifiee' };
  if (!cible) return { etat: 'absente' };
  const modifie_par = Array.isArray(cible.modifie_par) ? cible.modifie_par : [];
  if (cible.statut === 'abroge') return { etat: 'abrogee', cadrage: modifie_par.at(-1) ?? null };
  const recents = modifie_par.filter((c) => comparerCadrages(c, citation.cadrage) > 0);
  return recents.length ? { etat: 'perimee', recents } : { etat: 'a-jour' };
}

/**
 * Les avertissements des citations du référentiel, et de sa déclaration des
 * référentiels cités — RG-citation-signalee-chez-le-citant.
 *
 * @param {{ config?: object, rules: Map, decisions?: Map }} repo
 * @param {{ cites?: ReadonlyMap<string, object | null> }} [options]
 */
export function verifierCitations(repo, options = {}) {
  const anomalies = [...referentielsCites(repo.config).anomalies];
  for (const e of etatDesCitations(repo, options)) {
    const base = { nature: e.nature, source: e.source };
    const cite = { ...base, citation: e.texte };
    switch (e.etat) {
      case 'mal-formee':
        anomalies.push(avertissement('citation-mal-formee', { ...base, texte: e.texte }));
        break;
      case 'prefixe-inconnu':
        anomalies.push(avertissement('citation-prefixe-inconnu', { ...cite, prefixe: e.citation.prefixe }));
        break;
      case 'non-verifiee':
        anomalies.push(avertissement('citation-non-verifiee', { ...cite, repo: e.repo }));
        break;
      case 'absente':
        anomalies.push(avertissement('citation-absente', { ...cite, repo: e.repo }));
        break;
      case 'abrogee':
        anomalies.push(avertissement('citation-abrogee', { ...cite, repo: e.repo, cadrage: e.cadrage }));
        break;
      case 'perimee':
        anomalies.push(
          avertissement('citation-perimee', { ...cite, repo: e.repo, notee: e.citation.cadrage, recents: e.recents }),
        );
        break;
    }
  }
  return anomalies;
}
