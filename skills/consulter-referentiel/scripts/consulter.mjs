#!/usr/bin/env node
/**
 * Dit ce que le référentiel sait déjà d'un sujet, avant qu'on le cadre ou qu'on
 * le développe.
 *
 *   consulter.mjs                         l'index : domaines, cadrages en cours
 *   consulter.mjs --domaine <id> …        fonctionnalités, règles, décisions,
 *                                         cadrages livrés et en cours du domaine
 *   consulter.mjs --issue <url|depot#n>   le cadrage qui porte cette issue
 *   consulter.mjs --motif <terme> …       où le terme apparaît, livré et en cours
 *   consulter.mjs --referentiel <chemin>  sans passer par la situation
 *   consulter.mjs --fetch                 rafraîchir même si le dernier fetch est récent
 *
 * Tout se lit sur origin/main et sur les branches de cadrage distantes, jamais
 * dans la copie de travail : un clone de référentiel ouvert une fois et jamais
 * tiré a des dizaines de livraisons de retard, et le consulter tel quel
 * présenterait comme l'état du produit ce qu'il était des semaines plus tôt —
 * sans que rien ne le signale.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dire = (...m) => console.log(...m);
const REF = 'origin/main';

// ── Arguments ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const domaines = [];
const issues = [];
const motifs = [];
let racine = null;
let forcerFetch = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const valeur = args[i + 1];
  if (a === '--domaine' && valeur) { domaines.push(valeur); i++; }
  else if (a === '--issue' && valeur) { issues.push(valeur); i++; }
  else if (a === '--motif' && valeur) { motifs.push(valeur); i++; }
  else if (a === '--referentiel' && valeur) { racine = resolve(valeur); i++; }
  else if (a === '--fetch') forcerFetch = true;
  else { dire(`ARGUMENT_INCONNU ${a}`); process.exit(1); }
}

// ── Trouver le référentiel ───────────────────────────────────────────────────

/**
 * La situation est celle de cadrage-canon, non une copie : deux façons de
 * trouver le référentiel finiraient par en désigner deux différents. Les deux
 * skills s'installent côte à côte, dans la source comme chez le développeur.
 */
if (!racine) {
  const situer = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cadrage-canon', 'scripts', 'situer.mjs');
  if (!existsSync(situer)) {
    dire(`SITUER_INTROUVABLE ${situer} — installer cadrage-canon à côté de ce skill`);
    process.exit(0);
  }
  const sortie = execFileSync('node', [situer], { encoding: 'utf8' });
  const retenu = sortie.match(/^CADRAGE_RETENU (.+)$/m);
  if (!retenu) {
    // Ambiguïté ou absence : la situation l'a nommée, on la relaie telle quelle
    // plutôt que de choisir — c'est à l'appelant de désigner le référentiel.
    process.stdout.write(sortie);
    dire('REFERENTIEL_NON_RETENU — relancer avec --referentiel <chemin>');
    process.exit(0);
  }
  racine = retenu[1].trim();
}

const git = (...a) => execFileSync('git', ['-C', racine, ...a], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
  maxBuffer: 64 * 1024 * 1024,
});

/**
 * Le fetch n'écrit que dans .git : il ne dérange pas une session qui aurait
 * une branche de cadrage ouverte dans ce clone.
 *
 * Il coûte en revanche plusieurs secondes, et une consultation enchaîne trois
 * ou quatre appels en une minute : au-delà du premier, il ne rapporterait rien.
 * On ne le refait donc qu'au-delà de quelques minutes, ou sur demande.
 */
const FRAICHEUR_MS = 5 * 60 * 1000;
function ageDuDernierFetch() {
  try {
    const chemin = resolve(racine, git('rev-parse', '--git-path', 'FETCH_HEAD').trim());
    return Date.now() - statSync(chemin).mtimeMs;
  } catch {
    return Infinity;
  }
}
const age = ageDuDernierFetch();
if (forcerFetch || age > FRAICHEUR_MS) {
  try {
    git('fetch', '-q', '--prune', 'origin');
  } catch {
    dire('FETCH_ECHOUE — lecture de la dernière image connue de origin/main, peut-être en retard');
  }
} else {
  dire(`FETCH_RECENT il y a ${Math.round(age / 1000)} s — --fetch pour le refaire`);
}

