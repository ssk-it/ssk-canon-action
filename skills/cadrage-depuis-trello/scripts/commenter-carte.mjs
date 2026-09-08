#!/usr/bin/env node
/**
 * Repose le lien du cadrage sur la carte Trello dont il est né.
 *
 * C'est le geste qui referme la boucle dans l'autre sens : le cadrage porte
 * déjà le lien vers la carte, mais la carte — celle que le client regarde —
 * ignorait tout de son instruction. Sans ce commentaire, le lien n'existe que
 * du côté qui n'est pas consulté.
 *
 * Le script est volontairement le seul point d'écriture du skill, et il n'écrit
 * qu'une chose : un commentaire. Ni statut, ni étiquette, ni déplacement de
 * liste. Une carte est la propriété du client ; l'instruire n'autorise pas à la
 * réorganiser.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG = join(homedir(), '.claude', 'trello.json');
const dire = (...m) => console.log(...m);
const erreur = (...m) => { console.error(...m); process.exit(1); };

/**
 * Les identifiants, cherchés d'abord dans l'environnement puis dans le fichier.
 *
 * Mêmes champs que la lecture : un seul jeton sert aux deux, émis en
 * `read,write`. Deux jetons distincts auraient préservé une lecture incapable
 * d'écrire, au prix d'une configuration que personne ne tient à jour — et un
 * jeton de lecture périmé se serait alors manifesté comme un défaut d'écriture.
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

function extraireId(entree) {
  const m = entree.match(/trello\.com\/c\/([a-zA-Z0-9]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9]{8,24}$/.test(entree)) return entree;
  return null;
}

/**
 * Un refus d'écriture ne se lit pas comme un refus de lecture.
 *
 * Le cas de loin le plus fréquent ici est un jeton valide mais émis en
 * `scope=read` — celui que le skill demandait avant que l'écriture existe. Il
 * lit parfaitement et se voit refuser la moindre écriture, ce que Trello
 * signale par un 401 impossible à distinguer d'un jeton faux. Nommer ce cas
 * évite de repartir chercher une clé qui, elle, n'a rien.
 */
async function refuser(rep, statut, { cle }) {
  const detail = (await rep.text()).trim();

  if (statut === 401) {
    erreur(
      `ECRITURE_REFUSEE — le jeton n'autorise pas l'écriture (${detail}).\n` +
      "Cause la plus fréquente : le jeton a été émis en lecture seule, comme ce\n" +
      "skill le demandait avant de savoir commenter. Il lit sans faute et ne peut\n" +
      "rien écrire. En émettre un qui puisse les deux, et remplacer le jeton dans\n" +
      `${CONFIG} :\n` +
      `  https://trello.com/1/authorize?key=${cle}&scope=read,write&expiration=never&response_type=token&name=SSK%20Canon`
    );
  }
  if (statut === 404) erreur("CARTE_INTROUVABLE — la carte n'existe pas, ou le jeton n'y donne pas accès.");
  if (statut === 429) erreur('TROP_DE_REQUETES — 100 requêtes par 10 s et par jeton. Réessayer dans dix secondes.');
  erreur(`API_TRELLO ${statut} ${detail}`);
}

async function appeler(chemin, params, { cle, jeton }, methode = 'GET') {
  const url = new URL(`https://api.trello.com/1/${chemin}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', cle);
  url.searchParams.set('token', jeton);

  const rep = await fetch(url, { method: methode });
  if (!rep.ok) await refuser(rep, rep.status, { cle, jeton });
  return rep.json();
}

const entree = process.argv[2];
const lien = process.argv[3];
const titre = process.argv[4];

if (!entree || !lien) {
  erreur('Usage : commenter-carte.mjs <url-ou-id-de-carte> <url-du-cadrage> [titre]');
}

// Un commentaire est visible du client. Un lien qui n'est pas une URL, c'est un
// commentaire qui ne mène nulle part sur une surface partagée.
if (!/^https?:\/\//.test(lien)) {
  erreur(`LIEN_INVALIDE ${lien} — attendu une URL absolue vers le cadrage.`);
}

const ids = identifiants();
if (!ids) {
  dire('IDENTIFIANTS_ABSENTS');
  dire('');
  dire('Créer ~/.claude/trello.json :');
  dire('  { "cle": "<clé API>", "jeton": "<jeton>" }');
  dire('');
  dire("Le jeton doit permettre l'écriture pour commenter :");
  dire('  https://trello.com/1/authorize?key=<clé>&scope=read,write&expiration=never&response_type=token&name=SSK%20Canon');
  process.exit(2);
}

const id = extraireId(entree);
if (!id) erreur(`URL_ILLISIBLE ${entree} — attendu https://trello.com/c/<code>`);

/**
 * Un même cadrage ne se commente qu'une fois.
 *
 * Reprendre un cadrage, corriger sa demande de fusion, relancer le skill sur la
 * même carte : autant d'occasions d'empiler le même lien. Sur une carte que le
 * client lit, la répétition est du bruit, et le bruit finit par faire ignorer la
 * colonne entière des commentaires.
 */
const existants = await appeler(`cards/${id}/actions`, {
  filter: 'commentCard',
  limit: '1000',
}, ids);

const deja = existants.find((a) => a.data?.text?.includes(lien));
if (deja) {
  dire(`DEJA_COMMENTE ${lien}`);
  dire(`Posté le ${deja.date?.slice(0, 10)} par ${deja.memberCreator?.fullName || 'inconnu'}.`);
  process.exit(0);
}

const texte = titre
  ? `📋 Cadrage : [${titre}](${lien})`
  : `📋 Cadrage : ${lien}`;

const poste = await appeler(`cards/${id}/actions/comments`, { text: texte }, ids, 'POST');

dire(`COMMENTE ${lien}`);
dire(`CARTE https://trello.com/c/${id}`);
if (poste.id) dire(`ACTION ${poste.id}`);
