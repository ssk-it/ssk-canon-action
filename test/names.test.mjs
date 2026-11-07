// Tests of the declared names — RG-noms-declares.
//
// What they protect: a specification may name its agreed folders and files
// in `ssk-canon.yml`. The resolution lives here, once, for the check, the
// propagation and the application: two resolutions would end up reading two
// different specifications. A specification that declares nothing must read
// exactly as before, and a faulty declaration must never make it unreadable.
//
//   node test/names.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { resoudreNoms, verifierDossiersDeclares, NOMS_PAR_DEFAUT } from '../src/noms.mjs';
import { formaterAnomalie } from '../src/anomalies.mjs';
import { checkRepo } from '../src/verifier.mjs';
import { loadRepo } from '../src/parse.mjs';
import { check } from '../src/check.mjs';
import { propagate } from '../src/propagate.mjs';

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// The YAML is written as an author would write it, then read as loading reads
// it: that is the form that reaches the resolution.
//
// Faults are coded anomalies; most cases read their French message, as the
// check renders it, and the codes stay at hand in `anomalies`.
const fr = (anomalies) => anomalies.map((a) => formaterAnomalie(a, 'fr'));
const declare = (yaml) => {
  const r = resoudreNoms(loadYaml(yaml));
  return { ...r, anomalies: r.erreurs, erreurs: fr(r.erreurs) };
};

// --- the resolution ---

await test('without declaration, the format’s names', () => {
  for (const config of [null, undefined, {}, { schema_version: 1 }]) {
    const { dossiers, fichiers, erreurs } = resoudreNoms(config);
    assert(!erreurs.length, erreurs.join(' | '));
    assert(JSON.stringify(dossiers) === JSON.stringify(NOMS_PAR_DEFAUT.dossiers), JSON.stringify(dossiers));
    assert(JSON.stringify(fichiers) === JSON.stringify(NOMS_PAR_DEFAUT.fichiers), JSON.stringify(fichiers));
  }
});

await test('the format’s names are today’s', () => {
  const { dossiers, fichiers } = NOMS_PAR_DEFAUT;
  assert(dossiers.domaines === 'domains' && dossiers.fonctionnalites === 'features', 'domains');
  assert(dossiers.regles === 'rules' && dossiers.cadrages === 'cadrages', 'rules');
  assert(dossiers.decisions === 'decisions' && dossiers.architecture === 'architecture', 'architecture');
  assert(dossiers.identite === 'identite' && dossiers.decisions_cadrage === 'decisions', 'identity');
  assert(fichiers.cadrage === 'cadrage.md' && fichiers.pieces_jointes === 'attachments.md', 'files');
});

await test('a partial declaration keeps the format for the rest', () => {
  const { dossiers, fichiers, erreurs } = declare(
    'dossiers:\n  regles: exigences\n  cadrages: evolutions\n  decisions_cadrage: arbitrages\n' +
      'fichiers:\n  cadrage: evolution.md\n',
  );
  assert(!erreurs.length, erreurs.join(' | '));
  assert(dossiers.regles === 'exigences', dossiers.regles);
  assert(dossiers.cadrages === 'evolutions', dossiers.cadrages);
  assert(dossiers.decisions_cadrage === 'arbitrages', dossiers.decisions_cadrage);
  assert(dossiers.features === undefined && dossiers.fonctionnalites === 'features', dossiers.fonctionnalites);
  assert(fichiers.cadrage === 'evolution.md', fichiers.cadrage);
  assert(fichiers.pieces_jointes === 'attachments.md', fichiers.pieces_jointes);
});

await test('the decisions folder of a scoping may bear the name of the ADR folder', () => {
  // They do not live in the same place: one at the root, the other in a scoping.
  const { erreurs } = declare('dossiers:\n  decisions: adr\n  decisions_cadrage: adr\n');
  assert(!erreurs.length, erreurs.join(' | '));
});