let sha;
try {
  sha = git('log', '-1', '--format=%h %cs', REF).trim();
} catch {
  dire(`REFERENCE_ABSENTE ${REF} dans ${racine}`);
  process.exit(0);
}
dire(`REFERENTIEL ${racine} @ ${REF} ${sha}`);

// ── Lecture ──────────────────────────────────────────────────────────────────

/**
 * Tous les fichiers en une passe de `git cat-file --batch`, non un `git show`
 * par fichier : un référentiel d'une centaine de règles et d'une dizaine de
 * branches ouvertes demandait plus de cent cinquante processus, et plusieurs
 * secondes, pour lire moins d'un mégaoctet.
 */
function lireEnLot(objets) {
  const lus = new Map();
  if (objets.length === 0) return lus;
  const sortie = execFileSync('git', ['-C', racine, 'cat-file', '--batch'], {
    input: `${objets.join('\n')}\n`,
    stdio: ['pipe', 'pipe', 'ignore'],
    maxBuffer: 256 * 1024 * 1024,
  });
  let pos = 0;
  for (const objet of objets) {
    const fin = sortie.indexOf(10, pos);
    const entete = sortie.toString('utf8', pos, fin);
    pos = fin + 1;
    // « <objet> missing » : le fichier n'existe pas sur cette référence.
    const m = entete.match(/^[0-9a-f]+ blob (\d+)$/);
    if (!m) { lus.set(objet, null); continue; }
    const taille = Number(m[1]);
    lus.set(objet, sortie.toString('utf8', pos, pos + taille));
    pos += taille + 1;
  }
  return lus;
}

const DOSSIERS = ['domains', 'features', 'rules', 'decisions', 'architecture'];
const fichiersDe = (ref) => {
  try {
    return git('ls-tree', '-r', '--name-only', ref, '--', ...DOSSIERS, 'cadrages').split('\n').filter(Boolean);
  } catch {
    return [];
  }
};
const idsDeCadrages = (fichiers) => fichiers
  .map((f) => f.match(/^cadrages\/(\d{4}-\d{3})\/cadrage\.md$/)?.[1])
  .filter(Boolean);

/**
 * Le frontmatter lu ligne à ligne, comme situer.mjs lit ssk-canon.yml : rien à
 * installer pour consulter. Seules les clés à une ligne sont retenues — les
 * listes en crochets, les scalaires, et les liens, dont l'URL suffit.
 */
function analyser(texte) {
  if (!texte) return null;
  const m = texte.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const champs = {};
  const liens = [];
  for (const ligne of m[1].split('\n')) {
    const cle = ligne.match(/^([a-z_]+): *(.*)$/);
    if (cle && cle[1] !== 'liens') {
      const [, nom, brut] = cle;
      const liste = brut.match(/^\[(.*)\]$/);
      champs[nom] = liste
        ? liste[1].split(',').map((s) => s.trim()).filter(Boolean)
        : brut.replace(/^["']|["']$/g, '').trim();
    }
    const url = ligne.match(/url: *'?([^',}\s]+)/);
    if (url) liens.push(url[1]);
  }
  champs.liens = liens;
  // Domaines et fonctionnalités se nomment tantôt par « titre », tantôt par
  // « nom » : les deux formes coexistent dans les référentiels existants.
  champs.libelle = champs.titre || champs.nom || '';
  // L'énoncé tient dans son premier paragraphe : c'est ce qu'un lecteur pressé
  // doit voir, le reste est dans le fichier.
  const premier = m[2].split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).find((p) => p && !p.startsWith('#'));
  champs.enonce = premier ? (premier.length > 200 ? `${premier.slice(0, 199)}…` : premier) : '';
  return champs;
}

