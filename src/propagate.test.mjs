// Tests du propagateur, sur des référentiels jetables construits en mémoire.
//
// Ce que ces cas protègent : le propagateur écrit dans le référentiel, donc une
// régression y est coûteuse. On vérifie surtout ce qui n'est pas évident —
// l'idempotence, le tout-ou-rien, et le fait qu'un cadrage non livré n'écrit rien.
//
// Chaque référentiel jetable est un vrai dépôt Git : la livraison ne se déclare
// plus dans un fichier, elle se lit de l'état du dépôt. Un cadrage est livré
// quand `HEAD` le porte — le simuler autrement testerait autre chose que ce qui
// s'exécute.
//
//   node src/propagate.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { propager, etatAttendu } from './propagate.mjs';
import { check } from './check.mjs';
import { loadRepo } from './parse.mjs';

let reussis = 0;
const echecs = [];

function test(nom, fn) {
  const racine = mkdtempSync(join(tmpdir(), 'pc-'));
  try {
    for (const d of ['domains', 'features', 'rules', 'cadrages']) {
      mkdirSync(join(racine, d), { recursive: true });
    }
    writeFileSync(join(racine, 'ssk-canon.yml'), 'schema_version: 1\n');
    git(racine, ['init', '-q', '-b', 'main']);
    git(racine, ['config', 'user.email', 'test@exemple.fr']);
    git(racine, ['config', 'user.name', 'Test']);
    fn(racine);
    reussis++;
  } catch (e) {
    echecs.push(`${nom} : ${e.message}`);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(racine, args) {
  execFileSync('git', ['-C', racine, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
}

/** Livre ce qui est écrit : un cadrage n'est livré que si `HEAD` le porte. */
function livrer(racine) {
  git(racine, ['add', '-A']);
  git(racine, ['commit', '-q', '-m', 'livraison']);
}

/** Écrit un référentiel minimal : un domaine, une fonctionnalité. */
function socle(racine) {
  writeFileSync(join(racine, 'domains/d.md'), '---\nid: d\nnom: D\n---\n\nUn domaine.\n');
  writeFileSync(
    join(racine, 'features/f.md'),
    '---\nid: f\nnom: F\ndomaines: [d]\n---\n\nUne fonctionnalité.\n',
  );
}

function ecrireCadrage(racine, id, livre, impacts, enonces = {}) {
  mkdirSync(join(racine, 'cadrages', id), { recursive: true });
  const lignesImpacts = impacts
    .map((i) => `  - { regle: ${i.regle}, operation: ${i.operation} }`)
    .join('\n');
  const sections = Object.entries(enonces)
    .map(([r, t]) => `### ${r}\n\n${t}\n`)
    .join('\n');
  writeFileSync(
    join(racine, 'cadrages', id, 'cadrage.md'),
    `---\nid: ${id}\ntitre: Cadrage ${id}\ndomaines: [d]\nimpacts:\n${lignesImpacts}\n---\n\n## Objectif\n\nUn objectif.\n\n## Énoncés\n\n${sections}`,
  );
  // La livraison est un fait du dépôt : seul un cadrage commité est livré.
  if (livre === 'livree' || livre === true) livrer(racine);
}

function ecrireRegle(racine, id, corps, frontmatter = {}) {
  const fm = {
    id,
    fonctionnalites: '[f]',
    statut: 'actif',
    cree_par: 'null',
    modifie_par: '[]',
    ...frontmatter,
  };
  const lignes = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n');
  writeFileSync(join(racine, 'rules', `${id}.md`), `---\n${lignes}\n---\n\n${corps}\n`);
}

// --- l'écriture elle-même ---

test('applique un énoncé au référentiel', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Texte périmé.');
  ecrireCadrage(racine, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Le texte attendu.',
  });

  const r = propager(racine);
  assert(r.ok, `échec inattendu : ${r.problemes.join(', ')}`);
  assert(r.ecritures.length === 1, `une écriture attendue, ${r.ecritures.length} obtenue(s)`);

  const ecrit = readFileSync(join(racine, 'rules/RG-a.md'), 'utf8');
  assert(ecrit.includes('Le texte attendu.'), 'énoncé non appliqué');
  assert(ecrit.includes('cree_par: 2026-001'), 'index cree_par non renseigné');
});

test('est idempotent : ne réécrit pas un référentiel à jour', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Périmé.');
  ecrireCadrage(racine, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'À jour.',
  });

  propager(racine);
  const second = propager(racine);
  assert(second.ok, 'second passage en échec');
  assert(second.ecritures.length === 0, `${second.ecritures.length} écriture(s) au second passage`);
});

