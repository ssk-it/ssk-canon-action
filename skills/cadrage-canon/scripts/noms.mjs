// The names of a specification's agreed folders and files —
// RG-noms-declares.
//
// A specification can declare them in `ssk-canon.yml`, to speak its client's
// language and vocabulary: the repo is read on the platform by people who
// never open the application. Each key is optional, and a missing key keeps
// the format's name: a specification that declares nothing reads as before.
//
// This module depends on no file system. The check, the propagation and the
// application resolve the names here, once — two resolutions would end up
// reading two different specifications (RG-parseur-partage).

// Its faults are told as coded anomalies — RG-anomalies-codees —, whose
// message comes from the library's catalogue. Yet the module imports nothing:
// the skills carry a copy of it, without the library. Hence this constructor,
// the same as the one in `anomalies.mjs`.
const createError = (code, params = {}) => ({ code, gravite: 'erreur', params });

/** The format's names, which any undeclared key keeps. */
export const NOMS_PAR_DEFAUT = Object.freeze({
  dossiers: Object.freeze({
    domaines: 'domains',
    fonctionnalites: 'features',
    regles: 'rules',
    cadrages: 'cadrages',
    decisions: 'decisions',
    architecture: 'architecture',
    identite: 'identite',
    decisions_cadrage: 'decisions',
  }),
  fichiers: Object.freeze({
    cadrage: 'cadrage.md',
    pieces_jointes: 'attachments.md',
  }),
});

/**
 * The `dossiers` key that names each entity collection, as loading indexes
 * them.
 */
export const DOSSIER_DE_COLLECTION = Object.freeze({
  domains: 'domaines',
  features: 'fonctionnalites',
  rules: 'regles',
  cadrages: 'cadrages',
  decisions: 'decisions',
  architecture: 'architecture',
});

/**
 * The names that share a same directory, and so must not collide: those at
 * the root, and those in a scoping's folder. The folder of a scoping's
 * decisions can thus bear the name of the architecture decisions' folder,
 * which lives elsewhere.
 */
const NEIGHBOURHOODS = [
  {
    block: 'dossiers',
    keys: ['domaines', 'fonctionnalites', 'regles', 'cadrages', 'decisions', 'architecture', 'identite'],
  },
  { block: 'dossiers', keys: ['decisions_cadrage'], with: { block: 'fichiers', keys: ['cadrage', 'pieces_jointes'] } },
];

const isTable = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The fault of a declared name, or `null` if it is allowed. */
function findNameFault(block, key, value) {
  const p = { bloc: block, cle: key, defaut: NOMS_PAR_DEFAUT[block][key] };
  if (value === null || value === undefined || value === '') return createError('nom-vide', p);
  if (typeof value !== 'string') return createError('nom-non-chaine', p);
  if (value.trim() !== value) return createError('nom-borde-d-espaces', p);
  if (/[/\\]/.test(value)) return createError('nom-chemin', p);
  if (value.startsWith('.')) return createError('nom-commence-par-point', p);
  if (block === 'fichiers' && !value.endsWith('.md')) return createError('nom-fichier-non-markdown', p);
  return null;
}

/**
 * Resolves a specification's names from its configuration.
 *
 * A faulty entry is set aside and takes back the format's name; the rest of
 * the declaration applies. Two names that collide in a same directory are both
 * set aside, for lack of a way to tell which one was meant — a format name
 * that no declaration replaces is never at fault.
 *
 * @param {unknown} config the configuration read from `ssk-canon.yml`, or nothing
 * @returns {{ dossiers: Record<string, string>, fichiers: Record<string, string>, erreurs: object[] }}
 *   `erreurs`: coded anomalies, which `formaterAnomalie` tells in a language
 */
