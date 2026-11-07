// Tests of the check of a roadmap item's link — RG-piste-rattachee.
//
// What they protect: a roadmap item is an issue of the specification repo,
// which goes through no pull request. A roadmap item linked to nothing, or by a
// label that designates no domain and no feature, appears nowhere — and
// nothing but this check says so. The report is made through a single comment
// on the issue, kept up to date rather than repeated.
//
// The issues are fictitious, the specification is the fixture: its domains and
// features are read by the shared loader, as in the Action.
//
//   node test/roadmap-items.test.mjs

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
import { checkRoadmapItemEvent } from '../src/check-roadmap-item.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';

const FIXTURE = fileURLToPath(new URL('./fixture-repo', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../src/check-roadmap-item.mjs', import.meta.url));
const LABELS_SCRIPT = fileURLToPath(new URL('../src/roadmap-item-labels.mjs', import.meta.url));
const specification = loadRepo(FIXTURE);

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

function equal(actual, expected, what = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what} expected ${e}, got ${a}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** The labels as GitHub gives them: objects, with a name. */
const labels = (...names) => names.map((name) => ({ name }));

// --- reading the labels ---

await test('an issue without the piste label is not checked', () => {
  equal(checkPiste(labels('domaine/inconnu'), specification), { piste: false, ecarts: [], anomalies: [] });
});

await test('a roadmap item linked to an existing domain and feature is in order', () => {
  equal(
    checkPiste(labels('piste', 'domaine/acces', 'fonctionnalite/authentification'), specification),
    { piste: true, ecarts: [], anomalies: [] },
  );
});

await test('labels unrelated to the link are not taken into account', () => {
  equal(checkPiste(labels('piste', 'bug', 'domaine/cadrage'), specification).ecarts, []);
});

await test('a roadmap item linked to nothing is reported', () => {
  const { ecarts } = checkPiste(labels('piste', 'bug'), specification);
  equal(ecarts.length, 1, 'number of discrepancies');
  assert(/rattachée à aucun domaine ni aucune fonctionnalité/.test(ecarts[0]), ecarts[0]);
});

await test('an unknown domain is reported by its label', () => {
  const { ecarts } = checkPiste(labels('piste', 'domaine/acces', 'domaine/facturation'), specification);
  equal(ecarts.length, 1, 'number of discrepancies');
  assert(ecarts[0].includes('`domaine/facturation`'), ecarts[0]);
  assert(ecarts[0].includes('aucun domaine'), ecarts[0]);
});

await test('an unknown feature is reported by its label', () => {
  const { ecarts } = checkPiste(
    labels('piste', 'domaine/acces', 'fonctionnalite/authentfication'),
    specification,
  );
  equal(ecarts.length, 1, 'number of discrepancies');
  assert(ecarts[0].includes('`fonctionnalite/authentfication`'), ecarts[0]);
  assert(ecarts[0].includes('aucune fonctionnalité'), ecarts[0]);
});

await test('a domain taken for a feature is reported: the identifier is not looked up elsewhere', () => {
  const { ecarts } = checkPiste(labels('piste', 'domaine/cadrage', 'fonctionnalite/acces'), specification);
  equal(ecarts.length, 1, 'number of discrepancies');
  assert(ecarts[0].includes('`fonctionnalite/acces`'), ecarts[0]);
});

await test('a label without identifier is reported, and does not count as a link', () => {
  const { ecarts } = checkPiste(labels('piste', 'domaine/'), specification);
  equal(ecarts.length, 2, 'number of discrepancies');
  assert(ecarts.some((e) => e.includes('`domaine/`') && e.includes('sans identifiant')), ecarts.join(' | '));
});

await test('an unknown label does not count as a link', () => {
  const { ecarts } = checkPiste(labels('piste', 'domaine/facturation'), specification);
  equal(ecarts.length, 2, 'number of discrepancies');
});

await test('labels are also read as plain names', () => {
  equal(checkPiste(['piste', 'domaine/acces'], specification).ecarts, []);
});

// --- the labels to create in a specification ---

await test('one link label per domain then per feature, in identifier order', () => {
  const names = etiquettesRattachementPiste(specification);
  equal(names.length, specification.domains.size + specification.features.size, 'number of labels');
  equal(names.slice(0, 2), ['domaine/acces', 'domaine/cadrage']);
  assert(names.includes('fonctionnalite/authentification'), names.join(', '));
  equal(names.filter((n) => n.startsWith('domaine/')).length, specification.domains.size, 'domains');
});

await test('each link label is accepted by the check', () => {
  for (const name of etiquettesRattachementPiste(specification))
    equal(checkPiste(['piste', name], specification).ecarts, [], name);
});

await test('the identifier comes from the frontmatter, not from the file name', () => {
  const root = mkdtempSync(join(tmpdir(), 'pistes-id-'));
  try {
    cpSync(FIXTURE, root, { recursive: true });
    writeFileSync(join(root, 'domains', 'Facturation-v2.md'), '---\nid: facturation\nnom: Facturation\n---\n');
    const names = etiquettesRattachementPiste(loadRepo(root));
    assert(names.includes('domaine/facturation'), names.join(', '));
    assert(!names.some((n) => /Facturation-v2/.test(n)), 'the file name does not make a label');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('on the command line, one label per line', () => {
  const lines = execFileSync('node', [LABELS_SCRIPT, FIXTURE]).toString().trim().split('\n');
  equal(lines, etiquettesRattachementPiste(specification));
});

await test('on the command line, a specification without domain or feature is an error', () => {
  const empty = mkdtempSync(join(tmpdir(), 'pistes-vide-'));
  try {
    let failed = false;
    try {
      execFileSync('node', [LABELS_SCRIPT, empty], { stdio: 'pipe' });
    } catch {
      failed = true;
    }
    assert(failed, 'the script must fail');
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

// --- the comment ---

const BOT = { type: 'Bot', login: 'github-actions[bot]' };
const HUMAN = { type: 'User', login: 'redactrice' };

await test('the comment carries the marker, each discrepancy, and the rule', () => {
  const body = corpsCommentairePiste(['écart A', 'écart B']);
  assert(body.startsWith(MARQUEUR_PISTE), 'the marker opens the comment');
  assert(body.includes('- écart A') && body.includes('- écart B'), body);
  assert(body.includes('RG-piste-rattachee'), body);
});

await test('without discrepancy or comment, nothing to do', () => {
  equal(planifierCommentairePiste([], []), { action: 'rien' });
});

await test('a first discrepancy creates the comment', () => {
  equal(planifierCommentairePiste([], ['écart A']), {
    action: 'creer',
    corps: corpsCommentairePiste(['écart A']),
  });
});

await test('a discrepancy already reported as is rewrites nothing', () => {
  const comments = [{ id: 7, user: BOT, body: corpsCommentairePiste(['écart A']) }];
  equal(planifierCommentairePiste(comments, ['écart A']), { action: 'rien' });
});

await test('a discrepancy that changes updates the existing comment, without adding one', () => {
  const comments = [{ id: 7, user: BOT, body: corpsCommentairePiste(['écart A']) }];
  equal(planifierCommentairePiste(comments, ['écart B']), {
    action: 'modifier',
    id: 7,
    corps: corpsCommentairePiste(['écart B']),
  });
});

await test('a roadmap item put back in order has its comment deleted', () => {
  const comments = [{ id: 7, user: BOT, body: corpsCommentairePiste(['écart A']) }];
  equal(planifierCommentairePiste(comments, []), { action: 'supprimer', id: 7 });
});

await test('the comment of a person who quotes the marker is never taken over', () => {
  const comments = [{ id: 3, user: HUMAN, body: corpsCommentairePiste(['écart A']) }];
  equal(planifierCommentairePiste(comments, []), { action: 'rien' });
  equal(planifierCommentairePiste(comments, ['écart A']).action, 'creer');
});

// --- the end-to-end check, on a simulated platform ---

/** An issue and its comments, as the platform would hold them. */
function platform(labelNames, comments = []) {
  const state = { labels: labels(...labelNames), comments: [...comments], next: 100 };
  return {
    state,
    api: {
      lireIssue: async () => ({ labels: state.labels }),
      listerCommentaires: async () => state.comments,
      creer: async (body) => state.comments.push({ id: state.next++, user: BOT, body }),
      modifier: async (id, body) => {
        state.comments.find((c) => c.id === id).body = body;
      },
      supprimer: async (id) => {
        state.comments = state.comments.filter((c) => c.id !== id);
      },
    },
  };
}

const botComments = (state) => state.comments.filter((c) => c.user.type === 'Bot');

await test('a roadmap item with valid labels receives no comment', async () => {
  const { state, api } = platform(['piste', 'domaine/acces']);
  const { ecarts } = await checkRoadmapItemEvent({ racine: FIXTURE, api });
  equal(ecarts, []);
  equal(state.comments.length, 0, 'comments');
});

await test('a roadmap item with unknown labels receives a comment that names them', async () => {
  const { state, api } = platform(['piste', 'domaine/facturation', 'fonctionnalite/export']);
  const { ecarts } = await checkRoadmapItemEvent({ racine: FIXTURE, api });
  equal(ecarts.length, 3, 'number of discrepancies');
  equal(botComments(state).length, 1, 'bot comments');
  assert(botComments(state)[0].body.includes('`domaine/facturation`'), 'the unknown domain is named');
  assert(botComments(state)[0].body.includes('`fonctionnalite/export`'), 'the unknown feature is named');
});

await test('a roadmap item without link receives a comment, a single one at each change', async () => {
  const { state, api } = platform(['piste'], [{ id: 1, user: HUMAN, body: 'Une idée.' }]);
  await checkRoadmapItemEvent({ racine: FIXTURE, api });
  state.labels = labels('piste', 'domaine/facturation');
  await checkRoadmapItemEvent({ racine: FIXTURE, api });
  equal(botComments(state).length, 1, 'bot comments');
  assert(botComments(state)[0].body.includes('`domaine/facturation`'), 'the comment is updated');
  equal(state.comments.length, 2, 'the author’s comment stays');
});

await test('a corrected roadmap item sees the comment disappear', async () => {
  const { state, api } = platform(['piste', 'domaine/facturation']);
  await checkRoadmapItemEvent({ racine: FIXTURE, api });
  state.labels = labels('piste', 'domaine/cadrage');
  await checkRoadmapItemEvent({ racine: FIXTURE, api });
  equal(state.comments.length, 0, 'comments');
});

await test('an issue that loses the piste label sees the comment disappear', async () => {
  const { state, api } = platform(['piste']);
  await checkRoadmapItemEvent({ racine: FIXTURE, api });
  state.labels = labels('bug');
  const { piste } = await checkRoadmapItemEvent({ racine: FIXTURE, api });
  equal(piste, false, 'piste');
  equal(state.comments.length, 0, 'comments');
});

// --- on the command line, as the Action calls it ---

const folder = mkdtempSync(join(tmpdir(), 'pistes-'));
const event = (name, content) => {
  const path = join(folder, name);
  writeFileSync(path, JSON.stringify(content));
  return path;
};
const run = (...args) =>
  execFileSync('node', [SCRIPT, ...args], { env: { ...process.env, GITHUB_OUTPUT: '' } }).toString();

await test('without commenting, the script reads the event, states the discrepancies and counts them', () => {
  const path = event('inconnu.json', {
    issue: { number: 12, labels: labels('piste', 'domaine/facturation') },
  });
  const output = run(FIXTURE, '--evenement', path, '--sans-commentaire');
  assert(output.includes('`domaine/facturation`'), output);
  assert(/^2 écart\(s\) de rattachement/m.test(output), output);
});

await test('without commenting, a roadmap item in order counts no discrepancy', () => {
  const path = event('valide.json', {
    issue: { number: 12, labels: labels('piste', 'fonctionnalite/historique') },
  });
  assert(/aucun écart de rattachement/.test(run(FIXTURE, '--evenement', path, '--sans-commentaire')), 'no discrepancy');
});

await test('an event without issue is not an error: nothing to check', () => {
  const path = event('push.json', { ref: 'refs/heads/main' });
  assert(/aucun écart de rattachement/.test(run(FIXTURE, '--evenement', path, '--sans-commentaire')), 'no discrepancy');
});


// --- coded anomalies, and the repo's language — RG-anomalies-codees, RG-langue-du-depot ---

/** The fixture, declared in English. */
function englishSpecification() {
  const root = mkdtempSync(join(tmpdir(), 'pistes-en-'));
  cpSync(FIXTURE, root, { recursive: true });
  appendFileSync(join(root, 'ssk-canon.yml'), '\nlangue: en\n');
  return root;
}

await test('each discrepancy is a coded anomaly, its params drawn from the labels', () => {
  const { anomalies, ecarts } = checkPiste(
    labels('piste', 'domaine/', 'fonctionnalite/export'),
    specification,
  );
  equal(
    anomalies.map((a) => [a.code, a.gravite]),
    [
      ['piste-non-rattachee', 'avertissement'],
      ['etiquette-piste-sans-identifiant', 'avertissement'],
      ['etiquette-piste-inconnue', 'avertissement'],
    ],
  );
  equal(anomalies[1].params, { etiquette: 'domaine/' });
  equal(anomalies[2].params.etiquette, 'fonctionnalite/export');
  equal(anomalies[2].params.collection, 'features');
  equal(ecarts, anomalies.map((a) => formaterAnomalie(a, 'fr')), 'the discrepancies are the anomalies said in French');
});

await test('a roadmap item in order carries no anomaly', () => {
  equal(checkPiste(labels('piste', 'domaine/acces'), specification).anomalies, []);
  equal(checkPiste(labels('bug'), specification).anomalies, []);
});

await test('the discrepancies are said in English, labels and identifiers as they are', () => {
  const { ecarts } = checkPiste(labels('piste', 'domaine/', 'domaine/facturation'), specification, 'en');
  equal(ecarts[0], 'the roadmap item is linked to no domain and no feature of the specification: ' +
    'it will appear nowhere — add a `domaine/<id>` or `fonctionnalite/<id>` label to it');
  equal(ecarts[1], 'the label `domaine/` has no identifier');
  equal(ecarts[2], 'the label `domaine/facturation` designates no domain of the specification — known domains: `acces`, `cadrage`, `persistance`, `referentiel`');
});

await test('the comment is said in English, marker first', () => {
  const body = corpsCommentairePiste(['gap A'], 'en');
  assert(body.startsWith(MARQUEUR_PISTE), 'the marker opens the comment');
  assert(body.includes('**This roadmap item is not properly linked to the specification.**'), body);
  assert(body.includes('- gap A') && body.includes('RG-piste-rattachee'), body);
  assert(!/piste se rattache/.test(body), body);
  equal(planifierCommentairePiste([], ['gap A'], 'en'), { action: 'creer', corps: body });
});

await test('a repo declared in English receives a comment in English', async () => {
  const root = englishSpecification();
  try {
    const { state, api } = platform(['piste', 'domaine/facturation']);
    const { anomalies } = await checkRoadmapItemEvent({ racine: root, api });
    equal(anomalies.map((a) => a.code), ['piste-non-rattachee', 'etiquette-piste-inconnue']);
    const body = botComments(state)[0].body;
    assert(body.includes('the label `domaine/facturation` designates no domain'), body);
    assert(body.includes('This roadmap item'), body);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('on the command line, a repo declared in English reads its warnings in English', () => {
  const root = englishSpecification();
  const d = mkdtempSync(join(tmpdir(), 'pistes-en-evt-'));
  try {
    const path = join(d, 'e.json');
    const runHere = (content) => {
      writeFileSync(path, JSON.stringify(content));
      return execFileSync('node', [SCRIPT, root, '--evenement', path, '--sans-commentaire'], {
        env: { ...process.env, GITHUB_OUTPUT: '' },
      }).toString();
    };
    const output = runHere({ issue: { number: 12, labels: labels('piste', 'domaine/facturation') } });
    assert(output.includes('::warning::#12 — the label `domaine/facturation` designates no domain'), output);
    assert(/^2 linking gap\(s\)$/m.test(output), output);
    equal(runHere({ issue: { number: 5, labels: labels('bug') } }),
      'Issue #5: not a roadmap item.\nno linking gap\n');
    equal(runHere({}), 'No issue in this event: nothing to check.\nno linking gap\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(d, { recursive: true, force: true });
  }
});

await test('an unknown language is reported, and the roadmap item is said in French', () => {
  const root = mkdtempSync(join(tmpdir(), 'pistes-xx-'));
  try {
    cpSync(FIXTURE, root, { recursive: true });
    appendFileSync(join(root, 'ssk-canon.yml'), '\nlangue: de\n');
    const path = join(root, 'e.json');
    writeFileSync(path, JSON.stringify({ issue: { number: 12, labels: labels('piste') } }));
    const output = execFileSync('node', [SCRIPT, root, '--evenement', path, '--sans-commentaire'], {
      env: { ...process.env, GITHUB_OUTPUT: '' },
    }).toString();
    assert(output.includes('::warning::ssk-canon.yml → langue « de »'), output);
    assert(output.includes("la piste n'est rattachée à aucun domaine"), output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test('on the command line, a repo without language keeps yesterday’s output, word for word', () => {
  const output = run(FIXTURE, '--evenement', fileURLToPath(new URL('./events/piste-mal-rattachee.json', import.meta.url)), '--sans-commentaire');
  equal(output,
    "::warning::#12 — l'étiquette `fonctionnalite/export` ne désigne aucune fonctionnalité du référentiel — " +
      'fonctionnalités connues : `authentification`, `autorisation`, `consultation-cadrage`, `cycle-vie-cadrage`, ' +
      '`historique`, `impacts-regles`, `modele-referentiel`, `pieces-jointes`, `redaction-cadrage`, `stockage-git`\n' +
      '1 écart(s) de rattachement\n');
});

rmSync(folder, { recursive: true, force: true });

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length > 0) process.exit(1);
