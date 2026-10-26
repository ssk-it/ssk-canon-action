// Les étiquettes de rattachement qu'un référentiel attend, une par ligne.
//
// Le script qui les crée dans un dépôt cadré (`outillage/preparer-pistes.sh`)
// passe par ici pour lire les identifiants avec le chargeur partagé : une seconde
// lecture du format, dans un autre langage, finirait par diverger de celle de la
// vérification — RG-parseur-partage.
//
//   node src/etiquettes-pistes.mjs <chemin-du-referentiel>

import { formaterAnomalie, langueDuDepot } from './anomalies.mjs';
import { loadRepo } from './parse.mjs';
import { etiquettesRattachementPiste } from './pistes.mjs';

const racine = process.argv[2];
if (!racine) {
  console.error('usage : node src/etiquettes-pistes.mjs <chemin-du-referentiel>');
  process.exit(2);
}

const repo = loadRepo(racine);
const etiquettes = etiquettesRattachementPiste(repo);
// Rien à rattacher : le chemin n'est pas un référentiel, ou il a été mal lu.
// Le dire plutôt que de laisser croire qu'il n'y a rien à créer.
if (etiquettes.length === 0) {
  const { langue } = langueDuDepot(repo.config);
  console.error(formaterAnomalie({ code: 'piste-referentiel-vide', params: { racine } }, langue));
  process.exit(1);
}
for (const e of etiquettes) console.log(e);