for (const [kase, yaml, expected] of [
  ['an empty name', "dossiers:\n  regles: ''\n", /dossiers\.regles.*vide/],
  ['a missing name', 'dossiers:\n  regles:\n', /dossiers\.regles.*vide/],
  ['a number', 'dossiers:\n  regles: 12\n', /dossiers\.regles.*chaîne/],
  ['a path', 'dossiers:\n  regles: docs/regles\n', /dossiers\.regles.*«\s?\/\s?»/],
  ['a hidden name', 'dossiers:\n  regles: .regles\n', /dossiers\.regles.*«\s?\.\s?»/],
  ['a parent', 'dossiers:\n  regles: ..\n', /dossiers\.regles/],
  ['an unknown key', 'dossiers:\n  regle: exigences\n', /dossiers\.regle.*inconnue/],
  ['a file without .md', 'fichiers:\n  cadrage: evolution.txt\n', /fichiers\.cadrage.*\.md/],
]) {
  await test(`${kase} is discarded and reported`, () => {
    const { dossiers, fichiers, erreurs } = declare(yaml);
    assert(erreurs.length === 1, `${erreurs.length} error(s): ${erreurs.join(' | ')}`);
    assert(expected.test(erreurs[0]), `message: ${erreurs[0]}`);
    assert(erreurs[0].startsWith('ssk-canon.yml'), `the file is not named: ${erreurs[0]}`);
    assert(dossiers.regles === 'rules', `rules: ${dossiers.regles}`);
    assert(fichiers.cadrage === 'cadrage.md', `scoping: ${fichiers.cadrage}`);
  });
}

await test('a block that is not a table is discarded entirely', () => {
  const { dossiers, erreurs } = declare('dossiers: [regles, exigences]\n');
  assert(erreurs.length === 1 && /dossiers/.test(erreurs[0]), erreurs.join(' | '));
  assert(dossiers.regles === 'rules', dossiers.regles);
});

await test('two folders declared under the same name are both discarded', () => {
  const { dossiers, erreurs } = declare('dossiers:\n  regles: contenu\n  domaines: contenu\n');
  assert(dossiers.regles === 'rules' && dossiers.domaines === 'domains', JSON.stringify(dossiers));
  assert(erreurs.length === 2, erreurs.join(' | '));
  assert(erreurs.every((e) => e.includes('« contenu »')), erreurs.join(' | '));
});

await test('a folder declared under another one’s default name is discarded', () => {
  const { dossiers, erreurs } = declare('dossiers:\n  cadrages: features\n');
  assert(dossiers.cadrages === 'cadrages' && dossiers.fonctionnalites === 'features', JSON.stringify(dossiers));
  assert(erreurs.length === 1 && /dossiers\.cadrages/.test(erreurs[0]), erreurs.join(' | '));
});

await test('a folder declared under the identity’s name is discarded', () => {
  const { dossiers, erreurs } = declare('dossiers:\n  regles: identite\n');
  assert(dossiers.regles === 'rules', dossiers.regles);
  assert(erreurs.length === 1, erreurs.join(' | '));
});

await test('the two files of a scoping under the same name are discarded', () => {
  const { fichiers, erreurs } = declare('fichiers:\n  cadrage: fiche.md\n  pieces_jointes: fiche.md\n');
  assert(fichiers.cadrage === 'cadrage.md' && fichiers.pieces_jointes === 'attachments.md', JSON.stringify(fichiers));
  assert(erreurs.length === 2, erreurs.join(' | '));
});

await test('a faulty entry does not take the others with it', () => {
  const { dossiers, erreurs } = declare("dossiers:\n  regles: exigences\n  identite: ''\n");
  assert(dossiers.regles === 'exigences', dossiers.regles);
  assert(dossiers.identite === 'identite', dossiers.identite);
  assert(erreurs.length === 1, erreurs.join(' | '));
});

// --- a folder that changes name ---

await test('a declared folder not found while the old one exists is an error', () => {
  const names = declare('dossiers:\n  regles: besoins\n');
  const errors = fr(verifierDossiersDeclares(names, ['rules/RG-a.md', 'domains/d.md']));
  assert(errors.length === 1, errors.join(' | '));
  assert(errors[0].includes('besoins/') && errors[0].includes('rules/'), errors[0]);
});

await test('a declared folder that exists says nothing, even if the old one exists too', () => {
  const names = declare('dossiers:\n  regles: besoins\n');
  assert(!verifierDossiersDeclares(names, ['besoins/RG-a.md']).length, 'besoins alone');
  assert(!verifierDossiersDeclares(names, []).length, 'empty specification');
});

