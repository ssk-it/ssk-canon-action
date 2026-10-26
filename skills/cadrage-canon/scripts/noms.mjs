// Les noms des dossiers et des fichiers convenus d'un référentiel —
// RG-noms-declares.
//
// Un référentiel peut les déclarer dans `ssk-canon.yml`, pour parler la langue
// et le lexique de son client : le dépôt est lu sur la plateforme par des gens
// qui n'ouvrent jamais l'application. Chaque clé est facultative, et une clé
// absente garde le nom du format : un référentiel qui ne déclare rien se lit
// comme avant.
//
// Ce module ne dépend d'aucun système de fichiers. La vérification, la
// propagation et l'application résolvent les noms ici, une seule fois — deux
// résolutions finiraient par lire deux référentiels différents
// (RG-parseur-partage).

/** Les noms du format, que garde toute clé non déclarée. */
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
 * La clé de `dossiers` qui nomme chaque collection d'entités, telle que le
 * chargement les indexe.
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
 * Les noms qui partagent un même répertoire, et ne doivent donc pas se
 * confondre : ceux de la racine, et ceux du dossier d'un cadrage. Le dossier
 * des décisions d'un cadrage peut ainsi porter le nom de celui des décisions
 * d'architecture, qui vit ailleurs.
 */
const VOISINAGES = [
  {
    bloc: 'dossiers',
    cles: ['domaines', 'fonctionnalites', 'regles', 'cadrages', 'decisions', 'architecture', 'identite'],
  },
  { bloc: 'dossiers', cles: ['decisions_cadrage'], avec: { bloc: 'fichiers', cles: ['cadrage', 'pieces_jointes'] } },
];

const estTable = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Ce qu'un nom a de fautif, ou `null` s'il est admis. */
function fauteDuNom(bloc, valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return 'nom vide';
  if (typeof valeur !== 'string') return 'attendu une chaîne';
  if (valeur.trim() !== valeur) return 'nom bordé d’espaces';
  if (/[/\\]/.test(valeur)) return 'un nom, non un chemin : sans « / »';
  if (valeur.startsWith('.')) return 'ne commence pas par « . »';
  if (bloc === 'fichiers' && !valeur.endsWith('.md')) return 'un fichier Markdown, finissant par « .md »';
  return null;
}

/**
 * Résout les noms d'un référentiel à partir de sa configuration.
 *
 * Une entrée fautive est écartée et reprend le nom du format ; le reste de la
 * déclaration s'applique. Deux noms qui se confondent dans un même répertoire
 * sont écartés tous les deux, faute de pouvoir dire lequel était voulu — un nom
 * du format qu'aucune déclaration ne remplace n'est jamais en faute.
 *
 * @param {unknown} config la configuration lue de `ssk-canon.yml`, ou rien
 * @returns {{ dossiers: Record<string, string>, fichiers: Record<string, string>, erreurs: string[] }}
 */
export function resoudreNoms(config) {
  const erreurs = [];
  const noms = {
    dossiers: { ...NOMS_PAR_DEFAUT.dossiers },
    fichiers: { ...NOMS_PAR_DEFAUT.fichiers },
  };
  const declares = new Set();

  for (const bloc of ['dossiers', 'fichiers']) {
    const declaration = estTable(config) ? config[bloc] : undefined;
    if (declaration === undefined || declaration === null) continue;
    if (!estTable(declaration)) {
      erreurs.push(`ssk-canon.yml → ${bloc} : attendu une table de noms — les noms du format sont retenus`);
      continue;
    }
    for (const [cle, valeur] of Object.entries(declaration)) {
      if (!(cle in NOMS_PAR_DEFAUT[bloc])) {
        erreurs.push(
          `ssk-canon.yml → ${bloc}.${cle} : clé inconnue — attendu l’une de ` +
            Object.keys(NOMS_PAR_DEFAUT[bloc]).join(', '),
        );
        continue;
      }
      const faute = fauteDuNom(bloc, valeur);
      if (faute) {
        erreurs.push(
          `ssk-canon.yml → ${bloc}.${cle} : ${faute} — « ${NOMS_PAR_DEFAUT[bloc][cle]} » est retenu`,
        );
        continue;
      }
      noms[bloc][cle] = valeur;
      if (valeur !== NOMS_PAR_DEFAUT[bloc][cle]) declares.add(`${bloc}.${cle}`);
    }
  }

  // Écarter une entrée lui rend le nom du format, qui peut à son tour en
  // heurter une autre : on recommence jusqu'à ce que plus rien ne se confonde.
  for (let encore = true; encore; ) {
    encore = false;
    for (const voisinage of VOISINAGES) {
      const entrees = [voisinage, voisinage.avec]
        .filter(Boolean)
        .flatMap(({ bloc, cles }) => cles.map((cle) => ({ bloc, cle, nom: noms[bloc][cle] })));
      // Toutes les fautes d'un passage se constatent avant d'en écarter une :
      // écarter la première ferait passer sa jumelle pour innocente.
      const fautives = entrees
        .filter(({ bloc, cle }) => declares.has(`${bloc}.${cle}`))
        .map((e) => ({ ...e, autres: entrees.filter((o) => o.nom === e.nom && o !== e) }))
        .filter((e) => e.autres.length);
      for (const { bloc, cle, nom, autres } of fautives) {
        erreurs.push(
          `ssk-canon.yml → ${bloc}.${cle} : « ${nom} » est aussi le nom de ` +
            `${autres.map((e) => `${e.bloc}.${e.cle}`).join(', ')} — ` +
            `« ${NOMS_PAR_DEFAUT[bloc][cle]} » est retenu`,
        );
        noms[bloc][cle] = NOMS_PAR_DEFAUT[bloc][cle];
        declares.delete(`${bloc}.${cle}`);
        encore = true;
      }
    }
  }

  return { ...noms, erreurs };
}