const surMain = fichiersDe(REF);
const idsLivres = new Set(idsDeCadrages(surMain));

/**
 * Les cadrages en cours vivent sur leur branche jusqu'à la fusion. Ce sont eux
 * que la consultation doit surtout voir : un chantier livré se retrouve dans les
 * règles, un chantier en cours n'est visible nulle part ailleurs — et c'est
 * celui qu'on risque de refaire, ou de contredire.
 */
const aLireEnCours = [];
for (const branche of git('branch', '-r', '--no-merged', REF, '--format=%(refname:short)').split('\n').filter(Boolean)) {
  let ids = [];
  try {
    ids = git('ls-tree', '--name-only', `${branche}:cadrages`).split('\n').filter((n) => /^\d{4}-\d{3}$/.test(n));
  } catch { /* pas de cadrages sur cette branche */ }
  for (const id of ids) {
    if (!idsLivres.has(id) && !aLireEnCours.some((e) => e.id === id)) aLireEnCours.push({ id, branche });
  }
}

const objetsMain = surMain.filter((f) => {
  const [dossier, nom, suite] = f.split('/');
  if (dossier === 'cadrages') return suite === 'cadrage.md';
  return DOSSIERS.includes(dossier) && !suite && nom.endsWith('.md') && nom !== 'README.md';
});
const lus = lireEnLot([
  ...objetsMain.map((f) => `${REF}:${f}`),
  ...aLireEnCours.map(({ id, branche }) => `${branche}:cadrages/${id}/cadrage.md`),
]);

const charger = (dossier) => objetsMain
  .filter((f) => f.startsWith(`${dossier}/`))
  .map((f) => analyser(lus.get(`${REF}:${f}`)))
  .filter(Boolean);

const lesDomaines = charger('domains');
const fonctionnalites = charger('features');
const regles = charger('rules');
const decisions = charger('decisions');
const architecture = charger('architecture');
const livres = charger('cadrages');
const enCours = aLireEnCours
  .map(({ id, branche }) => {
    const c = analyser(lus.get(`${branche}:cadrages/${id}/cadrage.md`));
    return c && { ...c, branche };
  })
  .filter(Boolean);

// ── Restitution ──────────────────────────────────────────────────────────────

const ligneCadrage = (c, etiquette) =>
  dire(`  ${etiquette} ${c.id} | ${c.libelle} | domaines: ${(c.domaines ?? []).join(', ')}${c.branche ? ` | ${c.branche}` : ''}`);

if (domaines.length === 0 && issues.length === 0 && motifs.length === 0) {
  dire(`DOMAINES ${lesDomaines.length}`);
  for (const d of lesDomaines) dire(`  DOMAINE ${d.id} | ${d.libelle}`);
  dire(`ARCHITECTURE ${architecture.length}`);
  for (const a of architecture) dire(`  ARCHITECTURE ${a.id} | ${a.nature ?? ''} | ${a.enonce}`);
  dire(`CADRAGES_EN_COURS ${enCours.length}`);
  for (const c of enCours) ligneCadrage(c, 'EN_COURS');
  dire(`TOTAUX fonctionnalites=${fonctionnalites.length} regles=${regles.length} decisions=${decisions.length} cadrages_livres=${livres.length}`);
}