await test('a scoping file left under the old name is an error', () => {
  const names = declare('dossiers:\n  decisions_cadrage: arbitrages\nfichiers:\n  cadrage: evolution.md\n');
  const errors = fr(
    verifierDossiersDeclares(names, [
      'cadrages/2026-001/cadrage.md',
      'cadrages/2026-001/decisions/01-x.md',
      'cadrages/2026-002/evolution.md',
      'cadrages/2026-002/arbitrages/01-x.md',
    ]),
  );
  assert(errors.length === 2, errors.join(' | '));
  assert(errors.some((e) => e.includes('cadrages/2026-001/evolution.md')), errors.join(' | '));
  assert(errors.some((e) => e.includes('cadrages/2026-001/arbitrages/')), errors.join(' | '));
});

await test('the check reports the faulty declaration', () => {
  const repo = {
    config: loadYaml("dossiers:\n  regles: ''\n"),
    domains: new Map(),
    features: new Map(),
    rules: new Map(),
    cadrages: new Map(),
  };
  const { errors } = checkRepo(repo);
  assert(errors.some((e) => /dossiers\.regles/.test(e)), errors.join(' | '));
});

await test('the check reports a renamed folder, when given the paths', () => {
  const repo = {
    config: loadYaml('dossiers:\n  regles: besoins\n'),
    domains: new Map(),
    features: new Map(),
    rules: new Map(),
    cadrages: new Map(),
    chemins: ['rules/RG-a.md'],
  };
  const { errors } = checkRepo(repo);
  assert(errors.some((e) => e.includes('besoins/')), errors.join(' | '));
});

// --- coded anomalies — RG-anomalies-codees ---

// What a resolution reports, by code, and its message in a language.
const codes = (anomalies) => anomalies.map((a) => a.code);
const en = (anomalies) => anomalies.map((a) => formaterAnomalie(a, 'en'));

await test('each fault in a name has its code', () => {
  const r = declare(
    "dossiers:\n  regles: ''\n  cadrages: 3\n  domaines: ' d '\n  fonctionnalites: a/b\n  decisions: .adr\n" +
      'fichiers:\n  cadrage: evolution.txt\n',
  );
  assert(
    JSON.stringify(codes(r.anomalies)) ===
      JSON.stringify(['nom-vide', 'nom-non-chaine', 'nom-borde-d-espaces', 'nom-chemin', 'nom-commence-par-point', 'nom-fichier-non-markdown']),
    codes(r.anomalies).join(' | '),
  );
  assert(r.anomalies.every((a) => a.gravite === 'erreur'), 'severity');
  assert(r.erreurs[0] === 'ssk-canon.yml → dossiers.regles : nom vide — « rules » est retenu', r.erreurs[0]);
  assert(
    JSON.stringify(en(r.anomalies)) ===
      JSON.stringify([
        'ssk-canon.yml → dossiers.regles: empty name — “rules” is kept',
        'ssk-canon.yml → dossiers.cadrages: expected a string — “cadrages” is kept',
        'ssk-canon.yml → dossiers.domaines: name with leading or trailing spaces — “domains” is kept',
        'ssk-canon.yml → dossiers.fonctionnalites: a name, not a path: no “/” — “features” is kept',
        'ssk-canon.yml → dossiers.decisions: must not start with “.” — “decisions” is kept',
        'ssk-canon.yml → fichiers.cadrage: a Markdown file, ending in “.md” — “cadrage.md” is kept',
      ]),
    en(r.anomalies).join(' | '),
  );
});

await test('an expected table, an unknown key, a duplicate name: one code each, in English too', () => {
  const table = declare('dossiers: rules\n');
  assert(codes(table.anomalies).join() === 'noms-bloc-non-table', codes(table.anomalies).join());
  assert(
    en(table.anomalies)[0] === 'ssk-canon.yml → dossiers: expected a table of names — the format’s names are kept',
    en(table.anomalies)[0],
  );
  const key = declare('fichiers:\n  piece: a.md\n');
  assert(codes(key.anomalies).join() === 'nom-cle-inconnue', codes(key.anomalies).join());
  assert(
    en(key.anomalies)[0] === 'ssk-canon.yml → fichiers.piece: unknown key — expected one of cadrage, pieces_jointes',
    en(key.anomalies)[0],
  );
  const duplicate = declare('dossiers:\n  regles: exigences\n  domaines: exigences\n');
  assert(codes(duplicate.anomalies).join() === 'nom-en-double,nom-en-double', codes(duplicate.anomalies).join());
  assert(
    en(duplicate.anomalies)[0] ===
      'ssk-canon.yml → dossiers.domaines: “exigences” is also the name of dossiers.regles — “domains” is kept',
    en(duplicate.anomalies).join(' | '),
  );
});

