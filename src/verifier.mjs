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

import { extractEnonces } from './format.mjs';

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
  const { domains, features, rules, cadrages, errors: problems } = repo;
  const errors = [...problems];
  const warnings = [];

  /** Un cadrage est livré si la branche principale le porte, et rien d'autre. */
  const estLivre = (id) => livres.has(id);

  // --- identifiants et cohérence de forme ---
  for (const [id, d] of domains)
    if (!id) errors.push(`${d.path} : identifiant manquant`);

  for (const [id, f] of features) {
    if (!id) errors.push(`${f.path} : identifiant manquant`);
    if (!f.domaines?.length) warnings.push(`fonctionnalité ${id} : rattachée à aucun domaine`);
    for (const d of f.domaines ?? [])
      if (!domains.has(d)) errors.push(`fonctionnalité ${id} → domaine inconnu : ${d}`);
  }

  for (const [id, r] of rules) {
    if (!id) errors.push(`${r.path} : identifiant manquant`);
    if (!STATUTS_REGLE.has(r.statut)) errors.push(`règle ${id} : statut invalide « ${r.statut} »`);
    // Bloquant, et non un simple avertissement : la navigation du référentiel
    // passe par les domaines puis les fonctionnalités. Une règle rattachée à
    // rien est introuvable — elle est livrée sans exister pour ses lecteurs.
    if (!r.fonctionnalites?.length)
      errors.push(`règle ${id} : rattachée à aucune fonctionnalité — introuvable dans le référentiel`);
    for (const f of r.fonctionnalites ?? [])
      if (!features.has(f)) errors.push(`règle ${id} → fonctionnalité inconnue : ${f}`);

    // les index dérivés doivent pointer des cadrages réels
    if (!ignorerIndexDerives) {
      if (r.cree_par && !cadrages.has(r.cree_par))
        errors.push(`règle ${id} → cree_par pointe un cadrage inconnu : ${r.cree_par}`);
      for (const c of r.modifie_par ?? [])
        if (!cadrages.has(c))
          errors.push(`règle ${id} → modifie_par pointe un cadrage inconnu : ${c}`);
    }
  }

  // --- cadrages ---
  for (const [id, c] of cadrages) {
    // Un statut déclaré dans le fichier serait une seconde source pour un fait
    // que le dépôt établit déjà, et c'est cette duplication qui a divergé.
    if (c.statut !== undefined)
      errors.push(`cadrage ${id} : le statut ne se déclare pas, il se déduit de l'état du dépôt`);
    for (const d of c.domaines ?? [])
      if (!domains.has(d)) errors.push(`cadrage ${id} → domaine inconnu : ${d}`);

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
        errors.push(
          `cadrage ${id} → impact sans cible : attendu l'un de ${CIBLES.map((c) => c.champ).join(', ')}`,
        );
        continue;
      }

      const { id: nom, libelle, collection } = cible;
      if (!OPERATIONS.has(operation))
        errors.push(`cadrage ${id} → opération invalide « ${operation} » sur ${nom}`);
      if (vus.has(nom))
        errors.push(`cadrage ${id} → impact en double sur la ${libelle} ${nom}`);
      vus.add(nom);

      // une cible créée par ce cadrage n'existe pas encore si le cadrage n'est
      // pas livré : on ne l'exige dans son répertoire qu'après livraison
      const doitExister = operation !== 'cree' || estLivre(id);
      if (doitExister && !repo[collection]?.has(nom))
        errors.push(`cadrage ${id} → ${libelle} inconnue : ${nom}`);

      // c'est l'énoncé qui porte le texte à écrire : sans lui, la propagation
      // n'a rien à appliquer
      if ((operation === 'cree' || operation === 'modifie') && !enonces.has(nom))
        errors.push(`cadrage ${id} → impact « ${operation} » sur ${nom} sans énoncé correspondant dans « ## Énoncés »`);
    }

    for (const nom of enonces.keys())
      if (!vus.has(nom))
        warnings.push(`cadrage ${id} : énoncé pour ${nom} sans impact déclaré`);

    for (const a of c.attachments ?? []) {
      if (!/^[0-9a-f]{64}$/.test(a.sha256 ?? ''))
        errors.push(`cadrage ${id} → pièce jointe « ${a.nom} » : sha256 absent ou mal formé`);
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
  for (const { collection, libelle } of ignorerIndexDerives ? [] : CIBLES)
    for (const [id, r] of repo[collection] ?? []) {
      const e = attendu.get(id);
      if (!e) {
        warnings.push(`${libelle} ${id} : aucun cadrage livré ne la crée`);
        continue;
      }
      if ((r.cree_par ?? null) !== e.cree_par)
        errors.push(
          `${libelle} ${id} : cree_par vaut « ${r.cree_par ?? '—'} » mais les impacts livrés disent « ${e.cree_par ?? '—'} »`
        );
      const declare = JSON.stringify(r.modifie_par ?? []);
      const derive = JSON.stringify(e.modifie_par);
      if (declare !== derive)
        errors.push(
          `${libelle} ${id} : modifie_par vaut ${declare} mais les impacts livrés disent ${derive}`
        );
    }

  // --- cohérence des règles abrogées ---
  for (const [id, r] of rules) {
    if (r.statut !== 'abroge') continue;
    const dernier = (r.modifie_par ?? []).at(-1);
    if (!dernier) {
      warnings.push(`règle ${id} : abrogée sans cadrage responsable`);
      continue;
    }
    if (!estLivre(dernier))
      errors.push(`règle ${id} : abrogée par ${dernier}, qui n'est pas livré`);
  }

  // une règle abrogée ne devrait plus être impactée par un cadrage en cours
  for (const [id, c] of cadrages) {
    if (estLivre(id)) continue;
    for (const impact of c.impacts ?? []) {
      const cible = cibleDe(impact);
      if (!cible) continue;
      const r = repo[cible.collection]?.get(cible.id);
      if (r?.statut === 'abroge' && impact.operation !== 'touche')
        warnings.push(`cadrage ${id} : opère sur ${cible.id}, qui est abrogée`);
    }
  }

  return {
    errors,
    warnings,
    counts: {
      domaines: domains.size,
      fonctionnalites: features.size,
      regles: rules.size,
      cadrages: cadrages.size,
    },
  };
}
