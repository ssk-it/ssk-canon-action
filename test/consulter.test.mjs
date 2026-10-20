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
// Le dépôt de code que ce référentiel déclare, pour éprouver la situation.
const DEPOT_DECLARE = 'ssk-it/depot-de-test';
writeFileSync(join(travail, 'ssk-canon.yml'), `${readFileSync(join(travail, 'ssk-canon.yml'), 'utf8')}\ndepots_code:\n  - { repo: ${DEPOT_DECLARE}, role: Test }\n`);
// Une décision livrée dont les repères manquent : la lecture condensée doit le
// dire, non inventer — le format ne garantit ni le « Contre », ni la section
// Décision, ni une option retenue nommée.
writeFileSync(join(travail, 'cadrages/2026-015/decisions/04-reperes-manquants.md'), `---
id: 04-reperes-manquants
titre: Une décision sans ses repères ?
statut: retenue
---

## Description

Une décision écrite avant que la convention ne se fixe.

## Options

### premiere

Ce que la première option propose.

**Contrepartie assumée** — un écart au gabarit.

### seconde

Ce que la seconde option propose.
`);
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
impacts:
  - { regle: RG-connexion-optionnelle, operation: modifie, enonce: 'Un jeton d’organisation suffit.' }
  - { regle: RG-jeton-d-organisation, operation: cree, enonce: 'Un jeton couvre un dépôt.' }
  - { adr: ADR-jetons, operation: modifie }
  - { regle: RG-identite-separee, operation: touche }
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

