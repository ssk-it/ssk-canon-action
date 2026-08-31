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
const STATUTS = new Set(['brouillon', 'en_relecture', 'validee', 'livree']);
const STATUTS_REGLE = new Set(['actif', 'abroge']);

/**
 * Vérifie un référentiel déjà chargé.
 *
 * Séparé de `check()` pour ne dépendre d'aucun système de fichiers : la même
 * fonction s'exécute dans l'Action, qui lit un répertoire, et dans le navigateur,
 * qui lit un dépôt distant. Les règles vivent ainsi à un seul endroit — les
 * dupliquer garantirait qu'elles divergent, et le produit sait déjà ce que coûte
 * une seconde implémentation du format.
 *
 * @param {{domains: Map, features: Map, rules: Map, cadrages: Map, errors: string[]}} repo
 */
export function checkRepo(repo, { ignorerIndexDerives = false } = {}) {
  const { domains, features, rules, cadrages, errors: problems } = repo;
  const errors = [...problems];
  const warnings = [];

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
    if (!STATUTS.has(c.statut)) errors.push(`cadrage ${id} : statut invalide « ${c.statut} »`);
    for (const d of c.domaines ?? [])
      if (!domains.has(d)) errors.push(`cadrage ${id} → domaine inconnu : ${d}`);

    const enonces = extractEnonces(c.body);
    const vus = new Set();

    for (const impact of c.impacts ?? []) {
      const { regle, operation } = impact;
      if (!OPERATIONS.has(operation))
        errors.push(`cadrage ${id} → opération invalide « ${operation} » sur ${regle}`);
      if (vus.has(regle))
        errors.push(`cadrage ${id} → impact en double sur la règle ${regle}`);
      vus.add(regle);

      // une règle créée par ce cadrage n'existe pas encore si le cadrage n'est
      // pas livré : on ne l'exige dans rules/ qu'après livraison
      const doitExister = operation !== 'cree' || c.statut === 'livree';
      if (doitExister && !rules.has(regle))
        errors.push(`cadrage ${id} → règle inconnue : ${regle}`);

      // c'est l'énoncé qui porte le texte à écrire : sans lui, la propagation
      // n'a rien à appliquer
      if ((operation === 'cree' || operation === 'modifie') && !enonces.has(regle))
        errors.push(`cadrage ${id} → impact « ${operation} » sur ${regle} sans énoncé correspondant dans « ## Énoncés »`);
    }

    for (const regle of enonces.keys())
      if (!vus.has(regle))
        warnings.push(`cadrage ${id} : énoncé pour ${regle} sans impact déclaré`);

    for (const a of c.attachments ?? []) {
      if (!/^[0-9a-f]{64}$/.test(a.sha256 ?? ''))
        errors.push(`cadrage ${id} → pièce jointe « ${a.nom} » : sha256 absent ou mal formé`);
    }
  }

  // --- les index dérivés doivent refléter les impacts des cadrages livrés ---
  // cree_par / modifie_par sont écrits par la propagation, jamais à la main :
  // une divergence signale soit une édition manuelle, soit une propagation ratée.
  const attendu = new Map();
  const livres = [...cadrages.values()]
    .filter((c) => c.statut === 'livree')
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  for (const c of livres)
    for (const impact of c.impacts ?? []) {
      if (!attendu.has(impact.regle))
        attendu.set(impact.regle, { cree_par: null, modifie_par: [] });
      const e = attendu.get(impact.regle);
      if (impact.operation === 'cree') e.cree_par = c.id;
      else if (impact.operation === 'modifie' || impact.operation === 'abroge')
        e.modifie_par.push(c.id);
    }

  for (const [id, r] of ignorerIndexDerives ? [] : rules) {
    const e = attendu.get(id);
    if (!e) {
      warnings.push(`règle ${id} : aucun cadrage livré ne la crée`);
      continue;
    }
    if ((r.cree_par ?? null) !== e.cree_par)
      errors.push(
        `règle ${id} : cree_par vaut « ${r.cree_par ?? '—'} » mais les impacts livrés disent « ${e.cree_par ?? '—'} »`
      );
    const declare = JSON.stringify(r.modifie_par ?? []);
    const derive = JSON.stringify(e.modifie_par);
    if (declare !== derive)
      errors.push(
        `règle ${id} : modifie_par vaut ${declare} mais les impacts livrés disent ${derive}`
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
    if (cadrages.get(dernier)?.statut !== 'livree')
      errors.push(`règle ${id} : abrogée par ${dernier}, qui n'est pas livré`);
  }

  // une règle abrogée ne devrait plus être impactée par un cadrage en cours
  for (const [id, c] of cadrages) {
    if (c.statut === 'livree') continue;
    for (const impact of c.impacts ?? []) {
      const r = rules.get(impact.regle);
      if (r?.statut === 'abroge' && impact.operation !== 'touche')
        warnings.push(`cadrage ${id} : opère sur ${impact.regle}, qui est abrogée`);
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