test('un cadrage non livré n’écrit rien', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Inchangé.');
  ecrireCadrage(racine, '2026-001', 'en_relecture', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Ne doit pas être appliqué.',
  });

  const r = propager(racine);
  assert(r.ok, `échec inattendu : ${r.problemes.join(', ')}`);
  assert(r.ecritures.length === 0, 'un cadrage en relecture a écrit');
  assert(
    readFileSync(join(racine, 'rules/RG-a.md'), 'utf8').includes('Inchangé.'),
    'la règle a été modifiée',
  );
});

test('une abrogation change le statut sans supprimer le fichier', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Texte.', { cree_par: '2026-001' });
  ecrireCadrage(racine, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Texte.',
  });
  ecrireCadrage(racine, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'abroge' }], {
    'RG-a': 'Abrogée : remplacée par autre chose.',
  });

  const r = propager(racine);
  assert(r.ok, `échec inattendu : ${r.problemes.join(', ')}`);
  const ecrit = readFileSync(join(racine, 'rules/RG-a.md'), 'utf8');
  assert(ecrit.includes('statut: abroge'), 'statut non passé à abrogé');
  assert(ecrit.includes('Abrogée'), 'énoncé d’abrogation non appliqué');
  assert(ecrit.includes('modifie_par'), 'index modifie_par absent');
});

test('l’opération « touche » ne produit aucune écriture', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Texte.', { cree_par: '2026-001' });
  ecrireCadrage(racine, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Texte.',
  });
  ecrireCadrage(racine, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'touche' }], {});

  const r = propager(racine);
  assert(r.ok, `échec inattendu : ${r.problemes.join(', ')}`);
  assert(r.ecritures.length === 0, '« touche » a produit une écriture');
});

// --- le tout ou rien ---

test('n’écrit rien si un énoncé manque', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Intact.', { cree_par: '2026-001' });
  ecrireRegle(racine, 'RG-b', 'Intact aussi.', { cree_par: '2026-001' });
  // RG-b est déclarée modifiée mais sans énoncé : le lot entier doit échouer
  ecrireCadrage(
    racine,
    '2026-001',
    'livree',
    [
      { regle: 'RG-a', operation: 'cree' },
      { regle: 'RG-b', operation: 'cree' },
    ],
    { 'RG-a': 'Nouveau texte de A.' },
  );

  const r = propager(racine);
  assert(!r.ok, 'la propagation aurait dû échouer');
  assert(r.ecritures.length === 0, 'des écritures ont été produites malgré l’échec');
  assert(
    readFileSync(join(racine, 'rules/RG-a.md'), 'utf8').includes('Intact.'),
    'RG-a a été écrite alors que le lot devait échouer',
  );
});

test('n’écrit rien si le référentiel est incohérent', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Intact.', { cree_par: '2026-001' });
  // impact vers une règle inexistante : la vérification d'intégrité doit bloquer
  ecrireCadrage(
    racine,
    '2026-001',
    'livree',
    [
      { regle: 'RG-a', operation: 'cree' },
      { regle: 'RG-inexistante', operation: 'modifie' },
    ],
    { 'RG-a': 'Nouveau.', 'RG-inexistante': 'Texte.' },
  );

  const r = propager(racine);
  assert(!r.ok, 'la propagation aurait dû échouer sur l’intégrité');
  assert(
    readFileSync(join(racine, 'rules/RG-a.md'), 'utf8').includes('Intact.'),
    'une écriture a eu lieu malgré l’incohérence',
  );
});

// --- l'ordre de livraison ---

