// Tests of the propagator, on throwaway specifications built in memory.
//
// What these cases protect: the propagator writes to the specification, so a
// regression there is costly. We mostly check what is not obvious —
// idempotence, all-or-nothing, and the fact that an undelivered scoping writes nothing.
//
// Each throwaway specification is a real Git repo: delivery is no longer
// declared in a file, it is read from the repo state. A scoping is delivered
// when `HEAD` carries it — simulating it any other way would test something
// other than what runs.
//
//   node src/propagate.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { propagate, expectedState, computeWrites } from './propagate.mjs';
import { check } from './check.mjs';
import { loadRepo } from './parse.mjs';
import { formaterAnomalie } from './anomalies.mjs';

let passed = 0;
const failures = [];

function test(name, fn) {
  const root = mkdtempSync(join(tmpdir(), 'pc-'));
  try {
    for (const d of ['domains', 'features', 'rules', 'cadrages']) {
      mkdirSync(join(root, d), { recursive: true });
    }
    writeFileSync(join(root, 'ssk-canon.yml'), 'schema_version: 1\n');
    git(root, ['init', '-q', '-b', 'main']);
    git(root, ['config', 'user.email', 'test@exemple.fr']);
    git(root, ['config', 'user.name', 'Test']);
    fn(root);
    passed++;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(root, args) {
  execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
}

/** Delivers what is written: a scoping is delivered only if `HEAD` carries it. */
function deliver(root) {
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'livraison']);
}

/** Writes a minimal specification: one domain, one feature. */
function writeBase(root) {
  writeFileSync(join(root, 'domains/d.md'), '---\nid: d\nnom: D\n---\n\nUn domaine.\n');
  writeFileSync(
    join(root, 'features/f.md'),
    '---\nid: f\nnom: F\ndomaines: [d]\n---\n\nUne fonctionnalité.\n',
  );
}

function writeScoping(root, id, delivered, impacts, statements = {}) {
  mkdirSync(join(root, 'cadrages', id), { recursive: true });
  const impactLines = impacts
    .map((i) => `  - { regle: ${i.regle}, operation: ${i.operation} }`)
    .join('\n');
  const sections = Object.entries(statements)
    .map(([r, t]) => `### ${r}\n\n${t}\n`)
    .join('\n');
  writeFileSync(
    join(root, 'cadrages', id, 'cadrage.md'),
    `---\nid: ${id}\ntitre: Cadrage ${id}\ndomaines: [d]\nimpacts:\n${impactLines}\n---\n\n## Objectif\n\nUn objectif.\n\n## Énoncés\n\n${sections}`,
  );
  // Delivery is a fact of the repo: only a committed scoping is delivered.
  if (delivered === 'livree' || delivered === true) deliver(root);
}

function writeRule(root, id, body, frontmatter = {}) {
  const fm = {
    id,
    fonctionnalites: '[f]',
    statut: 'actif',
    cree_par: 'null',
    modifie_par: '[]',
    ...frontmatter,
  };
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  writeFileSync(join(root, 'rules', `${id}.md`), `---\n${lines}\n---\n\n${body}\n`);
}

// --- the writing itself ---

// --- delivery order ---
//
// Two scopings prepared in parallel get their identifier at preparation time:
// the one with the smaller number may be delivered after the other. Its
// statement then prevails, since it was written knowing about the other one.
// Happened on ssk-recon-cadrage with 2026-020 and 2026-021.

test('the statement delivered last prevails, even with a smaller identifier', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Initial.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Création.',
  });
  writeScoping(root, '2026-003', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Texte du 003, livré d’abord.',
  });
  writeScoping(root, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Texte du 002, livré ensuite.',
  });

  const r = propagate(root);
  assert(r.ok, `unexpected failure: ${r.problemes.join(', ')}`);
  const written = readFileSync(join(root, 'rules/RG-a.md'), 'utf8');
  assert(written.includes('Texte du 002'), `the statement delivered last is lost: ${written}`);
  assert(!written.includes('Texte du 003'), 'the replaced statement remained');
  // What the Action checks after writing: the indexes stay those the check
  // recomputes, sorted by identifier.
  deliver(root);
  const { errors } = check(root, { base: 'HEAD' });
  assert(errors.length === 0, `written specification rejected: ${errors.join(' ; ')}`);
});

test('delivery is the merge into the main branch, not the scoping commit', (root) => {
  // 002 is committed on its branch before 003 is delivered, then merged after
  // it: the merge is what delivers it.
  writeBase(root);
  writeRule(root, 'RG-a', 'Initial.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Création.',
  });
  git(root, ['checkout', '-q', '-b', 'cadrage-2026-002']);
  writeScoping(root, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Texte du 002, fusionné ensuite.',
  });
  git(root, ['checkout', '-q', 'main']);
  writeScoping(root, '2026-003', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Texte du 003, livré d’abord.',
  });
  git(root, ['merge', '-q', '--no-ff', '-m', 'Fusion du 002', 'cadrage-2026-002']);

  const r = propagate(root);
  assert(r.ok, `unexpected failure: ${r.problemes.join(', ')}`);
  const written = readFileSync(join(root, 'rules/RG-a.md'), 'utf8');
  assert(written.includes('Texte du 002'), `the most recent merge did not prevail: ${written}`);
  // What the Action checks after writing: the indexes stay those the check
  // recomputes, sorted by identifier.
  deliver(root);
  const { errors } = check(root, { base: 'HEAD' });
  assert(errors.length === 0, `written specification rejected: ${errors.join(' ; ')}`);
});