/**
 * Signale un dossier ou un fichier déclaré introuvable, quand celui du nom du
 * format existe encore à sa place.
 *
 * Un nom se choisit à la création et ne change plus (RG-chemins-immuables) :
 * une déclaration qui change sans que les fichiers bougent viderait le
 * référentiel sans bruit, ses entités restant sous un nom que plus rien ne lit.
 *
 * @param {{ dossiers: Record<string, string>, fichiers: Record<string, string> }} noms
 * @param {readonly string[]} chemins les fichiers du dépôt, relatifs à sa racine, séparés par « / »
 * @returns {string[]}
 */
export function verifierDossiersDeclares(noms, chemins) {
  const erreurs = [];
  const defaut = NOMS_PAR_DEFAUT;
  const contient = (prefixe) => chemins.some((c) => c.startsWith(prefixe));

  for (const [cle, nom] of Object.entries(noms.dossiers)) {
    if (cle === 'decisions_cadrage' || nom === defaut.dossiers[cle]) continue;
    const ancien = defaut.dossiers[cle];
    // L'ancien nom peut être porté légitimement par une autre nature.
    if (Object.entries(noms.dossiers).some(([c, n]) => c !== cle && c !== 'decisions_cadrage' && n === ancien))
      continue;
    if (!contient(`${nom}/`) && contient(`${ancien}/`))
      erreurs.push(
        `ssk-canon.yml → dossiers.${cle} : « ${nom}/ » est introuvable, alors que « ${ancien}/ » existe — ` +
          `un dossier ne se renomme pas, son nom se choisit à la création`,
      );
  }

  // Dans chaque cadrage, ce qui porte encore le nom du format alors qu'un autre
  // est déclaré.
  const cadrages = `${noms.dossiers.cadrages}/`;
  const parCadrage = new Map();
  for (const c of chemins) {
    if (!c.startsWith(cadrages)) continue;
    const [id, ...reste] = c.slice(cadrages.length).split('/');
    if (!id || !reste.length) continue;
    if (!parCadrage.has(id)) parCadrage.set(id, []);
    parCadrage.get(id).push(reste.join('/'));
  }

  const internes = [
    { cle: 'dossiers.decisions_cadrage', nom: `${noms.dossiers.decisions_cadrage}/`, ancien: `${defaut.dossiers.decisions_cadrage}/` },
    { cle: 'fichiers.cadrage', nom: noms.fichiers.cadrage, ancien: defaut.fichiers.cadrage },
    { cle: 'fichiers.pieces_jointes', nom: noms.fichiers.pieces_jointes, ancien: defaut.fichiers.pieces_jointes },
  ];
  for (const [id, contenu] of parCadrage)
    for (const { cle, nom, ancien } of internes) {
      if (nom === ancien) continue;
      const present = (n) => contenu.some((c) => (n.endsWith('/') ? c.startsWith(n) : c === n));
      if (!present(nom) && present(ancien))
        erreurs.push(
          `${cadrages}${id}/${nom} : introuvable, alors que « ${cadrages}${id}/${ancien} » existe ` +
            `(ssk-canon.yml → ${cle}) — un nom se choisit à la création`,
        );
    }

  return erreurs;
}
