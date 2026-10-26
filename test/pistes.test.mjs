// Tests de la vérification du rattachement d'une piste — RG-piste-rattachee.
//
// Ce qu'ils protègent : une piste est une issue du dépôt de référentiel, qui ne
// passe par aucune demande de fusion. Une piste rattachée à rien, ou par une
// étiquette qui ne désigne aucun domaine ni aucune fonctionnalité, n'apparaît
// nulle part — et rien d'autre que cette vérification ne le dit. Le signalement
// se fait par un seul commentaire sur l'issue, tenu à jour plutôt que répété.
//
// Les issues sont fictives, le référentiel est la fixture : ses domaines et ses
// fonctionnalités sont lus par le chargeur partagé, comme dans l'Action.
//
//   node test/pistes.test.mjs

import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRepo } from '../src/parse.mjs';
import {
  MARQUEUR_PISTE,
  checkPiste,
  corpsCommentairePiste,
  etiquettesRattachementPiste,
  planifierCommentairePiste,
} from '../src/pistes.mjs';
import { verifierPiste } from '../src/verifier-piste.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';

const FIXTURE = fileURLToPath(new URL('./fixture-repo', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../src/verifier-piste.mjs', import.meta.url));
const SCRIPT_ETIQUETTES = fileURLToPath(new URL('../src/etiquettes-pistes.mjs', import.meta.url));
const referentiel = loadRepo(FIXTURE);

let reussis = 0;
const echecs = [];

async function test(nom, fn) {
  try {
    await fn();
    reussis += 1;
  } catch (erreur) {
    echecs.push(`${nom} : ${erreur.message}`);
  }
}

function egal(obtenu, attendu, quoi = '') {
  const o = JSON.stringify(obtenu);
  const a = JSON.stringify(attendu);
  if (o !== a) throw new Error(`${quoi} attendu ${a}, obtenu ${o}`);
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

/** Les étiquettes telles que GitHub les donne : des objets, nommés. */
const etiquettes = (...noms) => noms.map((name) => ({ name }));

// --- lecture des étiquettes ---

await test("une issue sans l'étiquette piste n'est pas vérifiée", () => {
  egal(checkPiste(etiquettes('domaine/inconnu'), referentiel), { piste: false, ecarts: [], anomalies: [] });
});

await test('une piste rattachée à un domaine et une fonctionnalité existants est en ordre', () => {
  egal(
    checkPiste(etiquettes('piste', 'domaine/acces', 'fonctionnalite/authentification'), referentiel),
    { piste: true, ecarts: [], anomalies: [] },
  );
});

await test("les étiquettes étrangères au rattachement n'entrent pas en compte", () => {
  egal(checkPiste(etiquettes('piste', 'bug', 'domaine/cadrage'), referentiel).ecarts, []);
});

await test('une piste rattachée à rien est signalée', () => {
  const { ecarts } = checkPiste(etiquettes('piste', 'bug'), referentiel);
  egal(ecarts.length, 1, "nombre d'écarts");
  vrai(/rattachée à aucun domaine ni aucune fonctionnalité/.test(ecarts[0]), ecarts[0]);
});

await test('un domaine inconnu est signalé par son étiquette', () => {
  const { ecarts } = checkPiste(etiquettes('piste', 'domaine/acces', 'domaine/facturation'), referentiel);
  egal(ecarts.length, 1, "nombre d'écarts");
  vrai(ecarts[0].includes('`domaine/facturation`'), ecarts[0]);
  vrai(ecarts[0].includes('aucun domaine'), ecarts[0]);
});

await test('une fonctionnalité inconnue est signalée par son étiquette', () => {
  const { ecarts } = checkPiste(
    etiquettes('piste', 'domaine/acces', 'fonctionnalite/authentfication'),
    referentiel,
  );
  egal(ecarts.length, 1, "nombre d'écarts");
  vrai(ecarts[0].includes('`fonctionnalite/authentfication`'), ecarts[0]);
  vrai(ecarts[0].includes('aucune fonctionnalité'), ecarts[0]);
});

await test("un domaine pris pour une fonctionnalité est signalé : l'identifiant n'est pas cherché ailleurs", () => {
  const { ecarts } = checkPiste(etiquettes('piste', 'domaine/cadrage', 'fonctionnalite/acces'), referentiel);
  egal(ecarts.length, 1, "nombre d'écarts");
  vrai(ecarts[0].includes('`fonctionnalite/acces`'), ecarts[0]);
});

await test("une étiquette sans identifiant est signalée, et ne vaut pas rattachement", () => {
  const { ecarts } = checkPiste(etiquettes('piste', 'domaine/'), referentiel);
  egal(ecarts.length, 2, "nombre d'écarts");
  vrai(ecarts.some((e) => e.includes('`domaine/`') && e.includes('sans identifiant')), ecarts.join(' | '));
});

await test('une étiquette inconnue ne vaut pas rattachement', () => {
  const { ecarts } = checkPiste(etiquettes('piste', 'domaine/facturation'), referentiel);
  egal(ecarts.length, 2, "nombre d'écarts");
});

await test('les étiquettes se lisent aussi comme de simples noms', () => {
  egal(checkPiste(['piste', 'domaine/acces'], referentiel).ecarts, []);
});

// --- les étiquettes à créer dans un référentiel ---

await test('une étiquette de rattachement par domaine puis par fonctionnalité, dans l\'ordre des identifiants', () => {
  const noms = etiquettesRattachementPiste(referentiel);
  egal(noms.length, referentiel.domains.size + referentiel.features.size, "nombre d'étiquettes");
  egal(noms.slice(0, 2), ['domaine/acces', 'domaine/cadrage']);
  vrai(noms.includes('fonctionnalite/authentification'), noms.join(', '));
  egal(noms.filter((n) => n.startsWith('domaine/')).length, referentiel.domains.size, 'domaines');
});

await test('chaque étiquette de rattachement est acceptée par la vérification', () => {
  for (const nom of etiquettesRattachementPiste(referentiel))
    egal(checkPiste(['piste', nom], referentiel).ecarts, [], nom);
});

await test("l'identifiant vient du frontmatter, pas du nom du fichier", () => {
  const racine = mkdtempSync(join(tmpdir(), 'pistes-id-'));
  try {
    cpSync(FIXTURE, racine, { recursive: true });
    writeFileSync(join(racine, 'domains', 'Facturation-v2.md'), '---\nid: facturation\nnom: Facturation\n---\n');
    const noms = etiquettesRattachementPiste(loadRepo(racine));
    vrai(noms.includes('domaine/facturation'), noms.join(', '));
    vrai(!noms.some((n) => /Facturation-v2/.test(n)), 'le nom du fichier ne fait pas une étiquette');
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

await test('en ligne de commande, une étiquette par ligne', () => {
  const lignes = execFileSync('node', [SCRIPT_ETIQUETTES, FIXTURE]).toString().trim().split('\n');
  egal(lignes, etiquettesRattachementPiste(referentiel));
});

await test("en ligne de commande, un référentiel sans domaine ni fonctionnalité est une erreur", () => {
  const vide = mkdtempSync(join(tmpdir(), 'pistes-vide-'));
  try {
    let echoue = false;
    try {
      execFileSync('node', [SCRIPT_ETIQUETTES, vide], { stdio: 'pipe' });
    } catch {
      echoue = true;
    }
    vrai(echoue, 'le script doit échouer');
  } finally {
    rmSync(vide, { recursive: true, force: true });
  }
});

// --- le commentaire ---

const BOT = { type: 'Bot', login: 'github-actions[bot]' };
const HUMAIN = { type: 'User', login: 'redactrice' };

await test('le commentaire porte le marqueur, chaque écart, et la règle', () => {
  const corps = corpsCommentairePiste(['écart A', 'écart B']);
  vrai(corps.startsWith(MARQUEUR_PISTE), 'le marqueur ouvre le commentaire');
  vrai(corps.includes('- écart A') && corps.includes('- écart B'), corps);
  vrai(corps.includes('RG-piste-rattachee'), corps);
});

await test('sans écart ni commentaire, rien à faire', () => {
  egal(planifierCommentairePiste([], []), { action: 'rien' });
});

await test('un premier écart crée le commentaire', () => {
  egal(planifierCommentairePiste([], ['écart A']), {
    action: 'creer',
    corps: corpsCommentairePiste(['écart A']),
  });
});

await test('un écart déjà signalé tel quel ne réécrit rien', () => {
  const commentaires = [{ id: 7, user: BOT, body: corpsCommentairePiste(['écart A']) }];
  egal(planifierCommentairePiste(commentaires, ['écart A']), { action: 'rien' });
});

await test('un écart qui change met à jour le commentaire existant, sans en ajouter', () => {
  const commentaires = [{ id: 7, user: BOT, body: corpsCommentairePiste(['écart A']) }];
  egal(planifierCommentairePiste(commentaires, ['écart B']), {
    action: 'modifier',
    id: 7,
    corps: corpsCommentairePiste(['écart B']),
  });
});

await test('une piste remise en ordre voit son commentaire supprimé', () => {
  const commentaires = [{ id: 7, user: BOT, body: corpsCommentairePiste(['écart A']) }];
  egal(planifierCommentairePiste(commentaires, []), { action: 'supprimer', id: 7 });
});

await test("le commentaire d'une personne qui cite le marqueur n'est jamais repris", () => {
  const commentaires = [{ id: 3, user: HUMAIN, body: corpsCommentairePiste(['écart A']) }];
  egal(planifierCommentairePiste(commentaires, []), { action: 'rien' });
  egal(planifierCommentairePiste(commentaires, ['écart A']).action, 'creer');
});

// --- la vérification de bout en bout, sur une plateforme simulée ---

/** Une issue et ses commentaires, tels que la plateforme les tiendrait. */
function plateforme(labels, commentaires = []) {
  const etat = { labels: etiquettes(...labels), commentaires: [...commentaires], suivant: 100 };
  return {
    etat,
    api: {
      lireIssue: async () => ({ labels: etat.labels }),
      listerCommentaires: async () => etat.commentaires,
      creer: async (body) => etat.commentaires.push({ id: etat.suivant++, user: BOT, body }),
      modifier: async (id, body) => {
        etat.commentaires.find((c) => c.id === id).body = body;
      },
      supprimer: async (id) => {
        etat.commentaires = etat.commentaires.filter((c) => c.id !== id);
      },
    },
  };
}

const commentairesDuBot = (etat) => etat.commentaires.filter((c) => c.user.type === 'Bot');

await test('une piste aux étiquettes valides ne reçoit aucun commentaire', async () => {
  const { etat, api } = plateforme(['piste', 'domaine/acces']);
  const { ecarts } = await verifierPiste({ racine: FIXTURE, api });
  egal(ecarts, []);
  egal(etat.commentaires.length, 0, 'commentaires');
});

await test('une piste aux étiquettes inconnues reçoit un commentaire qui les nomme', async () => {
  const { etat, api } = plateforme(['piste', 'domaine/facturation', 'fonctionnalite/export']);
  const { ecarts } = await verifierPiste({ racine: FIXTURE, api });
  egal(ecarts.length, 3, "nombre d'écarts");
  egal(commentairesDuBot(etat).length, 1, 'commentaires du bot');
  vrai(commentairesDuBot(etat)[0].body.includes('`domaine/facturation`'), 'le domaine inconnu est nommé');
  vrai(commentairesDuBot(etat)[0].body.includes('`fonctionnalite/export`'), 'la fonctionnalité inconnue est nommée');
});

await test('une piste sans rattachement reçoit un commentaire, un seul à chaque modification', async () => {
  const { etat, api } = plateforme(['piste'], [{ id: 1, user: HUMAIN, body: 'Une idée.' }]);
  await verifierPiste({ racine: FIXTURE, api });
  etat.labels = etiquettes('piste', 'domaine/facturation');
  await verifierPiste({ racine: FIXTURE, api });
  egal(commentairesDuBot(etat).length, 1, 'commentaires du bot');
  vrai(commentairesDuBot(etat)[0].body.includes('`domaine/facturation`'), 'le commentaire est mis à jour');
  egal(etat.commentaires.length, 2, 'le commentaire du rédacteur reste');
});

await test('une piste corrigée voit le commentaire disparaître', async () => {
  const { etat, api } = plateforme(['piste', 'domaine/facturation']);
  await verifierPiste({ racine: FIXTURE, api });
  etat.labels = etiquettes('piste', 'domaine/cadrage');
  await verifierPiste({ racine: FIXTURE, api });
  egal(etat.commentaires.length, 0, 'commentaires');
});

await test("une issue qui perd l'étiquette piste voit le commentaire disparaître", async () => {
  const { etat, api } = plateforme(['piste']);
  await verifierPiste({ racine: FIXTURE, api });
  etat.labels = etiquettes('bug');
  const { piste } = await verifierPiste({ racine: FIXTURE, api });
  egal(piste, false, 'piste');
  egal(etat.commentaires.length, 0, 'commentaires');
});

// --- en ligne de commande, comme l'Action l'appelle ---

const dossier = mkdtempSync(join(tmpdir(), 'pistes-'));
const evenement = (nom, contenu) => {
  const chemin = join(dossier, nom);
  writeFileSync(chemin, JSON.stringify(contenu));
  return chemin;
};
const lancer = (...args) =>
  execFileSync('node', [SCRIPT, ...args], { env: { ...process.env, GITHUB_OUTPUT: '' } }).toString();

await test("sans commenter, le script lit l'événement, dit les écarts et les compte", () => {
  const chemin = evenement('inconnu.json', {
    issue: { number: 12, labels: etiquettes('piste', 'domaine/facturation') },
  });
  const sortie = lancer(FIXTURE, '--evenement', chemin, '--sans-commentaire');
  vrai(sortie.includes('`domaine/facturation`'), sortie);
  vrai(/^2 écart\(s\) de rattachement/m.test(sortie), sortie);
});

await test("sans commenter, une piste en ordre ne compte aucun écart", () => {
  const chemin = evenement('valide.json', {
    issue: { number: 12, labels: etiquettes('piste', 'fonctionnalite/historique') },
  });
  vrai(/aucun écart de rattachement/.test(lancer(FIXTURE, '--evenement', chemin, '--sans-commentaire')), 'aucun écart');
});

await test("un événement sans issue n'est pas une erreur : rien à vérifier", () => {
  const chemin = evenement('push.json', { ref: 'refs/heads/main' });
  vrai(/aucun écart de rattachement/.test(lancer(FIXTURE, '--evenement', chemin, '--sans-commentaire')), 'aucun écart');
});


// --- les anomalies codées, et la langue du dépôt — RG-anomalies-codees, RG-langue-du-depot ---

/** La fixture, déclarée en anglais. */
function referentielEnAnglais() {
  const racine = mkdtempSync(join(tmpdir(), 'pistes-en-'));
  cpSync(FIXTURE, racine, { recursive: true });
  appendFileSync(join(racine, 'ssk-canon.yml'), '\nlangue: en\n');
  return racine;
}

await test('chaque écart est une anomalie codée, ses paramètres tirés des étiquettes', () => {
  const { anomalies, ecarts } = checkPiste(
    etiquettes('piste', 'domaine/', 'fonctionnalite/export'),
    referentiel,
  );
  egal(
    anomalies.map((a) => [a.code, a.gravite]),
    [
      ['piste-non-rattachee', 'avertissement'],
      ['etiquette-piste-sans-identifiant', 'avertissement'],
      ['etiquette-piste-inconnue', 'avertissement'],
    ],
  );
  egal(anomalies[1].params, { etiquette: 'domaine/' });
  egal(anomalies[2].params.etiquette, 'fonctionnalite/export');
  egal(anomalies[2].params.collection, 'features');
  egal(ecarts, anomalies.map((a) => formaterAnomalie(a, 'fr')), 'les écarts sont les anomalies dites en français');
});

await test('une piste en ordre ne porte aucune anomalie', () => {
  egal(checkPiste(etiquettes('piste', 'domaine/acces'), referentiel).anomalies, []);
  egal(checkPiste(etiquettes('bug'), referentiel).anomalies, []);
});

await test('les écarts se disent en anglais, les étiquettes et les identifiants tels quels', () => {
  const { ecarts } = checkPiste(etiquettes('piste', 'domaine/', 'domaine/facturation'), referentiel, 'en');
  egal(ecarts[0], 'the roadmap item is linked to no domain and no feature of the specification: ' +
    'it will appear nowhere — add a `domaine/<id>` or `fonctionnalite/<id>` label to it');
  egal(ecarts[1], 'the label `domaine/` has no identifier');
  egal(ecarts[2], 'the label `domaine/facturation` designates no domain of the specification — known domains: `acces`, `cadrage`, `persistance`, `referentiel`');
});

await test('le commentaire se dit en anglais, marqueur en tête', () => {
  const corps = corpsCommentairePiste(['gap A'], 'en');
  vrai(corps.startsWith(MARQUEUR_PISTE), 'le marqueur ouvre le commentaire');
  vrai(corps.includes('**This roadmap item is not properly linked to the specification.**'), corps);
  vrai(corps.includes('- gap A') && corps.includes('RG-piste-rattachee'), corps);
  vrai(!/piste se rattache/.test(corps), corps);
  egal(planifierCommentairePiste([], ['gap A'], 'en'), { action: 'creer', corps });
});

await test("un dépôt déclaré en anglais reçoit un commentaire en anglais", async () => {
  const racine = referentielEnAnglais();
  try {
    const { etat, api } = plateforme(['piste', 'domaine/facturation']);
    const { anomalies } = await verifierPiste({ racine, api });
    egal(anomalies.map((a) => a.code), ['piste-non-rattachee', 'etiquette-piste-inconnue']);
    const corps = commentairesDuBot(etat)[0].body;
    vrai(corps.includes('the label `domaine/facturation` designates no domain'), corps);
    vrai(corps.includes('This roadmap item'), corps);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

await test("en ligne de commande, un dépôt déclaré en anglais lit ses avertissements en anglais", () => {
  const racine = referentielEnAnglais();
  const d = mkdtempSync(join(tmpdir(), 'pistes-en-evt-'));
  try {
    const chemin = join(d, 'e.json');
    const lancerIci = (contenu) => {
      writeFileSync(chemin, JSON.stringify(contenu));
      return execFileSync('node', [SCRIPT, racine, '--evenement', chemin, '--sans-commentaire'], {
        env: { ...process.env, GITHUB_OUTPUT: '' },
      }).toString();
    };
    const sortie = lancerIci({ issue: { number: 12, labels: etiquettes('piste', 'domaine/facturation') } });
    vrai(sortie.includes('::warning::#12 — the label `domaine/facturation` designates no domain'), sortie);
    vrai(/^2 linking gap\(s\)$/m.test(sortie), sortie);
    egal(lancerIci({ issue: { number: 5, labels: etiquettes('bug') } }),
      'Issue #5: not a roadmap item.\nno linking gap\n');
    egal(lancerIci({}), 'No issue in this event: nothing to check.\nno linking gap\n');
  } finally {
    rmSync(racine, { recursive: true, force: true });
    rmSync(d, { recursive: true, force: true });
  }
});

await test("une langue inconnue se signale, et la piste se dit en français", () => {
  const racine = mkdtempSync(join(tmpdir(), 'pistes-xx-'));
  try {
    cpSync(FIXTURE, racine, { recursive: true });
    appendFileSync(join(racine, 'ssk-canon.yml'), '\nlangue: de\n');
    const chemin = join(racine, 'e.json');
    writeFileSync(chemin, JSON.stringify({ issue: { number: 12, labels: etiquettes('piste') } }));
    const sortie = execFileSync('node', [SCRIPT, racine, '--evenement', chemin, '--sans-commentaire'], {
      env: { ...process.env, GITHUB_OUTPUT: '' },
    }).toString();
    vrai(sortie.includes('::warning::ssk-canon.yml → langue « de »'), sortie);
    vrai(sortie.includes("la piste n'est rattachée à aucun domaine"), sortie);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

await test("en ligne de commande, un dépôt sans langue garde la sortie d'hier, mot pour mot", () => {
  const sortie = lancer(FIXTURE, '--evenement', fileURLToPath(new URL('./evenements/piste-mal-rattachee.json', import.meta.url)), '--sans-commentaire');
  egal(sortie,
    "::warning::#12 — l'étiquette `fonctionnalite/export` ne désigne aucune fonctionnalité du référentiel — " +
      'fonctionnalités connues : `authentification`, `autorisation`, `consultation-cadrage`, `cycle-vie-cadrage`, ' +
      '`historique`, `impacts-regles`, `modele-referentiel`, `pieces-jointes`, `redaction-cadrage`, `stockage-git`\n' +
      '1 écart(s) de rattachement\n');
});

rmSync(dossier, { recursive: true, force: true });

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