test('applies a statement to the specification', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Texte périmé.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Le texte attendu.',
  });

  const r = propagate(root);
  assert(r.ok, `unexpected failure: ${r.problemes.join(', ')}`);
  assert(r.ecritures.length === 1, `one write expected, ${r.ecritures.length} obtained`);

  const written = readFileSync(join(root, 'rules/RG-a.md'), 'utf8');
  assert(written.includes('Le texte attendu.'), 'statement not applied');
  assert(written.includes('cree_par: 2026-001'), 'cree_par index not filled in');
});

test('is idempotent: does not rewrite an up-to-date specification', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Périmé.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'À jour.',
  });

  propagate(root);
  const second = propagate(root);
  assert(second.ok, 'second pass failed');
  assert(second.ecritures.length === 0, `${second.ecritures.length} write(s) on the second pass`);
});

test('an undelivered scoping writes nothing', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Inchangé.');
  writeScoping(root, '2026-001', 'en_relecture', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Ne doit pas être appliqué.',
  });

  const r = propagate(root);
  assert(r.ok, `unexpected failure: ${r.problemes.join(', ')}`);
  assert(r.ecritures.length === 0, 'a scoping under review wrote');
  assert(
    readFileSync(join(root, 'rules/RG-a.md'), 'utf8').includes('Inchangé.'),
    'the rule was modified',
  );
});

test('a repeal changes the status without deleting the file', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Texte.', { cree_par: '2026-001' });
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Texte.',
  });
  writeScoping(root, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'abroge' }], {
    'RG-a': 'Abrogée : remplacée par autre chose.',
  });

  const r = propagate(root);
  assert(r.ok, `unexpected failure: ${r.problemes.join(', ')}`);
  const written = readFileSync(join(root, 'rules/RG-a.md'), 'utf8');
  assert(written.includes('statut: abroge'), 'status not switched to repealed');
  assert(written.includes('Abrogée'), 'repeal statement not applied');
  assert(written.includes('modifie_par'), 'modifie_par index missing');
});

test('the “touche” operation produces no write', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Texte.', { cree_par: '2026-001' });
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Texte.',
  });
  writeScoping(root, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'touche' }], {});

  const r = propagate(root);
  assert(r.ok, `unexpected failure: ${r.problemes.join(', ')}`);
  assert(r.ecritures.length === 0, '“touche” produced a write');
});

// --- all or nothing ---

test('writes nothing if a statement is missing', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Intact.', { cree_par: '2026-001' });
  writeRule(root, 'RG-b', 'Intact aussi.', { cree_par: '2026-001' });
  // RG-b is declared modified but without a statement: the whole batch must fail
  writeScoping(
    root,
    '2026-001',
    'livree',
    [
      { regle: 'RG-a', operation: 'cree' },
      { regle: 'RG-b', operation: 'cree' },
    ],
    { 'RG-a': 'Nouveau texte de A.' },
  );

  const r = propagate(root);
  assert(!r.ok, 'the propagation should have failed');
  assert(r.ecritures.length === 0, 'writes were produced despite the failure');
  assert(
    readFileSync(join(root, 'rules/RG-a.md'), 'utf8').includes('Intact.'),
    'RG-a was written although the batch had to fail',
  );
});

test('writes nothing if the specification is inconsistent', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Intact.', { cree_par: '2026-001' });
  // impact on a nonexistent rule: the integrity check must block
  writeScoping(
    root,
    '2026-001',
    'livree',
    [
      { regle: 'RG-a', operation: 'cree' },
      { regle: 'RG-inexistante', operation: 'modifie' },
    ],
    { 'RG-a': 'Nouveau.', 'RG-inexistante': 'Texte.' },
  );

  const r = propagate(root);
  assert(!r.ok, 'the propagation should have failed on integrity');
  assert(
    readFileSync(join(root, 'rules/RG-a.md'), 'utf8').includes('Intact.'),
    'a write happened despite the inconsistency',
  );
});

// --- delivery order ---

test('the last delivered scoping prevails on the statement', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Ancien.', { cree_par: '2026-001' });
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Premier énoncé.',
  });
  writeScoping(root, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Second énoncé, qui fait foi.',
  });

  propagate(root);
  const written = readFileSync(join(root, 'rules/RG-a.md'), 'utf8');
  assert(written.includes('Second énoncé'), 'the last statement does not prevail');
  assert(!written.includes('Premier énoncé'), 'the old statement remains');
  // and the statement of the time stays in the original scoping
  const repo = loadRepo(root);
  assert(
    repo.cadrages.get('2026-001').body.includes('Premier énoncé'),
    'the statement of the time was lost',
  );
});