test('le dernier cadrage livré fait foi sur l’énoncé', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Ancien.', { cree_par: '2026-001' });
  ecrireCadrage(racine, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Premier énoncé.',
  });
  ecrireCadrage(racine, '2026-002', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Second énoncé, qui fait foi.',
  });

  propager(racine);
  const ecrit = readFileSync(join(racine, 'rules/RG-a.md'), 'utf8');
  assert(ecrit.includes('Second énoncé'), 'le dernier énoncé ne fait pas foi');
  assert(!ecrit.includes('Premier énoncé'), 'l’ancien énoncé subsiste');
  // et l'énoncé d'époque reste dans le cadrage d'origine
  const repo = loadRepo(racine);
  assert(
    repo.cadrages.get('2026-001').body.includes('Premier énoncé'),
    'l’énoncé d’époque a été perdu',
  );
});

test('l’état attendu ignore les cadrages non livrés', (racine) => {
  socle(racine);
  ecrireCadrage(racine, '2026-001', 'brouillon', [{ regle: 'RG-z', operation: 'cree' }], {
    'RG-z': 'Texte.',
  });
  // rien n'est commité : aucun cadrage n'est livré
  const attendu = etatAttendu(loadRepo(racine), new Set());
  assert(attendu.size === 0, `${attendu.size} règle(s) attendue(s) pour un seul brouillon`);
});

// --- frontmatter illisible ---
//
// Un YAML invalide levait une exception qui traversait tout : le lecteur
// recevait une trace de pile sans savoir quel fichier reprendre. Ces cas
// vérifient qu'il est signalé, situé, et qu'il n'arrête pas le chargement.

test('signale un frontmatter illisible sans lever', (racine) => {
  socle(racine);
  // le cas rencontré en usage : un « : » non quoté dans une valeur
  writeFileSync(
    join(racine, 'rules', 'RG-casse.md'),
    '---\nid: RG-casse\ntitre: Un titre : avec deux-points\n---\n\nTexte.\n',
  );

  const { errors } = loadRepo(racine);
  const erreur = errors.find((e) => e.includes('RG-casse.md'));
  assert(erreur, `aucune erreur pour le fichier cassé : ${errors.join(' | ')}`);
  assert(/ligne \d+/.test(erreur), `l'erreur ne situe pas la ligne : ${erreur}`);
});

test('charge les autres fichiers malgré un fichier illisible', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-saine', 'Texte.');
  writeFileSync(join(racine, 'rules', 'RG-casse.md'), '---\nstatut: [actif\n---\n\nTexte.\n');

  const repo = loadRepo(racine);
  assert(repo.rules.has('RG-saine'), 'une règle saine a été perdue à cause d’un fichier cassé');
});

test('signale une décision illisible une seule fois', (racine) => {
  socle(racine);
  ecrireCadrage(racine, '2026-001', 'livree', []);
  mkdirSync(join(racine, 'cadrages', '2026-001', 'decisions'), { recursive: true });
  writeFileSync(
    join(racine, 'cadrages', '2026-001', 'decisions', '01-x.md'),
    '---\ntitre: Choisir : ceci ou cela\n---\n\nTexte.\n',
  );

  const { errors } = loadRepo(racine);
  const pour = errors.filter((e) => e.includes('01-x.md'));
  assert(pour.length === 1, `${pour.length} erreur(s) pour un seul fichier`);
});

test('n’écrit rien quand un fichier est illisible', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'Ancien.');
  ecrireCadrage(racine, '2026-001', 'livree', [{ regle: 'RG-a', operation: 'modifie' }], {
    'RG-a': 'Nouveau.',
  });
  writeFileSync(join(racine, 'rules', 'RG-casse.md'), '---\nstatut: [actif\n---\n\nTexte.\n');

  const { ok } = propager(racine, { dryRun: false });
  assert(!ok, 'la propagation a accepté d’écrire malgré un fichier illisible');
  assert(
    readFileSync(join(racine, 'rules', 'RG-a.md'), 'utf8').includes('Ancien.'),
    'une écriture a eu lieu alors qu’un fichier était illisible',
  );
});

test('un README dans un répertoire de contenu n’est pas une entité', (racine) => {
  socle(racine);
  // il explique ce que le répertoire attend, à qui ouvre le dépôt sur la
  // plateforme — le traiter comme une entité ferait échouer sur de la
  // documentation
  writeFileSync(join(racine, 'rules', 'README.md'), '# Règles\n\nCe qu’on dépose ici.\n');

  const { errors } = loadRepo(racine);
  assert(!errors.length, `README signalé : ${errors.join(' | ')}`);
});

