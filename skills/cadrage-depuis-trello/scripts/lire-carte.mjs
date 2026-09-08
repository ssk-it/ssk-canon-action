#!/usr/bin/env node
/**
 * Lit une carte Trello et rend sa matière brute, prête à cadrer.
 *
 * Ce script ne rédige rien : il récupère, il dépose, il décrit. La traduction
 * d'une carte en cadrage est un travail de jugement — quel est l'objectif réel,
 * quelles décisions sont en jeu — et ce jugement appartient au modèle qui lit
 * cette sortie, pas à un script.
 *
 * Un seul appel d'API ramène la carte entière : description, pièces jointes,
 * checklists, étiquettes et commentaires. Les appels séparés que la
 * documentation suggère coûteraient cinq allers-retours pour le même résultat.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const CONFIG = join(homedir(), '.claude', 'trello.json');
const dire = (...m) => console.log(...m);
const erreur = (...m) => { console.error(...m); process.exit(1); };

/**
 * Les identifiants, cherchés d'abord dans l'environnement puis dans un fichier.
 *
 * L'environnement prime pour qu'une session puisse en imposer d'autres sans
 * toucher au fichier — le cas d'un second compte Trello.
 */
function identifiants() {
  const cle = process.env.TRELLO_API_KEY;
  const jeton = process.env.TRELLO_TOKEN;
  if (cle && jeton) return { cle, jeton };

  if (!existsSync(CONFIG)) return null;
  try {
    const brut = JSON.parse(readFileSync(CONFIG, 'utf8'));
    if (brut.cle && brut.jeton) return { cle: brut.cle, jeton: brut.jeton };
  } catch {
    erreur(`CONFIG_ILLISIBLE ${CONFIG}`);
  }
  return null;
}

/**
 * L'identifiant court d'une carte, extrait de son URL.
 *
 * Trello accepte ce code court partout où il attend un identifiant de carte :
 * il n'y a donc pas à le résoudre en identifiant long au préalable.
 */
function extraireId(entree) {
  const m = entree.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9]{8,24}$/.test(entree)) return entree;
  return null;
}

/**
 * Dit lequel des deux identifiants est en cause, et s'arrête.
 *
 * Trello répond « invalid key » aussi bien pour une clé inconnue que pour un
 * jeton qui n'a pas été émis par cette clé — le cas d'un jeton régénéré, ou
 * repris d'un autre Power-Up. Ne pas les distinguer laisse chercher du mauvais
 * côté : ici la clé est bonne, et c'est le jeton qu'il faut refaire.
 */
async function refuser(rep, { cle, jeton }) {
  const detail = (await rep.text()).trim();

  // Interrogée sans jeton, l'API répond « invalid token » quand la clé, elle,
  // est reconnue. C'est ce qui sépare les deux cas.
  let cleValide = false;
  try {
    const t = await fetch(`https://api.trello.com/1/members/me?key=${cle}`);
    cleValide = (await t.text()).includes('invalid token');
  } catch {
    // Sans réseau, on s'en tient au message brut.
  }

  if (!cleValide) {
    erreur(
      `CLE_REFUSEE — la clé API n'est pas reconnue (${detail}).\n` +
      "La reprendre sur https://trello.com/apps/admin, onglet « API key »."
    );
  }
  erreur(
    `JETON_REFUSE — la clé est valide, mais le jeton ne lui correspond pas (${detail}).\n` +
    "Cause la plus fréquente : le « Secret » de la page d'admin a été pris pour\n" +
    "le jeton. Les deux font 64 caractères hex, mais le Secret sert au flux OAuth\n" +
    "et n'est jamais un jeton. Un jeton d'un autre Power-Up, ou d'une clé\n" +
    "régénérée depuis, est refusé de la même façon. En émettre un ici :\n" +
    `  https://trello.com/1/authorize?key=${cle}&scope=read&expiration=never&response_type=token&name=SSK%20Canon`
  );
}