test('the expected state ignores undelivered scopings', (root) => {
  writeBase(root);
  writeScoping(root, '2026-001', 'brouillon', [{ regle: 'RG-z', operation: 'cree' }], {
    'RG-z': 'Texte.',
  });
  // nothing is committed: no scoping is delivered
  const expected = expectedState(loadRepo(root), new Set());
  assert(expected.size === 0, `${expected.size} rule(s) expected for a single draft`);
});

// --- unreadable frontmatter ---
//
// Invalid YAML raised an exception that went through everything: the reader
// got a stack trace without knowing which file to fix. These cases check that
// it is reported, located, and does not stop the loading.

test('reports an unreadable frontmatter without throwing', (root) => {
  writeBase(root);
  // the case met in use: an unquoted “:” in a value
  writeFileSync(
    join(root, 'rules', 'RG-casse.md'),
    '---\nid: RG-casse\ntitre: Un titre : avec deux-points\n---\n\nTexte.\n',
  );

  const { errors } = loadRepo(root);
  const error = errors.find((e) => e.includes('RG-casse.md'));
  assert(error, `no error for the broken file: ${errors.join(' | ')}`);
  assert(/ligne \d+/.test(error), `the error does not locate the line: ${error}`);
});

test('loads the other files despite an unreadable file', (root) => {
  writeBase(root);
  writeRule(root, 'RG-saine', 'Texte.');
  writeFileSync(join(root, 'rules', 'RG-casse.md'), '---\nstatut: [actif\n---\n\nTexte.\n');

  const repo = loadRepo(root);
  assert(repo.rules.has('RG-saine'), 'a sound rule was lost because of a broken file');
});

test('reports an unreadable decision only once', (root) => {
  writeBase(root);
  writeScoping(root, '2026-001', 'livree', []);
  mkdirSync(join(root, 'cadrages', '2026-001', 'decisions'), { recursive: true });
  writeFileSync(
    join(root, 'cadrages', '2026-001', 'decisions', '01-x.md'),
    '---\ntitre: Choisir : ceci ou cela\n---\n\nTexte.\n',
  );

  const { errors } = loadRepo(root);
  const forFile = errors.filter((e) => e.includes('01-x.md'));
  assert(forFile.length === 1, `${forFile.length} error(s) for a single file`);
});

test('writes nothing when a file is unreadable', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Ancien.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Nouveau.',
  });
  writeFileSync(join(root, 'rules', 'RG-casse.md'), '---\nstatut: [actif\n---\n\nTexte.\n');

  const { ok } = propagate(root, { dryRun: false });
  assert(!ok, 'the propagation agreed to write despite an unreadable file');
  assert(
    readFileSync(join(root, 'rules', 'RG-a.md'), 'utf8').includes('Ancien.'),
    'a write happened while a file was unreadable',
  );
});

test('a README in a content folder is not an entity', (root) => {
  writeBase(root);
  // it explains what the folder expects, to whoever opens the repo on the
  // platform — treating it as an entity would fail on documentation
  writeFileSync(join(root, 'rules', 'README.md'), '# Règles\n\nCe qu’on dépose ici.\n');

  const { errors } = loadRepo(root);
  assert(!errors.length, `README reported: ${errors.join(' | ')}`);
});

// --- derived status, and immutability of a delivered scoping ---
//
// The status is no longer declared: these cases check that the repo alone
// establishes it, and that a delivered scoping can no longer be reworked. This
// is what was missing when a scoping was merged carrying “brouillon” without
// anything reporting it.

test('a status declared in the file is rejected', (root) => {
  writeBase(root);
  mkdirSync(join(root, 'cadrages', '2026-001'), { recursive: true });
  writeFileSync(
    join(root, 'cadrages', '2026-001', 'cadrage.md'),
    '---\nid: 2026-001\ntitre: T\nstatut: livree\ndomaines: [d]\nimpacts: []\n---\n\n## Objectif\n\nUn objectif.\n',
  );
  deliver(root);

  const { errors } = check(root, { base: 'HEAD' });
  assert(
    errors.some((e) => e.includes('le statut ne se déclare pas')),
    `declared status accepted: ${errors.join(' | ')}`,
  );
});

test('a scoping is delivered by the mere fact that the repo carries it', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });

  const r = propagate(root);
  assert(r.ok, `propagation refused: ${r.problemes.join(' | ')}`);
  assert(
    readFileSync(join(root, 'rules/RG-a.md'), 'utf8').includes('Un énoncé.'),
    'a committed scoping was not taken as delivered',
  );
});

test('modifying a delivered scoping is rejected', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // the scoping is reworked after its delivery, which RG-cadrage-livre-immuable forbids
  writeFileSync(
    join(root, 'cadrages', '2026-001', 'cadrage.md'),
    readFileSync(join(root, 'cadrages', '2026-001', 'cadrage.md'), 'utf8') + '\nAjout tardif.\n',
  );
  deliver(root);

  const { errors } = check(root, { base });
  assert(
    errors.some((e) => e.includes('livré, donc figé')),
    `modification of a delivered scoping accepted: ${errors.join(' | ')}`,
  );
});