await test('a folder or a file left under the old name: one code each, in English too', () => {
  const names = declare('dossiers:\n  regles: besoins\nfichiers:\n  cadrage: evolution.md\n');
  const paths = ['rules/RG-a.md', 'cadrages/2026-001/cadrage.md'];
  const anomalies = verifierDossiersDeclares(names, paths);
  assert(codes(anomalies).join() === 'dossier-declare-introuvable,nom-de-cadrage-introuvable', codes(anomalies).join());
  assert(anomalies.every((a) => a.gravite === 'erreur'), 'severity');
  assert(
    JSON.stringify(en(anomalies)) ===
      JSON.stringify([
        'ssk-canon.yml → dossiers.regles: “besoins/” not found, while “rules/” exists — ' +
          'a folder is not renamed, its name is chosen at creation',
        'cadrages/2026-001/evolution.md: not found, while “cadrages/2026-001/cadrage.md” exists ' +
          '(ssk-canon.yml → fichiers.cadrage) — a name is chosen at creation',
      ]),
    en(anomalies).join(' | '),
  );
});

// --- reading, check and propagation under the declared names ---

function git(root, args) {
  execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
}

const CLIENT_CONFIG =
  'schema_version: 1\n' +
  'dossiers:\n  domaines: domaines\n  fonctionnalites: fonctionnalites\n  regles: exigences\n' +
  '  cadrages: evolutions\n  decisions_cadrage: arbitrages\n  identite: marque\n' +
  'fichiers:\n  cadrage: evolution.md\n  pieces_jointes: pieces-jointes.md\n';

/** A specification under a client's names, with a delivered scoping. */
function clientSpecification(fn) {
  const root = mkdtempSync(join(tmpdir(), 'pc-noms-'));
  try {
    writeFileSync(join(root, 'ssk-canon.yml'), CLIENT_CONFIG);
    for (const d of ['domaines', 'fonctionnalites', 'exigences', 'evolutions/2026-001/arbitrages', 'marque'])
      mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, 'domaines/d.md'), '---\nid: d\nnom: D\n---\n\nUn domaine.\n');
    writeFileSync(join(root, 'fonctionnalites/f.md'), '---\nid: f\nnom: F\ndomaines: [d]\n---\n\nF.\n');
    writeFileSync(
      join(root, 'exigences/RG-a.md'),
      '---\nid: RG-a\nfonctionnalites: [f]\nstatut: actif\ncree_par: null\nmodifie_par: []\n---\n\nÀ propager.\n',
    );
    writeFileSync(
      join(root, 'evolutions/2026-001/evolution.md'),
      '---\nid: 2026-001\ntitre: Une évolution\ndomaines: [d]\nimpacts:\n  - { regle: RG-a, operation: cree }\n---\n\n' +
        '## Objectif\n\nUn objectif.\n\n## Énoncés\n\n### RG-a\n\nLe texte livré.\n',
    );
    writeFileSync(
      join(root, 'evolutions/2026-001/arbitrages/01-x.md'),
      '---\nid: 01-x\ntitre: Une question\nstatut: retenue\noption_retenue: a\n---\n\nTexte.\n',
    );
    writeFileSync(
      join(root, 'evolutions/2026-001/pieces-jointes.md'),
      `---\nattachments:\n  - { nom: plan.pdf, sha256: ${'a'.repeat(64)} }\n---\n`,
    );
    writeFileSync(join(root, 'marque/symbole.svg'), '<svg/>');
    git(root, ['init', '-q', '-b', 'main']);
    git(root, ['config', 'user.email', 'test@exemple.fr']);
    git(root, ['config', 'user.name', 'Test']);
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', 'livraison']);
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

await test('loading reads the entities under the declared names', () =>
  clientSpecification((root) => {
    const repo = loadRepo(root);
    assert(!repo.errors.length, repo.errors.join(' | '));
    assert(repo.domains.has('d') && repo.features.has('f') && repo.rules.has('RG-a'), 'entities');
    const c = repo.cadrages.get('2026-001');
    assert(c, 'scoping not found');
    assert(c.path === join('evolutions', '2026-001', 'evolution.md'), c.path);
    assert(c.decisions.length === 1 && c.decisions[0].id === '01-x', JSON.stringify(c.decisions));
    assert(c.attachments.length === 1, JSON.stringify(c.attachments));
    assert(repo.identite.length === 1 && repo.identite[0].chemin === 'symbole.svg', JSON.stringify(repo.identite));
  }));

