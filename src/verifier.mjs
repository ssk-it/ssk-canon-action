// Vérification d'intégrité d'un référentiel, sans dépendance au système de
// fichiers.
//
// Ce module s'exécute dans l'Action, qui lit un répertoire, et dans un
// navigateur, qui lit un dépôt distant. Les règles du format vivent ainsi à un
// seul endroit : les dupliquer garantirait qu'elles divergent, et le produit
// sait déjà ce que coûte une seconde implémentation.
//
// Ce qu'il attrape, que le format seul ne peut pas garantir : références
// croisées, énoncés manquants, cohérence des statuts.

import { erreur, avertissement, versAnomalie, enTexte, langueDuDepot } from './anomalies.mjs';
import { extractEnonces } from './format.mjs';
import { checkIdentite } from './identite.mjs';
import { resoudreNoms, verifierDossiersDeclares } from './noms.mjs';

// L'identité visuelle relève des mêmes règles partagées : l'application les
// reprend d'ici, sans avoir à connaître le découpage interne du paquet.
export * from './identite.mjs';
export * from './noms.mjs';
// Les anomalies et leurs messages, pour qui les dit dans sa langue —
// RG-anomalies-codees.
export { LANGUES, formaterAnomalie, enTexte, langueDuDepot } from './anomalies.mjs';

const OPERATIONS = new Set(['cree', 'modifie', 'abroge', 'touche']);
const STATUTS_REGLE = new Set(['actif', 'abroge']);

/**
 * Les natures qu'un impact peut viser, et le mot qui les nomme dans un message.
 *
 * Un impact désigne ce qu'il change : une règle de gestion, une décision
 * d'architecture, ou un document d'architecture. Les trois suivent le même
 * régime — mêmes opérations, même exigence d'énoncé, même projection — et ne se
 * distinguent que par le répertoire qui les porte et la façon de les nommer.
 *
 * Les traiter par une table plutôt que par des branches successives est ce qui
 * garantit qu'une nature ajoutée demain hérite des contrôles sans qu'on ait à
 * penser à chacun.
 */
export const CIBLES = [
  { champ: 'regle', collection: 'rules', libelle: 'règle' },
  { champ: 'adr', collection: 'decisions', libelle: "décision d'architecture" },
  { champ: 'architecture', collection: 'architecture', libelle: "document d'architecture" },
];

/**
 * Un préfixe de projet, tel qu'il peut précéder un identifiant.
 *
 * Ni tiret ni chiffre en tête, pour une même raison : le préfixe est séparé de
 * l'identifiant par un tiret, et l'identifiant commence par une année. Un
 * préfixe « PRM-CO » ou « 2026 » rendrait « PRM-CO-2026-001 » et
 * « 2026-2026-001 » impossibles à découper sans deviner — et deviner, ici,
 * mènerait au mauvais cadrage.
 */
const FORME_PREFIXE = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Ce qu'un impact vise, quelle que soit la nature.
 *
 * Un impact qui n'en désigne aucune est une erreur de saisie, distinguée d'une
 * cible inconnue : « aucune cible » envoie relire le champ, « cible inconnue »
 * envoie vérifier un identifiant.
 */
export function cibleDe(impact) {
  for (const c of CIBLES) if (impact[c.champ] !== undefined) return { ...c, id: impact[c.champ] };
  return null;
}

/**
 * Vérifie un référentiel déjà chargé.
 *
 * Séparé de `check()` pour ne dépendre d'aucun système de fichiers : la même
 * fonction s'exécute dans l'Action, qui lit un répertoire, et dans le navigateur,
 * qui lit un dépôt distant. Les règles vivent ainsi à un seul endroit — les
 * dupliquer garantirait qu'elles divergent, et le produit sait déjà ce que coûte
 * une seconde implémentation du format.
 *
 * `livres` porte les identifiants des cadrages livrés. Un cadrage ne déclare pas
 * son statut — il se déduit de l'état du dépôt, et seul l'appelant sait le lire :
 * la branche principale pour l'Action, la plateforme pour le navigateur. Sans cet
 * ensemble, aucun cadrage n'est tenu pour livré, ce qui est le cas d'un
 * référentiel qu'on vérifie hors de tout dépôt.
 *
 * @param {{domains: Map, features: Map, rules: Map, cadrages: Map, errors: string[]}} repo
 * @param {{ignorerIndexDerives?: boolean, livres?: Set<string>}} [options]
 */