test('an out-of-reach base is reported, not ignored', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });

  // a workflow that omits `fetch-depth: 0` leaves the base out of reach: the
  // check then does not run, which is not to be confused with a compliant
  // specification — staying silent would make the rule silently inapplicable
  const { errors } = check(root, { base: 'origin/inexistante' });
  assert(
    errors.some((e) => e.includes("hors d'atteinte")),
    `out-of-reach base passed over in silence: ${errors.join(' | ')}`,
  );
});

test('adding a decision to a delivered scoping is rejected', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // nobody reviewed the addition, whereas the approval covered what was
  // present at the time it was given
  mkdirSync(join(root, 'cadrages', '2026-001', 'decisions'), { recursive: true });
  writeFileSync(
    join(root, 'cadrages', '2026-001', 'decisions', '01-tardive.md'),
    '---\nid: 01-tardive\ntitre: Tardive\nstatut: retenue\n---\n\nAprès coup.\n',
  );
  deliver(root);

  const { errors } = check(root, { base });
  assert(
    errors.some((e) => e.includes('livré, donc figé')),
    `decision added after delivery accepted: ${errors.join(' | ')}`,
  );
});

test('an undelivered scoping can be modified freely', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  writeScoping(root, '2026-002', true, [{ regle: 'RG-a', operation: 'touche' }], {});

  const { errors } = check(root, { base });
  assert(
    !errors.some((e) => e.includes('livré, donc figé')),
    `a new scoping was taken for a delivered scoping: ${errors.join(' | ')}`,
  );
});

test('the immutability check can be suspended, without taking the others with it', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // a format rework touches a delivered scoping: this is what the suspension
  // must let through, long enough to deliver it
  writeFileSync(
    join(root, 'cadrages', '2026-001', 'cadrage.md'),
    readFileSync(join(root, 'cadrages', '2026-001', 'cadrage.md'), 'utf8') + '\nReprise.\n',
  );
  deliver(root);

  const withCheck = check(root, { base });
  assert(
    withCheck.errors.some((e) => e.includes('livré, donc figé')),
    'the check does not apply when it should',
  );

  const withoutCheck = check(root, { base, immuabilite: false });
  assert(
    !withoutCheck.errors.some((e) => e.includes('livré, donc figé')),
    `suspension without effect: ${withoutCheck.errors.join(' | ')}`,
  );
});

// --- delivery check ---
//
// The defect they protect against happened twice: a scoping creating a rule
// whose file was missing was merged, the propagation stopped all-or-nothing,
// and nobody knew until the next, unrelated pull request inherited the errors.

test('the delivery check rejects a rule created without its file', (root) => {
  writeBase(root);
  deliver(root);
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // the pull request's scoping: not delivered yet, and its rule has no file
  // in rules/
  writeScoping(root, '2026-001', false, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  deliver(root);

  const ordinary = check(root, { base });
  assert(
    ordinary.errors.length === 0,
    `the ordinary check has nothing to say here: ${ordinary.errors.join(' | ')}`,
  );

  const { errors } = check(root, { base, livraison: true });
  assert(
    errors.some((e) => e.includes('à la livraison') && e.includes('RG-a')),
    `the rule without a file is not reported: ${errors.join(' | ')}`,
  );
});

test('the delivery check stays silent when the file is there', (root) => {
  writeBase(root);
  deliver(root);
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // `cree_par: null` and “À propager.”: what the author writes, the
  // propagation doing the rest after the merge
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', false, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  deliver(root);

  const { errors } = check(root, { base, livraison: true });
  assert(errors.length === 0, `unexpected errors: ${errors.join(' | ')}`);
});

test('the delivery check does not demand what the propagation will produce', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Un énoncé déjà propagé.', { cree_par: '2026-001' });
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé déjà propagé.',
  });
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // a second scoping modifies the rule: `modifie_par` does not carry it yet,
  // and need not carry it before the propagation
  writeScoping(root, '2026-002', false, [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Un énoncé repris.',
  });
  deliver(root);

  const { errors } = check(root, { base, livraison: true });
  assert(
    !errors.some((e) => e.includes('modifie_par')),
    `the derived indexes are demanded too early: ${errors.join(' | ')}`,
  );
});

test('the delivery check sees a scoping not yet committed', (root) => {
  writeBase(root);
  deliver(root);
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // written, not committed: the case of the check run by hand, where the
  // check would be most useful
  writeScoping(root, '2026-001', false, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });

  const { errors } = check(root, { base, livraison: true });
  assert(
    errors.some((e) => e.includes('à la livraison') && e.includes('RG-a')),
    `an uncommitted scoping escapes the check: ${errors.join(' | ')}`,
  );
});

