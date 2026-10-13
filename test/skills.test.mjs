// Tests de la forme des skills distribués.
//
// Ce qu'ils protègent : un frontmatter que YAML refuse ne fait échouer ni le
// chargement du skill ni rien d'autre. Claude Code charge alors son corps avec
// des métadonnées vides — sans `context: fork`, sans `allowed-tools`, et avec
// son titre pour toute description. Le skill tourne dans la conversation
// principale au lieu d'un sous-agent, et se déclenche mal. Constaté le
// 13 octobre 2026 : une description non citée qui contient « : » suffisait.
//
//   node test/skills.test.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const SKILLS = fileURLToPath(new URL('../skills', import.meta.url));

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

const noms = readdirSync(SKILLS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(SKILLS, e.name, 'SKILL.md')))
  .map((e) => e.name)
  .sort();

test('trouve les skills à vérifier', () => {
  vrai(noms.length > 0, `aucun SKILL.md sous ${SKILLS}`);
});

for (const nom of noms) {
  test(`le frontmatter de ${nom} est un YAML que Claude Code lit`, () => {
    // Les fins de ligne d'un dépôt extrait sous Windows ne doivent pas décider
    // du résultat : Claude Code lit le fichier tel qu'il est installé.
    const texte = readFileSync(join(SKILLS, nom, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const bloc = texte.match(/^---\n([\s\S]*?)\n---\n/);
    vrai(bloc, 'le fichier doit commencer par un frontmatter entre deux lignes ---');

    let champs;
    try {
      champs = load(bloc[1]);
    } catch (erreur) {
      throw new Error(`YAML refusé — ${erreur.reason}, ligne ${erreur.mark.line + 1}, colonne ${erreur.mark.column + 1}`);
    }
    vrai(champs?.name === nom, `name doit valoir ${nom}, obtenu ${JSON.stringify(champs?.name)}`);
    vrai(typeof champs.description === 'string' && champs.description.trim() !== '', 'description absente ou vide');
  });
}

console.log(`${reussis} réussi(s), ${echecs.length} échec(s)`);
for (const echec of echecs) console.error(`  ✗ ${echec}`);
if (echecs.length > 0) process.exit(1);