await test('the folders under the format’s names are no longer read, once renamed', () =>
  clientSpecification((root) => {
    mkdirSync(join(root, 'rules'));
    writeFileSync(join(root, 'rules/RG-z.md'), '---\nid: RG-z\n---\n\nVestige.\n');
    const repo = loadRepo(root);
    assert(!repo.rules.has('RG-z'), 'rules/ read');
  }));

await test('the check passes, delivery included', () =>
  clientSpecification((root) => {
    const { errors } = check(root, { base: 'HEAD', livraison: true, ignorerIndexDerives: true });
    assert(!errors.length, errors.join(' | '));
  }));

await test('a scoping delivered under the declared name is seen as delivered', () =>
  clientSpecification((root) => {
    // delivered, it must find its created rule: without it, the error proves it
    rmSync(join(root, 'exigences/RG-a.md'));
    const { errors } = check(root, { base: 'HEAD' });
    assert(errors.some((e) => /règle inconnue : RG-a/.test(e)), errors.join(' | '));
  }));

await test('modifying a scoping delivered under the declared name is refused', () =>
  clientSpecification((root) => {
    writeFileSync(join(root, 'evolutions/2026-001/arbitrages/02-y.md'), '---\nid: 02-y\n---\n\nAjout.\n');
    git(root, ['checkout', '-q', '-b', 'suite']);
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', 'suite']);
    const { errors } = check(root, { base: 'main' });
    assert(errors.some((e) => /2026-001 : livré, donc figé/.test(e)), errors.join(' | '));
  }));

await test('a name changed relative to the base is refused', () =>
  clientSpecification((root) => {
    writeFileSync(join(root, 'ssk-canon.yml'), CLIENT_CONFIG.replace('regles: exigences', 'regles: besoins'));
    const { errors } = check(root, { base: 'HEAD' });
    assert(errors.some((e) => /dossiers\.regles.*« exigences ».*« besoins »/.test(e)), errors.join(' | '));
  }));

await test('an internal name changed relative to the base is refused', () =>
  clientSpecification((root) => {
    writeFileSync(join(root, 'ssk-canon.yml'), CLIENT_CONFIG.replace('cadrage: evolution.md', 'cadrage: fiche.md'));
    const { errors } = check(root, { base: 'HEAD' });
    assert(errors.some((e) => /fichiers\.cadrage.*« evolution\.md »/.test(e)), errors.join(' | '));
  }));

await test('naming a folder that does not exist yet is allowed', () =>
  clientSpecification((root) => {
    const config = CLIENT_CONFIG.replace('  identite: marque\n', '  identite: marque\n  architecture: conception\n');
    writeFileSync(join(root, 'ssk-canon.yml'), config);
    const { errors } = check(root, { base: 'HEAD', ignorerIndexDerives: true });
    assert(!errors.length, errors.join(' | '));
  }));

await test('loading reports a folder renamed away from the format’s name', () =>
  clientSpecification((root) => {
    git(root, ['mv', 'exigences', 'rules']);
    const { errors } = check(root, { livres: new Set() });
    assert(errors.some((e) => e.includes('exigences/') && e.includes('rules/')), errors.join(' | '));
  }));

await test('the propagation writes into the declared folder', () =>
  clientSpecification((root) => {
    const r = propagate(root);
    assert(r.ok, r.problemes.join(' | '));
    assert(readFileSync(join(root, 'exigences/RG-a.md'), 'utf8').includes('Le texte livré.'), 'not propagated');
    assert(!existsSync(join(root, 'rules')), 'rules/ created');
  }));

await test('the identity is checked under its declared name', () =>
  clientSpecification((root) => {
    writeFileSync(join(root, 'marque/symbol.svg'), '<svg/>');
    const { errors } = check(root, { livres: new Set() });
    assert(errors.some((e) => e.includes('marque/symbol.svg')), errors.join(' | '));
  }));

console.log(`${passed} passed, ${failures.length} failure(s)`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length > 0) process.exit(1);