test('an out-of-reach base is reported, rather than kept silent', (root) => {
  writeBase(root);
  deliver(root);

  const { errors } = check(root, { base: 'origine/inconnue', livraison: true });
  assert(
    errors.some((e) => e.includes('livraison') && e.includes("hors d'atteinte")),
    `the missing check is not reported: ${errors.join(' | ')}`,
  );
});

// --- branch already merged ---
//
// The check run by hand compares against `origin/main`, which moves with each
// `fetch`. A branch merged between two checks sees its own scoping delivered
// there, but not yet propagated: the pending derived indexes passed for the
// author's errors. Happened on ssk-canon with 2026-052.

/** Delivers a scoping through a merge, and leaves its branch checked out. */
function mergeScoping(root, id) {
  writeBase(root);
  deliver(root);
  git(root, ['checkout', '-q', '-b', `cadrage-${id}`]);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, id, 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  git(root, ['checkout', '-q', 'main']);
  git(root, ['merge', '-q', '--no-ff', '-m', `Fusion du ${id}`, `cadrage-${id}`]);
  git(root, ['checkout', '-q', `cadrage-${id}`]);
}

test('an already merged branch is reported, without demanding the propagation', (root) => {
  mergeScoping(root, '2026-001');

  const { errors, warnings } = check(root, { base: 'main', livraison: true });
  assert(errors.length === 0, `the pending propagation is demanded: ${errors.join(' | ')}`);
  assert(
    warnings.some((w) => w.includes('déjà fusionnée')),
    `the merge is not reported: ${warnings.join(' | ')}`,
  );
});

test('reworking a scoping on its merged branch stays rejected', (root) => {
  mergeScoping(root, '2026-001');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé repris après la fusion.',
  });

  const { errors, warnings } = check(root, { base: 'main', livraison: true });
  assert(
    errors.some((e) => e.includes('livré, donc figé')),
    `reworking a delivered scoping goes through: ${errors.join(' | ')}`,
  );
  assert(
    !errors.some((e) => e.includes('cree_par')),
    `the pending propagation is demanded: ${errors.join(' | ')}`,
  );
  assert(
    warnings.some((w) => w.includes('déjà fusionnée')),
    `the merge is not reported: ${warnings.join(' | ')}`,
  );
});

test('a branch in progress does not pass for merged', (root) => {
  writeBase(root);
  deliver(root);
  git(root, ['checkout', '-q', '-b', 'cadrage-2026-001']);
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  // the main branch moves forward meanwhile
  git(root, ['checkout', '-q', 'main']);
  writeFileSync(join(root, 'domains/e.md'), '---\nid: e\nnom: E\n---\n\nUn autre domaine.\n');
  deliver(root);
  git(root, ['checkout', '-q', 'cadrage-2026-001']);

  const { warnings } = check(root, { base: 'main', livraison: true });
  assert(
    !warnings.some((w) => w.includes('fusionnée')),
    `a branch in progress is said to be merged: ${warnings.join(' | ')}`,
  );
});

test('the main branch does not pass for merged', (root) => {
  mergeScoping(root, '2026-001');
  git(root, ['checkout', '-q', 'main']);

  // this is what continuous integration sees of a pull request: a commit
  // whose first parent is the main branch
  const { warnings } = check(root, { base: 'main' });
  assert(
    !warnings.some((w) => w.includes('fusionnée')),
    `the main branch is said to be merged: ${warnings.join(' | ')}`,
  );
});

// --- architecture targets ---
//
// An impact may target an architecture decision or an architecture document,
// and no longer only a business rule. What is tested here is not that the
// field is read, but that the new targets go through the whole chain —
// loading, check, propagation — exactly like a rule. A target accepted on
// input but ignored by the propagation would be the worst of both worlds: a
// delivered scoping without effect.

/** Writes a scoping whose impacts target arbitrary targets. */
function writeScopingWithTargets(root, id, delivered, impacts, statements = {}) {
  mkdirSync(join(root, 'cadrages', id), { recursive: true });
  const impactLines = impacts
    .map((i) => {
      const [key, value] = Object.entries(i).find(([k]) => k !== 'operation');
      return `  - { ${key}: ${value}, operation: ${i.operation} }`;
    })
    .join('\n');
  const sections = Object.entries(statements)
    .map(([r, t]) => `### ${r}\n\n${t}\n`)
    .join('\n');
  writeFileSync(
    join(root, 'cadrages', id, 'cadrage.md'),
    `---\nid: ${id}\ntitre: Cadrage ${id}\ndomaines: [d]\nimpacts:\n${impactLines}\n---\n\n## Objectif\n\nUn objectif.\n\n## Énoncés\n\n${sections}`,
  );
  if (delivered === 'livree' || delivered === true) deliver(root);
}

/** Writes an architecture target — decision or document. */
function writeTarget(root, folder, id, body, frontmatter = {}) {
  mkdirSync(join(root, folder), { recursive: true });
  const fm = {
    id,
    ...(folder === 'architecture' ? { nature: 'composant' } : {}),
    statut: 'actif',
    cree_par: 'null',
    modifie_par: '[]',
    ...frontmatter,
  };
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  writeFileSync(join(root, folder, `${id}.md`), `---\n${lines}\n---\n\n${body}\n`);
}

