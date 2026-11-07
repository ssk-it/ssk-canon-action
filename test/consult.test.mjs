// Tests of the specification consultation script.
//
// What they protect: the consultation runs in a subagent, each turn of which
// costs more than the script itself. The script must therefore return in one
// call everything needed to choose what to read — including the scopings'
// decisions —, read several files in one batch, and never return an output
// that Claude Code would offload to a file. When it cuts, nothing must be
// lost: the command it gives for the rest returns exactly what was missing.
//
// The specification is built for each run: the fixture delivered on main, and
// an in-progress scoping on its own branch, both pushed to a local origin —
// the script reads only remote refs.
//
//   node test/consult.test.mjs

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../skills/consulter-referentiel/scripts/consulter.mjs', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixture-repo', import.meta.url));

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, what = '') {
  if (actual !== expected) throw new Error(`${what} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── The test specification ───────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), 'consulter-'));
const git = (folder, ...a) => execFileSync('git', ['-C', folder, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();

const origin = join(tmp, 'origine.git');
const work = join(tmp, 'travail');
const SPECIFICATION = join(tmp, 'referentiel');
execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
cpSync(FIXTURE, work, { recursive: true });
// The code repo this specification declares, to exercise the situation.
const DECLARED_REPO = 'ssk-it/depot-de-test';
writeFileSync(join(work, 'ssk-canon.yml'), `${readFileSync(join(work, 'ssk-canon.yml'), 'utf8')}\ndepots_code:\n  - { repo: ${DECLARED_REPO}, role: Test }\n`);
// A delivered decision whose landmarks are missing: the condensed reading must
// say so, not invent — the format guarantees neither the « Contre », nor the
// Décision section, nor a named chosen option.
writeFileSync(join(work, 'cadrages/2026-015/decisions/04-reperes-manquants.md'), `---
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
// A word only a feature carries: --motif must search there too.
writeFileSync(join(work, 'features/vocabulaire.md'), `---
id: vocabulaire
nom: Vocabulaire
domaines: [cadrage]
---

La photocomposition d'un cadrage se règle ici.
`);
git(work, 'init', '-q', '-b', 'main');
git(work, 'add', '.');
git(work, 'commit', '-q', '-m', 'fixture');
git(work, 'remote', 'add', 'origin', origin);
git(work, 'push', '-q', 'origin', 'main');

git(work, 'checkout', '-q', '-b', 'cadrage-2026-016');
mkdirSync(join(work, 'cadrages/2026-016/decisions'), { recursive: true });
writeFileSync(join(work, 'cadrages/2026-016/cadrage.md'), `---
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
writeFileSync(join(work, 'cadrages/2026-016/decisions/01-portee-du-jeton.md'), `---
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
git(work, 'add', '.');
git(work, 'commit', '-q', '-m', 'cadrage 2026-016');
git(work, 'push', '-q', 'origin', 'cadrage-2026-016');

/** A commit at a given date: to check that the date settles nothing. */
function commitDate(date, message) {
  execFileSync('git', ['-C', work, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', message], {
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    stdio: 'ignore',
  });
}
const scoping2026017 = (title) => `---
id: 2026-017
titre: ${title}
domaines: [acces]
---

## Objectif

Révoquer un jeton sans attendre son expiration.
`;

// A branch stacked on the previous one, of which it changed nothing: same
// version of the scoping, nothing divergent to report.
git(work, 'checkout', '-q', '-b', 'cadrage-2026-016-empile');
writeFileSync(join(work, 'README.md'), 'Une note sans rapport avec le cadrage.\n');
git(work, 'add', '.');
git(work, 'commit', '-q', '-m', 'note');
git(work, 'push', '-q', 'origin', 'cadrage-2026-016-empile');

// Two versions of one scoping on two stacked branches. The first is first in
// alphabetical order; the follow-up contains it and carries one more decision.
// Its commits are nonetheless dated earlier, as after a rebase that keeps the
// dates: ancestry settles it, not the date.
git(work, 'checkout', '-q', 'main');
git(work, 'checkout', '-q', '-b', 'cadrage-2026-017');
mkdirSync(join(work, 'cadrages/2026-017/decisions'), { recursive: true });
writeFileSync(join(work, 'cadrages/2026-017/cadrage.md'), scoping2026017('Révoquer un jeton'));
git(work, 'add', '.');
commitDate('2026-10-05T10:00:00Z', 'cadrage 2026-017');
git(work, 'push', '-q', 'origin', 'cadrage-2026-017');
git(work, 'checkout', '-q', '-b', 'cadrage-2026-017-suite');
writeFileSync(join(work, 'cadrages/2026-017/cadrage.md'), scoping2026017('Révoquer un jeton, et le dire à son porteur'));
writeFileSync(join(work, 'cadrages/2026-017/decisions/02-prevenir-le-porteur.md'), `---
id: 02-prevenir-le-porteur
titre: Prévenir le porteur d'un jeton révoqué ?
statut: retenue
option_retenue: par-courriel
---

## Description

Un jeton révoqué sans prévenir laisse son porteur chercher la panne.
`);
git(work, 'add', '.');
commitDate('2026-10-01T10:00:00Z', 'cadrage 2026-017 : prévenir le porteur');
git(work, 'push', '-q', 'origin', 'cadrage-2026-017-suite');

// Two versions of one scoping each started from main: neither contains the
// other. Each carries what the other lacks.
const scoping2026018 = (objective) => `---
id: 2026-018
titre: Expirer les jetons inutilisés
domaines: [acces]
---

## Objectif

${objective}
`;
for (const [branch, date, objective] of [
  ['cadrage-2026-018-a', '2026-10-02T10:00:00Z', 'Expirer un jeton resté inutilisé trente jours.'],
  ['cadrage-2026-018-b', '2026-10-03T10:00:00Z', 'Expirer un jeton resté inutilisé, et le dire à son porteur.'],
]) {
  git(work, 'checkout', '-q', 'main');
  git(work, 'checkout', '-q', '-b', branch);
  mkdirSync(join(work, 'cadrages/2026-018'), { recursive: true });
  writeFileSync(join(work, 'cadrages/2026-018/cadrage.md'), scoping2026018(objective));
  git(work, 'add', '.');
  commitDate(date, `cadrage 2026-018 (${branch})`);
  git(work, 'push', '-q', 'origin', branch);
}
execFileSync('git', ['clone', '-q', origin, SPECIFICATION]);

const NO_LIMIT = { CONSULTER_MAX_CARACTERES: '10000000' };
function run(args, env = NO_LIMIT) {
  return execFileSync('node', [SCRIPT, '--referentiel', SPECIFICATION, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}
const lines = (output) => output.split('\n').filter((l) => l !== '');
const HEADER = /^(FETCH_RECENT|FETCH_ECHOUE|REFERENTIEL) /;
/** The body of an output: without the header, nor the lines that frame a page. */
const body = (output) => lines(output).filter((l) => !HEADER.test(l) && !/^(REPRISE|SUITE) /.test(l));

/**
 * Follows the SUITE lines to the end. Each given command is checked as it is
 * written — it is the one the agent will copy —, then run.
 */
function allPages(args, env) {
  const pages = [run(args, env)];
  for (;;) {
    const next = lines(pages.at(-1)).find((l) => l.startsWith('SUITE '));
    if (!next) return pages;
    const from = next.match(/--depuis (\d+)$/)?.[1];
    assert(from, `SUITE without --depuis: ${next}`);
    const command = ['node', SCRIPT, '--referentiel', SPECIFICATION, ...args].map(quote).join(' ');
    assert(next.endsWith(`: ${command} --depuis ${from}`), `unexpected resume command: ${next}`);
    assert(pages.length < 200, 'pagination does not progress');
    pages.push(run([...args, '--depuis', from], env));
  }
}
const quote = (a) => (/^[\w@%+=:,./#-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);

const rules = readdirSync(join(FIXTURE, 'rules')).filter((f) => f.endsWith('.md')).sort();
const allRules = rules.flatMap((f) => ['--lire', `origin/main:rules/${f}`]);
// Enough to cut several times, without a resume command of sixty files eating
// up a 3,000-character page on its own.
const fifteenRules = allRules.slice(0, 30);

// ── Scopings' decisions ──────────────────────────────────────────────────────

test('lists, under a delivered scoping of the domain, its decisions with their first paragraph', () => {
  const output = run(['--domaine', 'referentiel']);
  const line = lines(output).find((l) => l.includes('cadrages/2026-013/decisions/01-comparer-ou-consulter.md'));
  assert(line, 'decision 01 of 2026-013 missing');
  equal(
    line,
    '    DECISION_DE_CADRAGE origin/main:cadrages/2026-013/decisions/01-comparer-ou-consulter.md [retenue → comparer-deux-etats] | Consulter le référentiel à une date, ou comparer deux états ? | Le référentiel à une date passée était énoncé depuis le socle, sans avoir été réalisé. Au moment de le faire, la question s\'est posée autrement : à quoi sert-on le lecteur ?',
  );
  const all = lines(output);
  const scoping = all.findIndex((l) => l.startsWith('  CADRAGE_LIVRE 2026-013 '));
  assert(scoping >= 0 && all.indexOf(line) > scoping, 'the decision must follow its scoping\'s line');
});

test('also lists the decisions of an in-progress scoping, read on its branch', () => {
  const output = run(['--domaine', 'acces']);
  assert(
    output.includes('    DECISION_DE_CADRAGE origin/cadrage-2026-016:cadrages/2026-016/decisions/01-portee-du-jeton.md [retenue → un-depot] | Le jeton couvre-t-il une organisation ou un dépôt ? | Un jeton d\'organisation ouvre tous ses dépôts'),
    `in-progress scoping's decision missing:\n${output}`,
  );
});

test('states, under an in-progress scoping, the rules it would create, modify or repeal', () => {
  // This is what an in-progress scoping changes in the specification, and what
  // neither the rules nor the index show before it is merged.
  const output = run(['--domaine', 'acces']);
  const all = lines(output);
  const scoping = all.findIndex((l) => l.startsWith('  CADRAGE_EN_COURS 2026-016 '));
  equal(all[scoping + 1], '    IMPACTS modifie RG-connexion-optionnelle · cree RG-jeton-d-organisation · modifie ADR-jetons · touche RG-identite-separee');
});

test('does not repeat the decisions of a scoping shared by two domains', () => {
  const output = run(['--domaine', 'referentiel', '--domaine', 'persistance']);
  const n = lines(output).filter((l) => l.includes('2026-013/decisions/01-comparer-ou-consulter.md')).length;
  equal(n, 1, 'occurrences of the decision');
  assert(output.includes('décisions listées sous le domaine referentiel'), 'reference to the first domain missing');
});

test('returns, for an issue, its scoping, its decisions and how to read it', () => {
  const output = run(['--issue', 'ssk-canon-pwa#99']);
  assert(output.includes('ISSUE ssk-canon-pwa#99 → CADRAGE 2026-016 | Se connecter par un jeton d\'organisation | en cours sur origin/cadrage-2026-016'), output);
  assert(output.includes('  lire : --lire origin/cadrage-2026-016:cadrages/2026-016/cadrage.md'), output);
  assert(output.includes('DECISION_DE_CADRAGE origin/cadrage-2026-016:cadrages/2026-016/decisions/01-portee-du-jeton.md'), output);
});

// ── Versions of an in-progress scoping ───────────────────────────────────────

// What they protect: two branches carried the same scoping, and the script
// kept the first in alphabetical order — often the oldest. What the other
// added, a decision for example, stayed invisible. Neither the name nor the
// date settles it: a rebase rewrites a commit's date, and two versions each
// rewritten on their own side are not one older than the other. A version
// that contains the other is read alone; two versions neither of which
// contains the other are both named.

test('reads the version that contains the other, whatever its commits\' date', () => {
  const all = lines(run([]));
  const i = all.findIndex((l) => l.startsWith('  EN_COURS 2026-017 '));
  assert(i >= 0, `2026-017 missing:\n${all.join('\n')}`);
  assert(all[i].endsWith('| origin/cadrage-2026-017-suite'), all[i]);
  assert(!all[i + 1].startsWith('    VERSION_'), `contained version reported: ${all[i + 1]}`);
});

test('lists the decisions of the version that contains the other', () => {
  const output = run(['--domaine', 'acces']);
  assert(output.includes('DECISION_DE_CADRAGE origin/cadrage-2026-017-suite:cadrages/2026-017/decisions/02-prevenir-le-porteur.md [retenue → par-courriel]'), output);
});

test('names as competing two versions neither of which contains the other', () => {
  const all = lines(run([]));
  const i = all.findIndex((l) => l.startsWith('  EN_COURS 2026-018 '));
  assert(i >= 0, `2026-018 missing:\n${all.join('\n')}`);
  assert(all[i].endsWith('| origin/cadrage-2026-018-b'), all[i]);
  equal(
    all[i + 1],
    '    VERSION_CONCURRENTE origin/cadrage-2026-018-a (2026-10-02) — ni elle ni origin/cadrage-2026-018-b (2026-10-03) ne contient l’autre — --lire origin/cadrage-2026-018-a:cadrages/2026-018/cadrage.md',
  );
});

test('does not name a stacked branch that did not touch the scoping', () => {
  const output = run([]);
  assert(!output.includes('cadrage-2026-016-empile'), output);
});

// ── Pattern search ───────────────────────────────────────────────────────────

// What they protect: --motif searched for the exact string. « supprimer » did
// not find « supprimé », « depot » did not find « dépôt », and a feature was
// never searched.

const foundFiles = (output) => lines(output).filter((l) => /^  (LIVRE|EN_COURS) /.test(l)).map((l) => l.split(' ')[3]).sort();

test('--motif finds the inflections of a word', () => {
  assert(foundFiles(run(['--motif', 'supprimer'])).includes('origin/main:rules/RG-pj-retention.md'), 'supprimé not found by supprimer');
});

test('--motif ignores accents', () => {
  const unaccented = foundFiles(run(['--motif', 'depot']));
  assert(unaccented.length > 0, 'nothing found');
  equal(unaccented.join(','), foundFiles(run(['--motif', 'dépôt'])).join(','), 'files found');
});

test('--motif also searches the features', () => {
  assert(run(['--motif', 'photocomposition']).includes('  LIVRE origin/main:features/vocabulaire.md (1) | '), 'feature not searched');
});

test('--motif also searches a competing version', () => {
  assert(run(['--motif', 'trente']).includes('  EN_COURS origin/cadrage-2026-018-a:cadrages/2026-018/cadrage.md (1) | '), 'competing version not searched');
});

// ── Batch reading ────────────────────────────────────────────────────────────

test('reads several files in one call, each whole under its header', () => {
  const a = 'rules/RG-pj-retention.md';
  const b = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const output = run(['--entier', '--lire', `origin/main:${a}`, '--lire', `origin/main:${b}`]);
  for (const f of [a, b]) {
    // Git returns the file as committed; checked out on Windows, it may carry
    // CRLFs the script never read.
    const content = readFileSync(join(FIXTURE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
    const n = content.split('\n').length;
    assert(output.includes(`LIRE origin/main:${f} (${n} lignes)\n${content}\n`), `${f} missing or incomplete`);
  }
});

test('reads a file on a remote scoping branch', () => {
  const output = run(['--lire', 'origin/cadrage-2026-016:cadrages/2026-016/cadrage.md']);
  assert(output.includes('Laisser une organisation donner accès'), output);
});

test('states that a file does not exist on the ref', () => {
  const output = run(['--lire', 'origin/main:rules/RG-inexistante.md']);
  assert(output.includes('ABSENT origin/main:rules/RG-inexistante.md'), output);
});

test('refuses a local ref, which may be behind origin', () => {
  const output = run(['--lire', 'main:rules/RG-pj-retention.md']);
  assert(output.includes('LIRE_REFUSE main:rules/RG-pj-retention.md'), output);
  assert(!output.includes('jamais\nsupprimé'), 'the content must not be returned');
});

// ── Condensed reading ────────────────────────────────────────────────────────

// What they protect: a delivered scoping was read whole, Énoncés included,
// although the delivery copied them into rules/ and a later scoping may have
// modified them since — half the volume read, and a text no longer
// necessarily in force. And a delivered decision was read with the
// description and the « Pour » of each option, when the consultation only
// needs what was decided and the reason for each rejection.

const readAlone = (object, ...options) => {
  const output = run([...options, '--lire', object]);
  return output.slice(output.indexOf('LIRE '));
};
const fixture = (f) => readFileSync(join(FIXTURE, f), 'utf8').replace(/\r\n/g, '\n');

test('condenses a delivered scoping: its Énoncés point to the text in force', () => {
  const output = readAlone('origin/main:cadrages/2026-002/cadrage.md');
  assert(/^LIRE origin\/main:cadrages\/2026-002\/cadrage\.md \(\d+ lignes, condensé — --entier pour le fichier entier\)\n/.test(output), `unexpected header:\n${output.slice(0, 200)}`);
  assert(output.includes('## Objectif') && output.includes('## Parcours utilisateur') && output.includes('## Énoncés'), 'the other sections must remain');
  // The first paragraph of the original statement of RG-chemins-immuables.
  const original = fixture('cadrages/2026-002/cadrage.md').split('### RG-chemins-immuables\n\n')[1].split('\n')[0];
  assert(!output.includes(original), 'the original statement must not be returned');
  assert(!output.includes('### RG-chemins-immuables'), 'the statement heading is replaced by its ENONCE line');
  assert(output.includes('ENONCE RG-chemins-immuables [cree] → --lire origin/main:rules/RG-chemins-immuables.md\n'), output);
  assert(output.includes('ENONCE RG-statuts-cadrage [modifie] → --lire origin/main:rules/RG-statuts-cadrage.md'), output);
  const n = (output.match(/^ENONCE /gm) ?? []).length;
  equal(n, 15, 'ENONCE lines');
});

test('states, for each statement of a delivered scoping, which scoping modified it since', () => {
  // RG-referentiel-a-une-date is born in 2026-002 and changes in 2026-013: the
  // text of 2026-002 is no longer authoritative, and the reader must know it.
  const output = readAlone('origin/main:cadrages/2026-002/cadrage.md');
  assert(output.includes('ENONCE RG-referentiel-a-une-date [cree] → --lire origin/main:rules/RG-referentiel-a-une-date.md | modifié depuis par 2026-013\n'), output);
  assert(output.includes('ENONCE RG-pj-ordre-upload [cree] → --lire origin/main:rules/RG-pj-ordre-upload.md | modifié depuis par 2026-003\n'), output);
});

test('--entier returns the delivered scoping as it is, Énoncés included', () => {
  const content = fixture('cadrages/2026-002/cadrage.md').replace(/\n$/, '');
  const output = readAlone('origin/main:cadrages/2026-002/cadrage.md', '--entier');
  equal(output, `LIRE origin/main:cadrages/2026-002/cadrage.md (${content.split('\n').length} lignes)\n${content}\n`, 'whole reading');
});

test('reads an in-progress scoping whole: its statements are the proposal', () => {
  const output = readAlone('origin/cadrage-2026-016:cadrages/2026-016/cadrage.md');
  assert(/^LIRE origin\/cadrage-2026-016:cadrages\/2026-016\/cadrage\.md \(\d+ lignes\)\n/.test(output), output);
});

test('condenses a delivered decision: question, description, reason for each rejection, decision', () => {
  const f = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const output = readAlone(`origin/main:${f}`);
  assert(output.startsWith(`LIRE origin/main:${f} (`) && output.includes('condensé — --entier pour le fichier entier)'), output.slice(0, 200));
  assert(output.includes('titre: Consulter le référentiel à une date, ou comparer deux états ?\nstatut: retenue\noption_retenue: comparer-deux-etats'), 'frontmatter');
  assert(output.includes('Le référentiel à une date passée était énoncé depuis le socle'), 'first paragraph of the description');
  assert(!output.includes('Consulter un état ancien suppose'), 'the rest of the description must not be returned');
  assert(output.includes('### bascule-globale (écartée)\n\n**Contre** — le lecteur doit comparer de mémoire.'), output);
  assert(output.includes('### page-de-consultation-datee (écartée)\n\n**Contre** — même défaut central'), output);
  assert(!output.includes('Un sélecteur de date dans la barre') && !output.includes('fidèle à l\'énoncé initial'), 'neither the description nor the « Pour » of a rejected option');
  assert(output.includes('### comparer-deux-etats (retenue)'), 'chosen option');
  assert(output.includes('Enseignement à retenir'), 'the Décision section is returned whole');
});

test('keeps whole a section the summary does not know, such as the reason for a cancellation', () => {
  const output = readAlone('origin/main:cadrages/2026-003/decisions/02-duree-autorisations.md');
  assert(output.includes('statut: annulee'), 'the status must remain visible');
  assert(output.includes('**Un point reste à vérifier empiriquement**'), output);
});

test('states when a landmark is missing, rather than inventing', () => {
  const output = readAlone('origin/main:cadrages/2026-015/decisions/04-reperes-manquants.md');
  assert(output.includes('RETENUE_NON_IDENTIFIEE'), output);
  assert(output.includes('### premiere\n\nCONTRE_ABSENT'), output);
  assert(output.includes('DECISION_ABSENTE'), output);
});

test('reads whole a decision of an in-progress scoping', () => {
  const output = readAlone('origin/cadrage-2026-016:cadrages/2026-016/decisions/01-portee-du-jeton.md');
  assert(/^LIRE \S+ \(\d+ lignes\)\n/.test(output) && output.includes('Un jeton d\'organisation ouvre tous ses dépôts'), output);
});

// ── Size guard ───────────────────────────────────────────────────────────────

test('by default, stays below the threshold where Claude Code offloads an output', () => {
  const output = run(allRules, {});
  assert(output.length <= 25000, `output of ${output.length} characters`);
  assert(lines(output).at(-1).startsWith('SUITE '), 'the cut output must end with SUITE');
});

for (const [name, args] of [
  ['--lire', fifteenRules],
  ['--domaine', ['--domaine', 'persistance', '--domaine', 'cadrage']],
  ['--motif', ['--motif', 'règle', '--motif', 'dépôt']],
]) {
  test(`cuts ${name} into pages that, put end to end, lose nothing`, () => {
    const whole = body(run(args));
    const pages = allPages(args, { CONSULTER_MAX_CARACTERES: '3000' });
    assert(pages.length > 2, `only ${pages.length} page(s): the test cuts nothing`);
    for (const p of pages) assert(p.length <= 3000, `page of ${p.length} characters`);
    equal(pages.flatMap(body).join('\n'), whole.join('\n'), 'rebuilt content');
  });
}

test('does not cut a file that would fit whole on the next page', () => {
  const small = 'rules/RG-auteur-reel-commit.md';
  const large = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const args = ['--entier', '--lire', `origin/main:${small}`, '--lire', `origin/main:${large}`];
  // Both do not fit together with the SUITE line; the large one, alone, fits.
  const budget = String(run(args).length + 200);
  const [first, second] = allPages(args, { CONSULTER_MAX_CARACTERES: budget });
  assert(!first.includes(`LIRE origin/main:${large}`), 'the large file must not start on the first page');
  assert(second.includes(`LIRE origin/main:${large}`), 'it must open the second');
});

test('names, on the SUITE line, the files still to read', () => {
  // An output cut in the middle of a reading must not pass for complete: the
  // SUITE line states what is still missing, file by file.
  const large = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const small = 'rules/RG-auteur-reel-commit.md';
  const args = ['--entier', '--lire', `origin/main:${large}`, '--lire', `origin/main:${small}`];
  const [first] = allPages(args, { CONSULTER_MAX_CARACTERES: '2500' });
  const next = lines(first).at(-1);
  assert(new RegExp(`fichiers non lus : origin/main:${large} \\(à partir de sa ligne \\d+\\), origin/main:${small} — `).test(next), `unexpected SUITE: ${next}`);
});

test('on resuming in the middle of a file, states which one and at which line', () => {
  const large = 'cadrages/2026-013/decisions/01-comparer-ou-consulter.md';
  const pages = allPages(['--entier', '--lire', `origin/main:${large}`], { CONSULTER_MAX_CARACTERES: '2500' });
  assert(pages.length > 1, 'the file should have been cut');
  const resumed = lines(pages[1]).find((l) => l.startsWith('REPRISE '));
  assert(resumed && new RegExp(`dans : LIRE origin/main:${large} \\(à partir de sa ligne \\d+\\)`).test(resumed), `unexpected resumption: ${resumed}`);
});

// ── Situation ────────────────────────────────────────────────────────────────

// A machine where this specification is declared: the situation reads it in
// ~/.claude/cadrage-canon.json, which homedir() finds through HOME or USERPROFILE.
const home = join(tmp, 'maison');
mkdirSync(join(home, '.claude'), { recursive: true });
writeFileSync(join(home, '.claude', 'cadrage-canon.json'), JSON.stringify({ projets: [SPECIFICATION] }));
const outsideRepo = join(tmp, 'hors-depot');
mkdirSync(outsideRepo);
const noOrigin = join(tmp, 'sans-origine');
execFileSync('git', ['init', '-q', noOrigin]);

/** The script without --referentiel, from a given current folder. */
function runFrom(cwd, args = []) {
  return execFileSync('node', [SCRIPT, ...args], {
    cwd,
    env: { ...process.env, ...NO_LIMIT, HOME: home, USERPROFILE: home, GIT_CEILING_DIRECTORIES: tmp },
    encoding: 'utf8',
  });
}

test('--depot designates the code repo, whatever the current folder', () => {
  // A session opened elsewhere than in the code repo — a work folder, or a
  // repo under WSL that a Windows session cannot read — must not prevent
  // consulting its specification.
  const output = runFrom(outsideRepo, ['--depot', DECLARED_REPO]);
  assert(output.includes(`REFERENTIEL ${SPECIFICATION} @ origin/main `), output);
});

test('names the cause when git does not say which the current repo is', () => {
  // « hors dépôt git » also covered a repo without origin, or a repo git
  // refuses to read, which are not fixed the same way.
  const output = runFrom(noOrigin);
  const line = lines(output).find((l) => l.startsWith('DEPOT_COURANT '));
  assert(/^DEPOT_COURANT \(inconnu\) — .*origin/.test(line ?? ''), `unexpected line: ${line}\n${output}`);
  assert(output.includes('REFERENTIEL_NON_RETENU'), output);
});

test('states why git refuses the specification, instead of believing itself offline', () => {
  // On Windows, git refuses a specification cloned under WSL (« dubious
  // ownership »): the script announced an offline reading, then a missing
  // origin/main — two wrong causes.
  const output = execFileSync('node', [SCRIPT, '--referentiel', outsideRepo], {
    env: { ...process.env, GIT_CEILING_DIRECTORIES: tmp },
    encoding: 'utf8',
  });
  assert(output.startsWith(`REFERENTIEL_ILLISIBLE ${outsideRepo} — `), output);
  assert(!output.includes('FETCH_ECHOUE') && !output.includes('REFERENCE_ABSENTE'), output);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length > 0) process.exit(1);