async function appeler(chemin, params, { cle, jeton }) {
  const url = new URL(`https://api.trello.com/1/${chemin}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', cle);
  url.searchParams.set('token', jeton);

  const rep = await fetch(url);
  if (rep.status === 401) await refuser(rep, { cle, jeton });
  if (rep.status === 404) erreur('CARTE_INTROUVABLE — la carte n\'existe pas, ou le jeton n\'y donne pas accès.');
  if (rep.status === 429) erreur('TROP_DE_REQUETES — 100 requêtes par 10 s et par jeton. Réessayer dans dix secondes.');
  if (!rep.ok) erreur(`API_TRELLO ${rep.status} ${await rep.text()}`);
  return rep.json();
}

/**
 * Télécharge une pièce jointe.
 *
 * Le téléchargement d'une pièce jointe uploadée n'accepte pas les identifiants
 * en paramètres d'URL, contrairement au reste de l'API : il exige l'en-tête
 * Authorization. Passer par les paramètres renvoie une page de connexion HTML
 * au lieu du fichier — une erreur silencieuse, qui produit des fichiers
 * d'apparence valide et de contenu faux.
 */
async function telecharger(pj, dossier, { cle, jeton }) {
  const rep = await fetch(pj.url, {
    headers: { Authorization: `OAuth oauth_consumer_key="${cle}", oauth_token="${jeton}"` },
  });
  if (!rep.ok) return { ...pj, echec: `HTTP ${rep.status}` };

  const type = rep.headers.get('content-type') || '';
  if (type.includes('text/html')) {
    return { ...pj, echec: 'réponse HTML — authentification refusée' };
  }

  const nom = assainir(pj.fileName || pj.name || pj.id);
  const cible = join(dossier, nom);
  writeFileSync(cible, Buffer.from(await rep.arrayBuffer()));
  return { ...pj, chemin: cible };
}

/** Un nom de fichier sûr, sans chemin ni caractère qui perturbe un shell. */
function assainir(nom) {
  const base = nom.split('/').pop().split('\\').pop();
  return base.replace(/[^\w.\-]/g, '_').slice(0, 120) || 'piece-jointe';
}

const entree = process.argv[2];
const dossierDemande = process.argv[3];

if (!entree) {
  erreur('Usage : lire-carte.mjs <url-ou-id-de-carte> [dossier-des-pieces-jointes]');
}

const ids = identifiants();
if (!ids) {
  dire('IDENTIFIANTS_ABSENTS');
  dire('');
  dire('Créer ~/.claude/trello.json :');
  dire('  { "cle": "<clé API>", "jeton": "<jeton>" }');
  dire('');
  dire('La clé se prend sur https://trello.com/apps/admin — créer un Power-Up,');
  dire('onglet « API key ». Le jeton s\'obtient en lecture seule par :');
  dire('  https://trello.com/1/authorize?key=<clé>&scope=read&expiration=never&response_type=token&name=SSK%20Canon');
  process.exit(2);
}

const id = extraireId(entree);
if (!id) erreur(`URL_ILLISIBLE ${entree} — attendu https://trello.com/c/<code>`);

const carte = await appeler(`cards/${id}`, {
  attachments: 'true',
  // Sans ce champ, la réponse omet `isUpload` et `fileName` : impossible alors
  // de distinguer un fichier déposé d'un lien collé, ni de nommer le fichier.
  attachment_fields: 'all',
  checklists: 'all',
  checklist_fields: 'all',
  actions: 'commentCard',
  // Le défaut est de 50 commentaires. Une carte discutée en porte davantage, et
  // ce sont les plus anciens — donc les décisions initiales — qui tomberaient.
  actions_limit: '1000',
  fields: 'name,desc,url,shortUrl,shortLink,labels,due,idShort',
}, ids);

dire(`CARTE ${carte.shortUrl || carte.url}`);
dire(`TITRE ${carte.name}`);
if (carte.labels?.length) dire(`ETIQUETTES ${carte.labels.map((l) => l.name || l.color).join(', ')}`);
if (carte.due) dire(`ECHEANCE ${carte.due}`);

dire('');
dire('--- DESCRIPTION ---');
dire(carte.desc?.trim() || '(vide)');

for (const cl of carte.checklists || []) {
  dire('');
  dire(`--- CHECKLIST ${cl.name} ---`);
  for (const item of cl.checkItems || []) {
    dire(`[${item.state === 'complete' ? 'x' : ' '}] ${item.name}`);
  }
}

const commentaires = (carte.actions || []).filter((a) => a.data?.text);
if (commentaires.length) {
  dire('');
  dire('--- COMMENTAIRES ---');
  // Du plus ancien au plus récent : une discussion se lit dans son ordre.
  for (const c of commentaires.reverse()) {
    dire(`${c.memberCreator?.fullName || 'inconnu'} (${c.date?.slice(0, 10)}) : ${c.data.text}`);
  }
}

const pjs = carte.attachments || [];
// Une pièce jointe Trello est soit un fichier déposé, soit un simple lien collé.
// Seuls les fichiers se téléchargent ; les liens se citent.
const fichiers = pjs.filter((p) => p.isUpload);
const liens = pjs.filter((p) => !p.isUpload);

if (liens.length) {
  dire('');
  dire('--- LIENS ATTACHÉS ---');
  for (const l of liens) dire(`${l.name} → ${l.url}`);
}

if (fichiers.length) {
  const dossier = resolve(dossierDemande || join(process.env.TMPDIR || '/tmp', `trello-${id}`));
  mkdirSync(dossier, { recursive: true });
  dire('');
  dire('--- PIÈCES JOINTES ---');
  dire(`DOSSIER ${dossier}`);
  for (const pj of fichiers) {
    const r = await telecharger(pj, dossier, ids);
    if (r.echec) dire(`ECHEC ${pj.fileName || pj.name} — ${r.echec}`);
    else dire(`FICHIER ${r.chemin} (${pj.bytes ?? '?'} octets)`);
  }
}