test('propagates a statement to an architecture decision', (root) => {
  writeBase(root);
  writeTarget(root, 'decisions', 'ADR-stockage', 'À propager.');
  writeScopingWithTargets(
    root,
    '2026-001',
    'livree',
    [{ adr: 'ADR-stockage', operation: 'cree' }],
    { 'ADR-stockage': 'Le stockage est objet.' },
  );

  propagate(root);

  const written = readFileSync(join(root, 'decisions/ADR-stockage.md'), 'utf8');
  assert(written.includes('Le stockage est objet.'), 'statement not propagated to the decision');
  assert(written.includes('cree_par: 2026-001'), 'cree_par index not filled in on the decision');
});

// A citation of another specification is decided in the rule's file, like its
// link: the propagation keeps it, without ever choosing it —
// RG-regle-du-socle-citee. Losing it on rewrite would erase what the citing
// specification applies, at the very moment a scoping modifies its rule.
test('the propagation keeps what a rule or a decision applies from another specification', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Périmé.', { applique: "['socle:RG-nommage@2026-012']" });
  writeTarget(root, 'decisions', 'ADR-b', 'Périmé.', { applique: "['socle:ADR-runners@2026-003']" });
  writeScopingWithTargets(
    root,
    '2026-001',
    'livree',
    [{ regle: 'RG-a', operation: 'cree' }, { adr: 'ADR-b', operation: 'cree' }],
    { 'RG-a': 'À jour.', 'ADR-b': 'À jour.' },
  );

  const r = propagate(root);
  assert(r.ok, `unexpected failure: ${r.problemes.join(', ')}`);
  const rule = readFileSync(join(root, 'rules/RG-a.md'), 'utf8');
  const decision = readFileSync(join(root, 'decisions/ADR-b.md'), 'utf8');
  assert(rule.includes('applique: [socle:RG-nommage@2026-012]'), `citation lost on the rule:\n${rule}`);
  assert(decision.includes('applique: [socle:ADR-runners@2026-003]'), `citation lost on the decision:\n${decision}`);
  assert(propagate(root).ecritures.length === 0, 'the citation makes the propagation non-idempotent');
});

test('propagates a statement to an architecture document', (root) => {
  writeBase(root);
  writeTarget(root, 'architecture', 'FLX-export', 'À propager.', { nature: 'flux' });
  writeScopingWithTargets(
    root,
    '2026-001',
    'livree',
    [{ architecture: 'FLX-export', operation: 'cree' }],
    { 'FLX-export': 'Un export nocturne.' },
  );

  propagate(root);

  const written = readFileSync(join(root, 'architecture/FLX-export.md'), 'utf8');
  assert(written.includes('Un export nocturne.'), 'statement not propagated to the document');
  assert(written.includes('cree_par: 2026-001'), 'cree_par index not filled in on the document');
});

test('a “cree” impact on an architecture target requires its statement', (root) => {
  writeBase(root);
  writeTarget(root, 'decisions', 'ADR-sans-enonce', 'À propager.');
  writeScopingWithTargets(root, '2026-001', false, [
    { adr: 'ADR-sans-enonce', operation: 'cree' },
  ]);

  const { errors } = check(root);
  assert(
    errors.some((e) => e.includes('ADR-sans-enonce') && e.includes('énoncé')),
    `the missing statement is not required: ${errors.join(' | ')}`,
  );
});

test('an unknown architecture target is reported', (root) => {
  writeBase(root);
  writeScopingWithTargets(
    root,
    '2026-001',
    false,
    [{ adr: 'ADR-fantome', operation: 'modifie' }],
    { 'ADR-fantome': 'Un texte.' },
  );

  const { errors } = check(root);
  assert(
    errors.some((e) => e.includes('ADR-fantome')),
    `a nonexistent target passes the check: ${errors.join(' | ')}`,
  );
});

test('a mixed scoping touches rule and architecture in a single move', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'À propager.');
  writeTarget(root, 'decisions', 'ADR-b', 'À propager.');
  writeScopingWithTargets(
    root,
    '2026-001',
    'livree',
    [
      { regle: 'RG-a', operation: 'cree' },
      { adr: 'ADR-b', operation: 'cree' },
    ],
    { 'RG-a': 'Une règle.', 'ADR-b': 'Une décision.' },
  );

  propagate(root);

  assert(
    readFileSync(join(root, 'rules/RG-a.md'), 'utf8').includes('Une règle.'),
    'the rule of the mixed scoping was not propagated',
  );
  assert(
    readFileSync(join(root, 'decisions/ADR-b.md'), 'utf8').includes('Une décision.'),
    'the decision of the mixed scoping was not propagated',
  );
});

// --- project prefix ---
//
// The prefix is an additional access path, not an identifier: it changes
// nothing in what is stored. What is tested here is therefore mostly what it
// does not do — and that a malformed prefix is rejected early, rather than
// being discovered at display time, where nothing can correct it anymore.

