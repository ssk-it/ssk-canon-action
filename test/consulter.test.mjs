// Tests du script de consultation du référentiel.
//
// Ce qu'ils protègent : la consultation tourne dans un sous-agent, dont chaque
// tour coûte plus que le script lui-même. Le script doit donc rendre en un appel
// tout ce qui sert à choisir quoi lire — y compris les décisions des cadrages —,
// lire plusieurs fichiers en un lot, et ne jamais rendre une sortie que Claude
// Code déporterait dans un fichier. Quand il coupe, rien ne doit se perdre : la
// commande qu'il donne pour la suite rend exactement ce qui manquait.
//
// Le référentiel est construit pour chaque exécution : la fixture livrée sur
// main, et un cadrage en cours sur sa propre branche, tous deux poussés sur une
// origine locale — le script ne lit que les références distantes.
//
//   node test/consulter.test.mjs

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../skills/consulter-referentiel/scripts/consulter.mjs', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixture-repo', import.meta.url));

let reussis = 0;
const echecs = [];

function test(nom, fn) {
  try {
    fn();
    reussis += 1;
  } catch (erreur) {
    echecs.push(`${nom} : ${erreur.message}`);
  }
}

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}

function egal(obtenu, attendu, quoi = '') {
  if (obtenu !== attendu) throw new Error(`${quoi} attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
}

// ── Le référentiel de test ───────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), 'consulter-'));
const git = (dossier, ...a) => execFileSync('git', ['-C', dossier, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();

const origine = join(tmp, 'origine.git');
const travail = join(tmp, 'travail');
const REFERENTIEL = join(tmp, 'referentiel');
execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origine]);
cpSync(FIXTURE, travail, { recursive: true });
git(travail, 'init', '-q', '-b', 'main');
git(travail, 'add', '.');
git(travail, 'commit', '-q', '-m', 'fixture');
git(travail, 'remote', 'add', 'origin', origine);
git(travail, 'push', '-q', 'origin', 'main');

git(travail, 'checkout', '-q', '-b', 'cadrage-2026-016');
mkdirSync(join(travail, 'cadrages/2026-016/decisions'), { recursive: true });
writeFileSync(join(travail, 'cadrages/2026-016/cadrage.md'), `---
id: 2026-016
titre: Se connecter par un jeton d'organisation
domaines: [acces]
liens:
  - { tag: issue_github, url: 'https://github.com/ssk-it/ssk-canon-pwa/issues/99' }
impacts: []
---

## Objectif

Laisser une organisation donner accès à tous ses membres d'un coup.
`);
writeFileSync(join(travail, 'cadrages/2026-016/decisions/01-portee-du-jeton.md'), `---
id: 01-portee-du-jeton
titre: Le jeton couvre-t-il une organisation ou un dépôt ?
statut: retenue
option_retenue: un-depot
---

## Description

Un jeton d'organisation ouvre tous ses dépôts, y compris ceux qui n'ont rien à voir.

## Décision

**Un dépôt.**
`);
git(travail, 'add', '.');
git(travail, 'commit', '-q', '-m', 'cadrage 2026-016');
git(travail, 'push', '-q', 'origin', 'cadrage-2026-016');
execFileSync('git', ['clone', '-q', origine, REFERENTIEL]);

const SANS_LIMITE = { CONSULTER_MAX_CARACTERES: '10000000' };
function lancer(args, env = SANS_LIMITE) {
  return execFileSync('node', [SCRIPT, '--referentiel', REFERENTIEL, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}
const lignes = (sortie) => sortie.split('\n').filter((l) => l !== '');
const ENTETE = /^(FETCH_RECENT|FETCH_ECHOUE|REFERENTIEL) /;
/** Le corps d'une sortie : sans l'en-tête, ni les lignes qui encadrent une page. */
const corps = (sortie) => lignes(sortie).filter((l) => !ENTETE.test(l) && !/^(REPRISE|SUITE) /.test(l));

/**
 * Suit les SUITE jusqu'au bout. Chaque commande donnée est vérifiée telle
 * qu'elle est écrite — c'est celle que l'agent copiera —, puis exécutée.
 */
function toutesLesPages(args, env) {
  const pages = [lancer(args, env)];
  for (;;) {
    const suite = lignes(pages.at(-1)).find((l) => l.startsWith('SUITE '));
    if (!suite) return pages;
    const depuis = suite.match(/--depuis (\d+)$/)?.[1];
    vrai(depuis, `SUITE sans --depuis : ${suite}`);
    const commande = ['node', SCRIPT, '--referentiel', REFERENTIEL, ...args].map(citer).join(' ');
    vrai(suite.endsWith(`: ${commande} --depuis ${depuis}`), `commande de reprise inattendue : ${suite}`);
    vrai(pages.length < 200, 'la pagination ne progresse pas');
    pages.push(lancer([...args, '--depuis', depuis], env));
  }
}
const citer = (a) => (/^[\w@%+=:,./#-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);

const regles = readdirSync(join(FIXTURE, 'rules')).filter((f) => f.endsWith('.md')).sort();
const toutesLesRegles = regles.flatMap((f) => ['--lire', `origin/main:rules/${f}`]);
// Assez pour couper plusieurs fois, sans qu'une commande de reprise de soixante
// fichiers ne mange à elle seule une page de 3 000 caractères.
const quinzeRegles = toutesLesRegles.slice(0, 30);

// ── Décisions des cadrages ───────────────────────────────────────────────────

test('liste, sous un cadrage livré du domaine, ses décisions avec leur premier paragraphe', () => {
  const sortie = lancer(['--domaine', 'referentiel']);
  const ligne = lignes(sortie).find((l) => l.includes('cadrages/2026-013/decisions/01-comparer-ou-consulter.md'));
  vrai(ligne, 'décision 01 de 2026-013 absente');
  egal(
    ligne,
    '    DECISION_DE_CADRAGE origin/main:cadrages/2026-013/decisions/01-comparer-ou-consulter.md [retenue → comparer-deux-etats] | Consulter le référentiel à une date, ou comparer deux états ? | Le référentiel à une date passée était énoncé depuis le socle, sans avoir été réalisé. Au moment de le faire, la question s\'est posée autrement : à quoi sert-on le lecteur ?',
  );
  const tout = lignes(sortie);
  const cadrage = tout.findIndex((l) => l.startsWith('  CADRAGE_LIVRE 2026-013 '));
  vrai(cadrage >= 0 && tout.indexOf(ligne) > cadrage, 'la décision doit suivre la ligne de son cadrage');
});

test('liste aussi les décisions d’un cadrage en cours, lues sur sa branche', () => {
  const sortie = lancer(['--domaine', 'acces']);
  vrai(
    sortie.includes('    DECISION_DE_CADRAGE origin/cadrage-2026-016:cadrages/2026-016/decisions/01-portee-du-jeton.md [retenue → un-depot] | Le jeton couvre-t-il une organisation ou un dépôt ? | Un jeton d\'organisation ouvre tous ses dépôts'),
    `décision du cadrage en cours absente :\n${sortie}`,
  );
});

test('ne répète pas les décisions d’un cadrage commun à deux domaines', () => {
  const sortie = lancer(['--domaine', 'referentiel', '--domaine', 'persistance']);
  const n = lignes(sortie).filter((l) => l.includes('2026-013/decisions/01-comparer-ou-consulter.md')).length;
  egal(n, 1, 'occurrences de la décision');
  vrai(sortie.includes('décisions listées sous le domaine referentiel'), 'renvoi au premier domaine absent');
});

test('rend, pour une issue, son cadrage, ses décisions et la façon de le lire', () => {
  const sortie = lancer(['--issue', 'ssk-canon-pwa#99']);
  vrai(sortie.includes('ISSUE ssk-canon-pwa#99 → CADRAGE 2026-016 | Se connecter par un jeton d\'organisation | en cours sur origin/cadrage-2026-016'), sortie);
  vrai(sortie.includes('  lire : --lire origin/cadrage-2026-016:cadrages/2026-016/cadrage.md'), sortie);
  vrai(sortie.includes('DECISION_DE_CADRAGE origin/cadrage-2026-016:cadrages/2026-016/decisions/01-portee-du-jeton.md'), sortie);
});

// ── Lecture en lot ───────────────────────────────────────────────────────────

test('lit plusieurs fichiers en un appel, chacun entier sous son en-tête', () => {
  const a = 'rules/RG-pj-retention.md';
  const b = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const sortie = lancer(['--lire', `origin/main:${a}`, '--lire', `origin/main:${b}`]);
  for (const f of [a, b]) {
    const contenu = readFileSync(join(FIXTURE, f), 'utf8').replace(/\n$/, '');
    const n = contenu.split('\n').length;
    vrai(sortie.includes(`LIRE origin/main:${f} (${n} lignes)\n${contenu}\n`), `${f} absent ou incomplet`);
  }
});

test('lit un fichier sur une branche de cadrage distante', () => {
  const sortie = lancer(['--lire', 'origin/cadrage-2026-016:cadrages/2026-016/cadrage.md']);
  vrai(sortie.includes('Laisser une organisation donner accès'), sortie);
});

test('dit qu’un fichier n’existe pas sur la référence', () => {
  const sortie = lancer(['--lire', 'origin/main:rules/RG-inexistante.md']);
  vrai(sortie.includes('ABSENT origin/main:rules/RG-inexistante.md'), sortie);
});

test('refuse une référence locale, qui peut être en retard sur l’origine', () => {
  const sortie = lancer(['--lire', 'main:rules/RG-pj-retention.md']);
  vrai(sortie.includes('LIRE_REFUSE main:rules/RG-pj-retention.md'), sortie);
  vrai(!sortie.includes('jamais\nsupprimé'), 'le contenu ne doit pas être rendu');
});

// ── Garde de taille ──────────────────────────────────────────────────────────

test('par défaut, reste sous le seuil où Claude Code déporte une sortie', () => {
  const sortie = lancer(toutesLesRegles, {});
  vrai(sortie.length <= 25000, `sortie de ${sortie.length} caractères`);
  vrai(lignes(sortie).at(-1).startsWith('SUITE '), 'la sortie coupée doit finir par SUITE');
});

for (const [nom, args] of [
  ['--lire', quinzeRegles],
  ['--domaine', ['--domaine', 'persistance', '--domaine', 'cadrage']],
  ['--motif', ['--motif', 'règle', '--motif', 'dépôt']],
]) {
  test(`coupe ${nom} en pages qui, mises bout à bout, ne perdent rien`, () => {
    const entier = corps(lancer(args));
    const pages = toutesLesPages(args, { CONSULTER_MAX_CARACTERES: '3000' });
    vrai(pages.length > 2, `${pages.length} page(s) seulement : le test ne coupe rien`);
    for (const p of pages) vrai(p.length <= 3000, `page de ${p.length} caractères`);
    egal(pages.flatMap(corps).join('\n'), entier.join('\n'), 'contenu reconstitué');
  });
}

test('ne coupe pas un fichier qui tiendrait entier sur la page suivante', () => {
  const petit = 'rules/RG-auteur-reel-commit.md';
  const grand = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const args = ['--lire', `origin/main:${petit}`, '--lire', `origin/main:${grand}`];
  // Les deux ne tiennent pas ensemble avec la ligne SUITE ; le grand, seul, tient.
  const budget = String(lancer(args).length + 200);
  const [premiere, seconde] = toutesLesPages(args, { CONSULTER_MAX_CARACTERES: budget });
  vrai(!premiere.includes(`LIRE origin/main:${grand}`), 'le grand fichier ne doit pas commencer sur la première page');
  vrai(seconde.includes(`LIRE origin/main:${grand}`), 'il doit ouvrir la seconde');
});

test('à la reprise au milieu d’un fichier, dit lequel et à quelle ligne', () => {
  const grand = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const pages = toutesLesPages(['--lire', `origin/main:${grand}`], { CONSULTER_MAX_CARACTERES: '2500' });
  vrai(pages.length > 1, 'le fichier devait être coupé');
  const reprise = lignes(pages[1]).find((l) => l.startsWith('REPRISE '));
  vrai(reprise && new RegExp(`dans : LIRE origin/main:${grand} \\(à partir de sa ligne \\d+\\)`).test(reprise), `reprise inattendue : ${reprise}`);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