test('dit, sous un cadrage en cours, les règles qu’il créerait, modifierait ou abrogerait', () => {
  // C'est ce qu'un cadrage en cours change au référentiel, et que ni les règles
  // ni l'index ne montrent avant sa fusion.
  const sortie = lancer(['--domaine', 'acces']);
  const tout = lignes(sortie);
  const cadrage = tout.findIndex((l) => l.startsWith('  CADRAGE_EN_COURS 2026-016 '));
  egal(tout[cadrage + 1], '    IMPACTS modifie RG-connexion-optionnelle · cree RG-jeton-d-organisation · modifie ADR-jetons · touche RG-identite-separee');
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
  const sortie = lancer(['--entier', '--lire', `origin/main:${a}`, '--lire', `origin/main:${b}`]);
  for (const f of [a, b]) {
    // Git rend le fichier tel qu'il est commité ; extrait sous Windows, il peut
    // porter des CRLF que le script n'a jamais lus.
    const contenu = readFileSync(join(FIXTURE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
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

// ── Lecture condensée ────────────────────────────────────────────────────────

// Ce qu'ils protègent : un cadrage livré se lisait en entier, Énoncés compris,
// alors que la livraison les a recopiés dans rules/ et qu'un cadrage ultérieur
// a pu les modifier depuis — la moitié du volume lu, et un texte qui n'est plus
// forcément en vigueur. Et une décision livrée se lisait avec la description et
// les « Pour » de chaque option, quand la consultation n'a besoin que de ce qui
// est tranché et du motif de chaque écart.

const lireSeul = (objet, ...options) => {
  const sortie = lancer([...options, '--lire', objet]);
  return sortie.slice(sortie.indexOf('LIRE '));
};
const fixture = (f) => readFileSync(join(FIXTURE, f), 'utf8').replace(/\r\n/g, '\n');

test('condense un cadrage livré : ses Énoncés renvoient au texte en vigueur', () => {
  const sortie = lireSeul('origin/main:cadrages/2026-002/cadrage.md');
  vrai(/^LIRE origin\/main:cadrages\/2026-002\/cadrage\.md \(\d+ lignes, condensé — --entier pour le fichier entier\)\n/.test(sortie), `en-tête inattendu :\n${sortie.slice(0, 200)}`);
  vrai(sortie.includes('## Objectif') && sortie.includes('## Parcours utilisateur') && sortie.includes('## Énoncés'), 'les autres sections doivent rester');
  // Le premier paragraphe de l'énoncé d'époque de RG-chemins-immuables.
  const epoque = fixture('cadrages/2026-002/cadrage.md').split('### RG-chemins-immuables\n\n')[1].split('\n')[0];
  vrai(!sortie.includes(epoque), 'l’énoncé d’époque ne doit pas être rendu');
  vrai(!sortie.includes('### RG-chemins-immuables'), 'le titre d’énoncé est remplacé par sa ligne ENONCE');
  vrai(sortie.includes('ENONCE RG-chemins-immuables [cree] → --lire origin/main:rules/RG-chemins-immuables.md\n'), sortie);
  vrai(sortie.includes('ENONCE RG-statuts-cadrage [modifie] → --lire origin/main:rules/RG-statuts-cadrage.md'), sortie);
  const n = (sortie.match(/^ENONCE /gm) ?? []).length;
  egal(n, 15, 'lignes ENONCE');
});

test('dit, pour chaque énoncé d’un cadrage livré, quel cadrage l’a modifié depuis', () => {
  // RG-referentiel-a-une-date naît en 2026-002 et change en 2026-013 : le texte
  // de 2026-002 n'est plus celui qui fait foi, et le lecteur doit le savoir.
  const sortie = lireSeul('origin/main:cadrages/2026-002/cadrage.md');
  vrai(sortie.includes('ENONCE RG-referentiel-a-une-date [cree] → --lire origin/main:rules/RG-referentiel-a-une-date.md | modifié depuis par 2026-013\n'), sortie);
  vrai(sortie.includes('ENONCE RG-pj-ordre-upload [cree] → --lire origin/main:rules/RG-pj-ordre-upload.md | modifié depuis par 2026-003\n'), sortie);
});

test('--entier rend le cadrage livré tel qu’il est, Énoncés compris', () => {
  const contenu = fixture('cadrages/2026-002/cadrage.md').replace(/\n$/, '');
  const sortie = lireSeul('origin/main:cadrages/2026-002/cadrage.md', '--entier');
  egal(sortie, `LIRE origin/main:cadrages/2026-002/cadrage.md (${contenu.split('\n').length} lignes)\n${contenu}\n`, 'lecture entière');
});

test('lit en entier un cadrage en cours : ses énoncés sont la proposition', () => {
  const sortie = lireSeul('origin/cadrage-2026-016:cadrages/2026-016/cadrage.md');
  vrai(/^LIRE origin\/cadrage-2026-016:cadrages\/2026-016\/cadrage\.md \(\d+ lignes\)\n/.test(sortie), sortie);
});

test('condense une décision livrée : question, description, motif de chaque écart, décision', () => {
  const f = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const sortie = lireSeul(`origin/main:${f}`);
  vrai(sortie.startsWith(`LIRE origin/main:${f} (`) && sortie.includes('condensé — --entier pour le fichier entier)'), sortie.slice(0, 200));
  vrai(sortie.includes('titre: Consulter le référentiel à une date, ou comparer deux états ?\nstatut: retenue\noption_retenue: comparer-deux-etats'), 'frontmatter');
  vrai(sortie.includes('Le référentiel à une date passée était énoncé depuis le socle'), 'premier paragraphe de la description');
  vrai(!sortie.includes('Consulter un état ancien suppose'), 'la suite de la description ne doit pas être rendue');
  vrai(sortie.includes('### bascule-globale (écartée)\n\n**Contre** — le lecteur doit comparer de mémoire.'), sortie);
  vrai(sortie.includes('### page-de-consultation-datee (écartée)\n\n**Contre** — même défaut central'), sortie);
  vrai(!sortie.includes('Un sélecteur de date dans la barre') && !sortie.includes('fidèle à l\'énoncé initial'), 'ni la description ni les « Pour » d’une option écartée');
  vrai(sortie.includes('### comparer-deux-etats (retenue)'), 'option retenue');
  vrai(sortie.includes('Enseignement à retenir'), 'la section Décision est rendue entière');
});

test('garde entière une section que le résumé ne connaît pas, comme le motif d’une annulation', () => {
  const sortie = lireSeul('origin/main:cadrages/2026-003/decisions/02-duree-autorisations.md');
  vrai(sortie.includes('statut: annulee'), 'le statut doit rester visible');
  vrai(sortie.includes('**Un point reste à vérifier empiriquement**'), sortie);
});

test('dit quand un repère manque, plutôt que d’inventer', () => {
  const sortie = lireSeul('origin/main:cadrages/2026-015/decisions/04-reperes-manquants.md');
  vrai(sortie.includes('RETENUE_NON_IDENTIFIEE'), sortie);
  vrai(sortie.includes('### premiere\n\nCONTRE_ABSENT'), sortie);
  vrai(sortie.includes('DECISION_ABSENTE'), sortie);
});

test('lit en entier une décision de cadrage en cours', () => {
  const sortie = lireSeul('origin/cadrage-2026-016:cadrages/2026-016/decisions/01-portee-du-jeton.md');
  vrai(/^LIRE \S+ \(\d+ lignes\)\n/.test(sortie) && sortie.includes('Un jeton d\'organisation ouvre tous ses dépôts'), sortie);
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
  const args = ['--entier', '--lire', `origin/main:${petit}`, '--lire', `origin/main:${grand}`];
  // Les deux ne tiennent pas ensemble avec la ligne SUITE ; le grand, seul, tient.
  const budget = String(lancer(args).length + 200);
  const [premiere, seconde] = toutesLesPages(args, { CONSULTER_MAX_CARACTERES: budget });
  vrai(!premiere.includes(`LIRE origin/main:${grand}`), 'le grand fichier ne doit pas commencer sur la première page');
  vrai(seconde.includes(`LIRE origin/main:${grand}`), 'il doit ouvrir la seconde');
});

test('nomme, sur la ligne SUITE, les fichiers qui restent à lire', () => {
  // Une sortie coupée au milieu d'une lecture ne doit pas pouvoir passer pour
  // complète : la ligne SUITE dit ce qui manque encore, fichier par fichier.
  const grand = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const petit = 'rules/RG-auteur-reel-commit.md';
  const args = ['--entier', '--lire', `origin/main:${grand}`, '--lire', `origin/main:${petit}`];
  const [premiere] = toutesLesPages(args, { CONSULTER_MAX_CARACTERES: '2500' });
  const suite = lignes(premiere).at(-1);
  vrai(new RegExp(`fichiers non lus : origin/main:${grand} \\(à partir de sa ligne \\d+\\), origin/main:${petit} — `).test(suite), `SUITE inattendue : ${suite}`);
});

test('à la reprise au milieu d’un fichier, dit lequel et à quelle ligne', () => {
  const grand = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const pages = toutesLesPages(['--entier', '--lire', `origin/main:${grand}`], { CONSULTER_MAX_CARACTERES: '2500' });
  vrai(pages.length > 1, 'le fichier devait être coupé');
  const reprise = lignes(pages[1]).find((l) => l.startsWith('REPRISE '));
  vrai(reprise && new RegExp(`dans : LIRE origin/main:${grand} \\(à partir de sa ligne \\d+\\)`).test(reprise), `reprise inattendue : ${reprise}`);
});

// ── Situation ────────────────────────────────────────────────────────────────

// Une machine où ce référentiel est déclaré : la situation la lit dans
// ~/.claude/cadrage-canon.json, que homedir() trouve par HOME ou USERPROFILE.
const maison = join(tmp, 'maison');
mkdirSync(join(maison, '.claude'), { recursive: true });
writeFileSync(join(maison, '.claude', 'cadrage-canon.json'), JSON.stringify({ projets: [REFERENTIEL] }));
const horsDepot = join(tmp, 'hors-depot');
mkdirSync(horsDepot);
const sansOrigine = join(tmp, 'sans-origine');
execFileSync('git', ['init', '-q', sansOrigine]);

/** Le script sans --referentiel, depuis un dossier courant donné. */
function situer(cwd, args = []) {
  return execFileSync('node', [SCRIPT, ...args], {
    cwd,
    env: { ...process.env, ...SANS_LIMITE, HOME: maison, USERPROFILE: maison, GIT_CEILING_DIRECTORIES: tmp },
    encoding: 'utf8',
  });
}

test('--depot désigne le dépôt de code, quel que soit le dossier courant', () => {
  // Une session ouverte ailleurs que dans le dépôt de code — un dossier de
  // travail, ou un dépôt sous WSL qu'une session Windows ne lit pas — ne doit
  // pas empêcher de consulter son référentiel.
  const sortie = situer(horsDepot, ['--depot', DEPOT_DECLARE]);
  vrai(sortie.includes(`REFERENTIEL ${REFERENTIEL} @ origin/main `), sortie);
});

test('nomme la cause quand git ne dit pas quel est le dépôt courant', () => {
  // « hors dépôt git » couvrait aussi un dépôt sans origin, ou un dépôt que git
  // refuse de lire, qui ne se règlent pas de la même façon.
  const sortie = situer(sansOrigine);
  const ligne = lignes(sortie).find((l) => l.startsWith('DEPOT_COURANT '));
  vrai(/^DEPOT_COURANT \(inconnu\) — .*origin/.test(ligne ?? ''), `ligne inattendue : ${ligne}\n${sortie}`);
  vrai(sortie.includes('REFERENTIEL_NON_RETENU'), sortie);
});

test('dit pourquoi git refuse le référentiel, au lieu de se croire hors ligne', () => {
  // Sous Windows, git refuse un référentiel cloné sous WSL (« dubious
  // ownership ») : le script annonçait une lecture hors ligne, puis une
  // origin/main absente — deux causes fausses.
  const sortie = execFileSync('node', [SCRIPT, '--referentiel', horsDepot], {
    env: { ...process.env, GIT_CEILING_DIRECTORIES: tmp },
    encoding: 'utf8',
  });
  vrai(sortie.startsWith(`REFERENTIEL_ILLISIBLE ${horsDepot} — `), sortie);
  vrai(!sortie.includes('FETCH_ECHOUE') && !sortie.includes('REFERENCE_ABSENTE'), sortie);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