/** Writes the project configuration, with or without a prefix. */
function writeConfig(root, prefix) {
  const lines = ['schema_version: 1', 'projet:', '  nom: Essai'];
  if (prefix !== undefined) lines.push(`  prefixe: ${prefix}`);
  writeFileSync(join(root, 'ssk-canon.yml'), `${lines.join('\n')}\n`);
}

test('accepts a project without a prefix', (root) => {
  writeBase(root);
  writeConfig(root);
  deliver(root);

  const { errors } = check(root);
  assert(errors.length === 0, `a project without a prefix is rejected: ${errors.join(' | ')}`);
});

test('accepts a well-formed prefix', (root) => {
  writeBase(root);
  writeConfig(root, 'PRMCO');
  deliver(root);

  const { errors } = check(root);
  assert(errors.length === 0, `a valid prefix is rejected: ${errors.join(' | ')}`);
});

test('rejects a prefix that would make an identifier ambiguous', (root) => {
  writeBase(root);
  // A prefix containing a hyphen can no longer be told apart from the
  // separator it introduces: “A-B-2026-001” no longer says where the prefix ends.
  writeConfig(root, 'PRM-CO');
  deliver(root);

  const { errors } = check(root);
  assert(
    errors.some((e) => e.includes('prefixe')),
    `an ambiguous prefix passes the check: ${errors.join(' | ')}`,
  );
});

test('rejects a prefix that would read as a year', (root) => {
  writeBase(root);
  // “2026-2026-001”: nothing would say which of the two is the identifier.
  writeConfig(root, '2026');
  deliver(root);

  const { errors } = check(root);
  assert(
    errors.some((e) => e.includes('prefixe')),
    `a numeric prefix passes the check: ${errors.join(' | ')}`,
  );
});

test('the prefix changes nothing in what is stored', (root) => {
  writeBase(root);
  writeConfig(root, 'PRMCO');
  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });

  propagate(root);

  // The identifier stays bare everywhere: the prefix is added at display time,
  // and writing it here would break the references already set outside the repo.
  const written = readFileSync(join(root, 'rules/RG-a.md'), 'utf8');
  assert(written.includes('cree_par: 2026-001'), `index wrongly prefixed: ${written}`);
  assert(!written.includes('PRMCO'), 'the prefix leaked into the specification');
});

// --- coded anomalies, and repo language ---
//
// RG-anomalies-codees, RG-langue-du-depot: what the check and the propagation
// say about a repo is said in its language, and the French stays yesterday's,
// word for word.

const CLI = new URL('.', import.meta.url).pathname;

/** Runs a command-line tool; returns its output and its exit code. */
function run(tool, args) {
  try {
    return { code: 0, output: execFileSync('node', [join(CLI, tool), ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, output: e.stdout };
  }
}

function setEnglish(root) {
  writeFileSync(join(root, 'ssk-canon.yml'), 'schema_version: 1\nlangue: en\n');
}

const byCode = (anomalies, code) => anomalies.find((a) => a.code === code);

test('an out-of-reach base is reported by its code, in English', (root) => {
  writeBase(root);
  deliver(root);

  const { anomalies } = check(root, { base: 'origine/inconnue', livraison: true });
  const immutability = byCode(anomalies, 'immuabilite-hors-d-atteinte');
  const delivery = byCode(anomalies, 'livraison-hors-d-atteinte');
  assert(immutability && delivery, `missing codes: ${JSON.stringify(anomalies)}`);
  assert(
    formaterAnomalie(delivery, 'en') ===
      'delivery: “origine/inconnue” is out of reach, the check could not run — ' +
        'fetch the history with “fetch-depth: 0”',
    formaterAnomalie(delivery, 'en'),
  );
  assert(formaterAnomalie(immutability, 'en').startsWith('immutability: '), formaterAnomalie(immutability, 'en'));
});

test('the delivery check wraps the anomaly, without restating it as text', (root) => {
  writeBase(root);
  deliver(root);
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeScoping(root, '2026-001', false, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  deliver(root);

  const { anomalies, errors } = check(root, { base, livraison: true });
  const a = byCode(anomalies, 'a-la-livraison');
  assert(a && a.params.anomalie.code, `missing wrapper: ${JSON.stringify(anomalies)}`);
  assert(errors.includes(formaterAnomalie(a, 'fr')), `the French changed: ${errors.join(' | ')}`);
  const en = formaterAnomalie(a, 'en');
  assert(en.startsWith('at delivery: ') && en.includes('RG-a') && !en.includes('à la'), en);
});

test('a modified delivered scoping is reported by its code, in English', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Un énoncé.', { cree_par: '2026-001' });
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeScoping(root, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé repris.',
  });

  const a = byCode(check(root, { base }).anomalies, 'cadrage-livre-modifie');
  assert(a, 'missing code');
  assert(
    formaterAnomalie(a, 'en') ===
      'scoping 2026-001: delivered, hence frozen — cadrages/2026-001/cadrage.md; ' +
        'what must change is changed by a new scoping',
    formaterAnomalie(a, 'en'),
  );
});

test('a changed name is reported by its code, in English', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Un énoncé.');
  deliver(root);
  writeFileSync(join(root, 'ssk-canon.yml'), 'schema_version: 1\ndossiers:\n  regles: exigences\n');

  const a = byCode(check(root, { base: 'HEAD' }).anomalies, 'nom-change');
  assert(a, 'missing code');
  assert(
    formaterAnomalie(a, 'en') ===
      'ssk-canon.yml → dossiers.regles: changes from “rules” to “exigences” — ' +
        'a name is chosen at creation, and never changes',
    formaterAnomalie(a, 'en'),
  );
});