export function checkRepo(repo, { ignorerIndexDerives = false, livres = new Set() } = {}) {
  const { domains, features, rules, cadrages } = repo;
  // Les erreurs de chargement arrivent codées quand le chargement les code, en
  // texte sinon : un texte se rend tel quel, faute de pouvoir le dire autrement.
  const problems = repo.anomalies ?? repo.errors ?? [];
  const anomalies = problems.map((p) => versAnomalie(p));
  const signaler = (...a) => anomalies.push(...a.map((x) => versAnomalie(x)));
  const avertir = (...a) => anomalies.push(...a.map((x) => versAnomalie(x, 'avertissement')));

  // La langue du dépôt — RG-langue-du-depot. Mal déclarée, elle se signale ici.
  signaler(...langueDuDepot(repo.config).anomalies);

  // --- configuration du projet ---
  const prefixe = repo.config?.projet?.prefixe;
  if (prefixe !== undefined && !FORME_PREFIXE.test(String(prefixe)))
    signaler(erreur('prefixe-invalide', { prefixe: String(prefixe) }));

  // Les noms déclarés — RG-noms-declares. Une entrée fautive a déjà été
  // écartée à la lecture ; c'est ici qu'elle se dit. Les chemins, quand
  // l'appelant les connaît, révèlent un dossier renommé sans ses fichiers.
  const noms = resoudreNoms(repo.config);
  signaler(...noms.erreurs);
  if (repo.chemins) signaler(...verifierDossiersDeclares(noms, repo.chemins));

  /** Un cadrage est livré si la branche principale le porte, et rien d'autre. */
  const estLivre = (id) => livres.has(id);

  // --- identifiants et cohérence de forme ---
  for (const [id, d] of domains)
    if (!id) signaler(erreur('identifiant-manquant', { chemin: d.path }));

  for (const [id, f] of features) {
    if (!id) signaler(erreur('identifiant-manquant', { chemin: f.path }));
    if (!f.domaines?.length) avertir(avertissement('fonctionnalite-sans-domaine', { id }));
    for (const d of f.domaines ?? [])
      if (!domains.has(d))
        signaler(erreur('domaine-inconnu', { source: 'fonctionnalite', id, domaine: d }));
  }

  for (const [id, r] of rules) {
    if (!id) signaler(erreur('identifiant-manquant', { chemin: r.path }));
    if (!STATUTS_REGLE.has(r.statut))
      signaler(erreur('statut-regle-invalide', { regle: id, statut: r.statut }));
    // Bloquant, et non un simple avertissement : la navigation du référentiel
    // passe par les domaines puis les fonctionnalités. Une règle rattachée à
    // rien est introuvable — elle est livrée sans exister pour ses lecteurs.
    if (!r.fonctionnalites?.length)
      signaler(erreur('regle-sans-fonctionnalite', { regle: id }));
    for (const f of r.fonctionnalites ?? [])
      if (!features.has(f)) signaler(erreur('fonctionnalite-inconnue', { regle: id, fonctionnalite: f }));

    // les index dérivés doivent pointer des cadrages réels
    if (!ignorerIndexDerives) {
      if (r.cree_par && !cadrages.has(r.cree_par))
        signaler(erreur('cree-par-inconnu', { regle: id, cadrage: r.cree_par }));
      for (const c of r.modifie_par ?? [])
        if (!cadrages.has(c)) signaler(erreur('modifie-par-inconnu', { regle: id, cadrage: c }));
    }
  }

  // --- cadrages ---
  for (const [id, c] of cadrages) {
    // Un statut déclaré dans le fichier serait une seconde source pour un fait
    // que le dépôt établit déjà, et c'est cette duplication qui a divergé.
    if (c.statut !== undefined)
      signaler(erreur('statut-declare', { cadrage: id }));
    for (const d of c.domaines ?? [])
      if (!domains.has(d)) signaler(erreur('domaine-inconnu', { source: 'cadrage', id, domaine: d }));

    // Deux provenances possibles : un cadrage lu depuis un fichier porte son
    // corps brut, un cadrage déjà parsé porte ses énoncés indexés. Accepter les
    // deux évite à l'appelant de reconstruire un corps qu'il a déjà découpé.
    const enonces = c.enonces instanceof Map ? c.enonces : extractEnonces(c.body ?? '');
    const vus = new Set();

    for (const impact of c.impacts ?? []) {
      const { operation } = impact;
      const cible = cibleDe(impact);

      // Sans cible, il n'y a rien à contrôler ensuite : signaler et passer,
      // plutôt que de dérouler des messages qui parleraient tous de « undefined ».
      if (!cible) {
        signaler(erreur('impact-sans-cible', { cadrage: id, champs: CIBLES.map((c) => c.champ) }));
        continue;
      }

      const { id: nom, champ: nature, collection } = cible;
      if (!OPERATIONS.has(operation))
        signaler(erreur('operation-invalide', { cadrage: id, operation, cible: nom }));
      if (vus.has(nom)) signaler(erreur('impact-en-double', { cadrage: id, nature, cible: nom }));
      vus.add(nom);

      // une cible créée par ce cadrage n'existe pas encore si le cadrage n'est
      // pas livré : on ne l'exige dans son répertoire qu'après livraison
      const doitExister = operation !== 'cree' || estLivre(id);
      if (doitExister && !repo[collection]?.has(nom))
        signaler(erreur('cible-inconnue', { cadrage: id, nature, cible: nom }));

      // c'est l'énoncé qui porte le texte à écrire : sans lui, la propagation
      // n'a rien à appliquer
      if ((operation === 'cree' || operation === 'modifie') && !enonces.has(nom))
        signaler(erreur('enonce-manquant', { cadrage: id, operation, cible: nom }));
    }

    for (const nom of enonces.keys())
      if (!vus.has(nom))
        avertir(avertissement('enonce-sans-impact', { cadrage: id, cible: nom }));

    for (const a of c.attachments ?? []) {
      if (!/^[0-9a-f]{64}$/.test(a.sha256 ?? ''))
        signaler(erreur('piece-jointe-empreinte', { cadrage: id, nom: a.nom }));
    }
  }

  // --- les index dérivés doivent refléter les impacts des cadrages livrés ---
  // cree_par / modifie_par sont écrits par la propagation, jamais à la main :
  // une divergence signale soit une édition manuelle, soit une propagation ratée.
  const attendu = new Map();
  const cadragesLivres = [...cadrages.values()]
    .filter((c) => estLivre(c.id))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const c of cadragesLivres)
    for (const impact of c.impacts ?? []) {
      const cible = cibleDe(impact);
      if (!cible) continue;
      if (!attendu.has(cible.id))
        attendu.set(cible.id, { cree_par: null, modifie_par: [] });
      const e = attendu.get(cible.id);
      if (impact.operation === 'cree') e.cree_par = c.id;
      else if (impact.operation === 'modifie' || impact.operation === 'abroge')
        e.modifie_par.push(c.id);
    }

  // Les trois natures partagent ce contrôle : un index dérivé faux est le même
  // défaut, qu'il porte sur une règle ou sur un document d'architecture.
  for (const { collection, champ: nature } of ignorerIndexDerives ? [] : CIBLES)
    for (const [id, r] of repo[collection] ?? []) {
      const e = attendu.get(id);
      if (!e) {
        avertir(avertissement('cible-jamais-creee', { nature, id }));
        continue;
      }
      if ((r.cree_par ?? null) !== e.cree_par)
        signaler(
          erreur('cree-par-diverge', { nature, id, declare: r.cree_par ?? null, derive: e.cree_par }),
        );
      const declare = r.modifie_par ?? [];
      if (JSON.stringify(declare) !== JSON.stringify(e.modifie_par))
        signaler(erreur('modifie-par-diverge', { nature, id, declare, derive: e.modifie_par }));
    }

  // --- cohérence des règles abrogées ---
  for (const [id, r] of rules) {
    if (r.statut !== 'abroge') continue;
    const dernier = (r.modifie_par ?? []).at(-1);
    if (!dernier) {
      avertir(avertissement('abrogee-sans-cadrage', { regle: id }));
      continue;
    }
    if (!estLivre(dernier))
      signaler(erreur('abrogee-par-non-livre', { regle: id, cadrage: dernier }));
  }

  // une règle abrogée ne devrait plus être impactée par un cadrage en cours
  for (const [id, c] of cadrages) {
    if (estLivre(id)) continue;
    for (const impact of c.impacts ?? []) {
      const cible = cibleDe(impact);
      if (!cible) continue;
      const r = repo[cible.collection]?.get(cible.id);
      if (r?.statut === 'abroge' && impact.operation !== 'touche')
        avertir(avertissement('opere-sur-abrogee', { cadrage: id, cible: cible.id }));
    }
  }

  // --- identité visuelle ---
  // Absente de ce qu'on passe, elle n'est pas contrôlée : un référentiel chargé
  // sans son arborescence reste vérifiable pour le reste.
  if (repo.identite) {
    const identite = checkIdentite(repo.identite, noms.dossiers.identite);
    anomalies.push(...identite.anomalies);
  }

  // La forme textuelle d'hier, en français, mot pour mot : un consommateur qui
  // ne lit pas encore les codes ne voit rien changer.
  const { errors, warnings } = enTexte(anomalies);
  return {
    errors,
    warnings,
    anomalies,
    counts: {
      domaines: domains.size,
      fonctionnalites: features.size,
      regles: rules.size,
      cadrages: cadrages.size,
    },
  };
}
