#!/usr/bin/env node
/**
 * Attache à une carte Trello un lien — une demande de fusion, le plus souvent —
 * ou un fichier — une capture du correctif.
 *
 * Un commentaire raconte ; une pièce jointe recense. Les demandes de fusion
 * qu'une carte a fait ouvrir se retrouvent sur la carte elle-même, dans le
 * cadre « Pièces jointes », où Trello affiche leur titre et leur état sans
 * qu'il faille relire la discussion pour les retrouver.
 *
 * Comme `commenter-carte.mjs`, le script n'écrit qu'une chose : ni statut, ni
 * étiquette, ni déplacement de liste. Une carte est la propriété du client.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';

const CONFIG = join(homedir(), '.claude', 'trello.json');
const dire = (...m) => console.log(...m);
const erreur = (...m) => { console.error(...m); process.exit(1); };

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

function extraireId(entree) {
  const m = entree.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9]{8,24}$/.test(entree)) return entree;
  return null;
}

/**
 * Le nom affiché d'une demande de fusion GitHub quand aucun n'est fourni :
 * `prime-ios #282`. Trello montre le nom d'une pièce jointe, pas son URL — une
 * URL nue s'y lit mal, un titre de commit s'y lit trop long.
 */
function nomParDefaut(cible) {
  const pr = cible.match(/github\.com\/[^/]+\/([^/]+)\/pull\/(\d+)/);
  if (pr) return `${pr[1]} #${pr[2]}`;
  return /^https?:\/\//.test(cible) ? cible : basename(cible);
}

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime',
};

async function refuser(rep, { cle }) {
  const statut = rep.status;
  const detail = (await rep.text()).trim();

  if (statut === 401) {
    erreur(
      `ECRITURE_REFUSEE — le jeton n'autorise pas l'écriture (${detail}).\n` +
      "Cause la plus fréquente : un jeton émis en lecture seule. En émettre un\n" +
      `qui puisse lire et écrire, et le reporter dans ${CONFIG} :\n` +
      `  https://trello.com/1/authorize?key=${cle}&scope=read,write&expiration=never&response_type=token&name=SSK%20Canon`
    );
  }
  if (statut === 404) erreur("CARTE_INTROUVABLE — la carte n'existe pas, ou le jeton n'y donne pas accès.");
  if (statut === 413) erreur('FICHIER_TROP_LOURD — Trello refuse ce fichier (10 Mo sur un compte gratuit).');
  if (statut === 429) erreur('TROP_DE_REQUETES — 100 requêtes par 10 s et par jeton. Réessayer dans dix secondes.');
  erreur(`API_TRELLO ${statut} ${detail}`);
}

async function appeler(chemin, ids, { methode = 'GET', params = {}, corps } = {}) {
  const url = new URL(`https://api.trello.com/1/${chemin}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', ids.cle);
  url.searchParams.set('token', ids.jeton);

  const rep = await fetch(url, { method: methode, body: corps });
  if (!rep.ok) await refuser(rep, ids);
  return rep.json();
}

const [entree, cible, nomFourni] = process.argv.slice(2);

if (!entree || !cible) {
  erreur('Usage : attacher-carte.mjs <url-ou-id-de-carte> <url-ou-fichier> [nom]');
}

const estLien = /^https?:\/\//.test(cible);
if (!estLien && !(existsSync(cible) && statSync(cible).isFile())) {
  erreur(`CIBLE_INVALIDE ${cible} — attendu une URL absolue ou un fichier existant.`);
}

const ids = identifiants();
if (!ids) {
  dire('IDENTIFIANTS_ABSENTS — voir lire-carte.mjs pour créer ~/.claude/trello.json.');
  process.exit(2);
}

const id = extraireId(entree);
if (!id) erreur(`URL_ILLISIBLE ${entree} — attendu https://trello.com/c/<code>`);

const nom = nomFourni || nomParDefaut(cible);

/**
 * Une même pièce jointe ne s'attache qu'une fois.
 *
 * Un lien se reconnaît à son URL, un fichier à son nom : Trello renomme l'URL
 * d'un fichier téléversé, et seul le nom survit d'un envoi à l'autre. Relancer
 * le geste après une reprise ne doit pas empiler de doublons sur la carte.
 */
const existantes = await appeler(`cards/${id}/attachments`, ids, {
  params: { fields: 'name,url,isUpload' },
});
const deja = existantes.find((a) => (estLien ? a.url === cible : a.isUpload && a.name === nom));
if (deja) {
  dire(`DEJA_ATTACHE ${estLien ? cible : nom}`);
  process.exit(0);
}

let corps;
if (estLien) {
  corps = new URLSearchParams({ url: cible, name: nom });
} else {
  corps = new FormData();
  const type = TYPES[extname(cible).toLowerCase()] || 'application/octet-stream';
  corps.append('file', new Blob([readFileSync(cible)], { type }), basename(cible));
  corps.append('name', nom);
  corps.append('mimeType', type);
}

const piece = await appeler(`cards/${id}/attachments`, ids, { methode: 'POST', corps });

dire(`ATTACHE ${estLien ? cible : nom}`);
dire(`CARTE https://trello.com/c/${id}`);
if (piece.id) dire(`PIECE ${piece.id}`);