test('an already merged branch is reported by its code, in English', (root) => {
  mergeScoping(root, '2026-001');

  const { anomalies, warnings } = check(root, { base: 'main', livraison: true });
  const a = byCode(anomalies, 'branche-deja-fusionnee');
  assert(a && a.gravite === 'avertissement', `missing code: ${JSON.stringify(anomalies)}`);
  assert(warnings[0] === formaterAnomalie(a, 'fr'), `the French changed: ${warnings.join(' | ')}`);
  assert(formaterAnomalie(a, 'en').startsWith('branch already merged into “main”'), formaterAnomalie(a, 'en'));
});

test('the check speaks English to a repo that declares it', (root) => {
  setEnglish(root);
  writeBase(root);
  deliver(root);

  const { code, output } = run('check.mjs', [root]);
  assert(code === 0, output);
  assert(
    output === '1 domains · 1 features · 0 rules · 0 scopings\n\nIntegrity verified.\n',
    JSON.stringify(output),
  );
});

test('the check states its errors in English, end to end', (root) => {
  setEnglish(root);
  writeBase(root);
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });

  const { code, output } = run('check.mjs', [root, '--base', 'origine/inconnue']);
  assert(code === 1, output);
  assert(output.includes('error(s):\n') && output.includes('  ✗ immutability: '), output);
  assert(!/erreur|règle|cadrage |vérifiée/.test(output), `some French remains: ${output}`);
});

test('the check speaks French to a repo that declares nothing', (root) => {
  writeBase(root);
  deliver(root);

  const { output } = run('check.mjs', [root]);
  assert(
    output === '1 domaines · 1 fonctionnalités · 0 règles · 0 cadrages\n\nIntégrité vérifiée.\n',
    JSON.stringify(output),
  );
});

test('the propagation problems are reported by their code', (root) => {
  writeBase(root);
  // a rule created without a file: linked to no feature — the integrity
  // check stops it beforehand, hence the computation called on its own
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });

  const r = computeWrites(root, new Set(['2026-001']));
  const a = byCode(r.anomalies, 'regle-creee-sans-rattachement');
  assert(a, `missing code: ${JSON.stringify(r.anomalies)}`);
  assert(r.problemes[0] === formaterAnomalie(a, 'fr'), r.problemes.join(' | '));
  assert(formaterAnomalie(a, 'en').startsWith('rule RG-a: created by a scoping'), formaterAnomalie(a, 'en'));
});

test('integrity rejected before propagation wraps the anomaly', (root) => {
  writeBase(root);
  writeRule(root, 'RG-a', 'Intact.', { cree_par: '2026-001' });
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-inexistante', operation: 'modifie' }], {
    'RG-inexistante': 'Texte.',
  });

  const r = propagate(root);
  const a = byCode(r.anomalies, 'integrite-avant-propagation');
  assert(!r.ok && a, `missing code: ${JSON.stringify(r)}`);
  assert(r.problemes.includes(formaterAnomalie(a, 'fr')), r.problemes.join(' | '));
  assert(formaterAnomalie(a, 'en').startsWith('integrity: '), formaterAnomalie(a, 'en'));
});

test('the propagation speaks English to a repo that declares it', (root) => {
  setEnglish(root);
  writeBase(root);
  deliver(root);
  let r = run('propagate.mjs', [root, '--dry-run']);
  assert(r.output === 'Specification already up to date — nothing to propagate.\n', JSON.stringify(r.output));

  writeRule(root, 'RG-a', 'À propager.');
  writeScoping(root, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  r = run('propagate.mjs', [root, '--dry-run']);
  assert(
    r.output === '1 rule(s) to write:\n  ~ RG-a\n\n(dry run — no file changed)\n',
    JSON.stringify(r.output),
  );

  writeScoping(root, '2026-002', 'livree', [{ regle: 'RG-b', operation: 'cree' }], {
    'RG-b': 'Un énoncé.',
  });
  r = run('propagate.mjs', [root, '--dry-run']);
  assert(r.code === 1, r.output);
  assert(/^\n1 problem\(s\) — nothing written:\n  ✗ integrity: scoping 2026-002 → \S+ rule: RG-b\n$/.test(r.output), JSON.stringify(r.output));
});

// --- report ---

console.log(`${passed} test(s) passed`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  for (const e of failures) console.log(`  ✗ ${e}`);
  process.exit(1);
}