// --- statut déduit, et immuabilité d'un cadrage livré ---
//
// Le statut n'est plus déclaré : ces cas vérifient que le dépôt seul l'établit,
// et qu'un cadrage livré ne se reprend plus. C'est ce qui a manqué quand un
// cadrage a été fusionné en portant « brouillon » sans que rien ne le signale.

test('un statut déclaré dans le fichier est refusé', (racine) => {
  socle(racine);
  mkdirSync(join(racine, 'cadrages', '2026-001'), { recursive: true });
  writeFileSync(
    join(racine, 'cadrages', '2026-001', 'cadrage.md'),
    '---\nid: 2026-001\ntitre: T\nstatut: livree\ndomaines: [d]\nimpacts: []\n---\n\n## Objectif\n\nUn objectif.\n',
  );
  livrer(racine);

  const { errors } = check(racine, { base: 'HEAD' });
  assert(
    errors.some((e) => e.includes('le statut ne se déclare pas')),
    `statut déclaré accepté : ${errors.join(' | ')}`,
  );
});

test('un cadrage est livré du seul fait que le dépôt le porte', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'À propager.');
  ecrireCadrage(racine, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });

  const r = propager(racine);
  assert(r.ok, `propagation refusée : ${r.problemes.join(' | ')}`);
  assert(
    readFileSync(join(racine, 'rules/RG-a.md'), 'utf8').includes('Un énoncé.'),
    'un cadrage commité n’a pas été tenu pour livré',
  );
});

test('modifier un cadrage livré est refusé', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'À propager.');
  ecrireCadrage(racine, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', racine, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // on reprend le cadrage après sa livraison, ce que RG-cadrage-livre-immuable interdit
  writeFileSync(
    join(racine, 'cadrages', '2026-001', 'cadrage.md'),
    readFileSync(join(racine, 'cadrages', '2026-001', 'cadrage.md'), 'utf8') + '\nAjout tardif.\n',
  );
  livrer(racine);

  const { errors } = check(racine, { base });
  assert(
    errors.some((e) => e.includes('livré, donc figé')),
    `modification d’un cadrage livré acceptée : ${errors.join(' | ')}`,
  );
});

test('ajouter une décision à un cadrage livré est refusé', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'À propager.');
  ecrireCadrage(racine, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', racine, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // l'ajout n'a été relu par personne, alors que la validation portait sur ce
  // qui était présent au moment où elle a été donnée
  mkdirSync(join(racine, 'cadrages', '2026-001', 'decisions'), { recursive: true });
  writeFileSync(
    join(racine, 'cadrages', '2026-001', 'decisions', '01-tardive.md'),
    '---\nid: 01-tardive\ntitre: Tardive\nstatut: retenue\n---\n\nAprès coup.\n',
  );
  livrer(racine);

  const { errors } = check(racine, { base });
  assert(
    errors.some((e) => e.includes('livré, donc figé')),
    `décision ajoutée après livraison acceptée : ${errors.join(' | ')}`,
  );
});

test('un cadrage non livré se modifie librement', (racine) => {
  socle(racine);
  ecrireRegle(racine, 'RG-a', 'À propager.');
  ecrireCadrage(racine, '2026-001', true, [{ regle: 'RG-a', operation: 'cree' }], {
    'RG-a': 'Un énoncé.',
  });
  const base = execFileSync('git', ['-C', racine, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  ecrireCadrage(racine, '2026-002', true, [{ regle: 'RG-a', operation: 'touche' }], {});

  const { errors } = check(racine, { base });
  assert(
    !errors.some((e) => e.includes('livré, donc figé')),
    `un cadrage neuf a été pris pour un cadrage livré : ${errors.join(' | ')}`,
  );
});

// --- rapport ---

console.log(`${reussis} test(s) réussi(s)`);
if (echecs.length) {
  console.log(`\n${echecs.length} échec(s) :`);
  for (const e of echecs) console.log(`  ✗ ${e}`);
  process.exit(1);
}