for (const id of domaines) {
  const domaine = lesDomaines.find((d) => d.id === id);
  if (!domaine) {
    dire(`DOMAINE_INCONNU ${id} — connus : ${lesDomaines.map((d) => d.id).join(', ')}`);
    continue;
  }
  dire(`DOMAINE ${domaine.id} | ${domaine.libelle}`);
  dire(`  ${domaine.enonce}`);

  const siennes = fonctionnalites.filter((f) => (f.domaines ?? []).includes(id));
  for (const f of siennes) {
    dire(`  FONCTIONNALITE ${f.id} | ${f.libelle}`);
    for (const r of regles.filter((r) => (r.fonctionnalites ?? []).includes(f.id))) {
      dire(`    REGLE ${r.id} [${r.statut ?? '?'}] | ${r.enonce}`);
    }
  }

  // Une décision n'a pas de domaine : elle hérite de ceux des cadrages qui
  // l'ont créée ou modifiée.
  const cadragesDuDomaine = new Set(livres.filter((c) => (c.domaines ?? []).includes(id)).map((c) => c.id));
  for (const d of decisions) {
    const auteurs = [d.cree_par, ...(d.modifie_par ?? [])].filter(Boolean);
    if (auteurs.some((a) => cadragesDuDomaine.has(a))) dire(`  DECISION ${d.id} [${d.statut ?? '?'}] | ${d.enonce}`);
  }

  for (const c of livres.filter((c) => (c.domaines ?? []).includes(id))) ligneCadrage(c, 'CADRAGE_LIVRE');
  for (const c of enCours.filter((c) => (c.domaines ?? []).includes(id))) ligneCadrage(c, 'CADRAGE_EN_COURS');
}

/**
 * Une issue se désigne par son URL ou par « depot#n ». On compare sur la fin
 * de l'URL, qui est la seule forme que tous les cadrages portent.
 */
for (const issue of issues) {
  const court = issue.match(/^(?:[\w.-]+\/)?([\w.-]+)#(\d+)$/);
  const suffixe = court ? `/${court[1]}/issues/${court[2]}` : issue.replace(/\/+$/, '');
  const trouves = [...livres, ...enCours].filter((c) => c.liens.some((l) => l.endsWith(suffixe)));
  if (trouves.length === 0) dire(`ISSUE_SANS_CADRAGE ${issue}`);
  for (const c of trouves) {
    dire(`ISSUE ${issue} → CADRAGE ${c.id} | ${c.libelle} | ${c.branche ? `en cours sur ${c.branche}` : 'livré'}`);
    dire(`  lire : git -C ${racine} show ${c.branche ?? REF}:cadrages/${c.id}/cadrage.md`);
  }
}

/**
 * Une branche de cadrage porte aussi les cadrages livrés avant qu'elle ne
 * parte : n'y chercher que dans son propre cadrage, sans quoi chaque cadrage
 * livré reviendrait une fois par branche ouverte depuis.
 */
function chercher(ref, chemins, terme) {
  try {
    return git('grep', '-i', '-n', '-F', '-e', terme, ref, '--', ...chemins).split('\n').filter(Boolean);
  } catch {
    return []; // git grep sort en erreur quand il ne trouve rien
  }
}
const couper = (l) => (l.length > 200 ? `${l.slice(0, 199)}…` : l);

/**
 * Regroupé par fichier : un terme courant revient des dizaines de fois dans un
 * même cadrage, et c'est le fichier qu'il faut ouvrir, non chaque ligne.
 */
function parFichier(lignes) {
  const fichiers = new Map();
  for (const l of lignes) {
    const m = l.match(/^([^:]+:[^:]+):(\d+):(.*)$/);
    if (!m) continue;
    const f = fichiers.get(m[1]) ?? { n: 0, premiere: `${m[2]}: ${m[3].trim()}` };
    f.n++;
    fichiers.set(m[1], f);
  }
  return fichiers;
}

for (const terme of motifs) {
  const livresTrouves = parFichier(chercher(REF, ['rules', 'decisions', 'architecture', 'cadrages'], terme));
  const enCoursTrouves = parFichier(enCours.flatMap((c) => chercher(c.branche, [`cadrages/${c.id}`], terme)));
  dire(`MOTIF ${terme} | fichiers livrés: ${livresTrouves.size} | fichiers en cours: ${enCoursTrouves.size}`);
  for (const [f, { n, premiere }] of livresTrouves) dire(`  LIVRE ${f} (${n}) | ${couper(premiere)}`);
  for (const [f, { n, premiere }] of enCoursTrouves) dire(`  EN_COURS ${f} (${n}) | ${couper(premiere)}`);
}