export function resoudreNoms(config) {
  const errors = [];
  const names = {
    dossiers: { ...NOMS_PAR_DEFAUT.dossiers },
    fichiers: { ...NOMS_PAR_DEFAUT.fichiers },
  };
  const declared = new Set();

  for (const block of ['dossiers', 'fichiers']) {
    const declaration = isTable(config) ? config[block] : undefined;
    if (declaration === undefined || declaration === null) continue;
    if (!isTable(declaration)) {
      errors.push(createError('noms-bloc-non-table', { bloc: block }));
      continue;
    }
    for (const [key, value] of Object.entries(declaration)) {
      if (!(key in NOMS_PAR_DEFAUT[block])) {
        errors.push(createError('nom-cle-inconnue', { bloc: block, cle: key, cles: Object.keys(NOMS_PAR_DEFAUT[block]) }));
        continue;
      }
      const fault = findNameFault(block, key, value);
      if (fault) {
        errors.push(fault);
        continue;
      }
      names[block][key] = value;
      if (value !== NOMS_PAR_DEFAUT[block][key]) declared.add(`${block}.${key}`);
    }
  }

  // Setting an entry aside gives it back the format's name, which may in turn
  // collide with another: we start over until nothing collides any more.
  for (let again = true; again; ) {
    again = false;
    for (const neighbourhood of NEIGHBOURHOODS) {
      const entries = [neighbourhood, neighbourhood.with]
        .filter(Boolean)
        .flatMap(({ block, keys }) => keys.map((key) => ({ block, key, name: names[block][key] })));
      // All the faults of a pass are found before setting one aside: setting
      // the first aside would make its twin look innocent.
      const faulty = entries
        .filter(({ block, key }) => declared.has(`${block}.${key}`))
        .map((e) => ({ ...e, others: entries.filter((o) => o.name === e.name && o !== e) }))
        .filter((e) => e.others.length);
      for (const { block, key, name, others } of faulty) {
        errors.push(
          createError('nom-en-double', {
            bloc: block,
            cle: key,
            nom: name,
            autres: others.map((e) => `${e.block}.${e.key}`),
            defaut: NOMS_PAR_DEFAUT[block][key],
          }),
        );
        names[block][key] = NOMS_PAR_DEFAUT[block][key];
        declared.delete(`${block}.${key}`);
        again = true;
      }
    }
  }

  return { ...names, erreurs: errors };
}

/**
 * Reports a declared folder or file that cannot be found, when the one with
 * the format's name still exists in its place.
 *
 * A name is chosen at creation and never changes (RG-chemins-immuables): a
 * declaration that changes without the files moving would silently empty the
 * specification, its entities staying under a name that nothing reads any more.
 *
 * @param {{ dossiers: Record<string, string>, fichiers: Record<string, string> }} names
 * @param {readonly string[]} paths the repo's files, relative to its root, separated by “/”
 * @returns {object[]} coded anomalies, which `formaterAnomalie` tells in a language
 */
export function verifierDossiersDeclares(names, paths) {
  const errors = [];
  const defaults = NOMS_PAR_DEFAUT;
  const contains = (prefix) => paths.some((c) => c.startsWith(prefix));

  for (const [key, name] of Object.entries(names.dossiers)) {
    if (key === 'decisions_cadrage' || name === defaults.dossiers[key]) continue;
    const former = defaults.dossiers[key];
    // The former name may legitimately be borne by another kind.
    if (Object.entries(names.dossiers).some(([k, n]) => k !== key && k !== 'decisions_cadrage' && n === former))
      continue;
    if (!contains(`${name}/`) && contains(`${former}/`))
      errors.push(createError('dossier-declare-introuvable', { cle: key, nom: name, ancien: former }));
  }

  // In each scoping, what still bears the format's name while another one is
  // declared.
  const scopings = `${names.dossiers.cadrages}/`;
  const byScoping = new Map();
  for (const c of paths) {
    if (!c.startsWith(scopings)) continue;
    const [id, ...rest] = c.slice(scopings.length).split('/');
    if (!id || !rest.length) continue;
    if (!byScoping.has(id)) byScoping.set(id, []);
    byScoping.get(id).push(rest.join('/'));
  }

  const inner = [
    { key: 'dossiers.decisions_cadrage', name: `${names.dossiers.decisions_cadrage}/`, former: `${defaults.dossiers.decisions_cadrage}/` },
    { key: 'fichiers.cadrage', name: names.fichiers.cadrage, former: defaults.fichiers.cadrage },
    { key: 'fichiers.pieces_jointes', name: names.fichiers.pieces_jointes, former: defaults.fichiers.pieces_jointes },
  ];
  for (const [id, content] of byScoping)
    for (const { key, name, former } of inner) {
      if (name === former) continue;
      const present = (n) => content.some((c) => (n.endsWith('/') ? c.startsWith(n) : c === n));
      if (!present(name) && present(former))
        errors.push(
          createError('nom-de-cadrage-introuvable', {
            chemin: `${scopings}${id}/${name}`,
            ancien: `${scopings}${id}/${former}`,
            cle: key,
          }),
        );
    }

  return errors;
}
