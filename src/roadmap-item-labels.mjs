// The link labels a specification expects, one per line.
//
// The script that creates them in a scoping repo (`outillage/preparer-pistes.sh`)
// goes through here to read the identifiers with the shared loader: a second
// reading of the format, in another language, would end up diverging from the
// check's — RG-parseur-partage.
//
//   node src/roadmap-item-labels.mjs <chemin-du-referentiel>

import { formaterAnomalie, langueDuDepot } from './anomalies.mjs';
import { loadRepo } from './parse.mjs';
import { etiquettesRattachementPiste } from './pistes.mjs';

const root = process.argv[2];
if (!root) {
  console.error('usage : node src/roadmap-item-labels.mjs <chemin-du-referentiel>');
  process.exit(2);
}

const repo = loadRepo(root);
const labels = etiquettesRattachementPiste(repo);
// Nothing to link: the path is not a specification, or it was misread.
// Say so rather than let it be believed there is nothing to create.
if (labels.length === 0) {
  const { langue: language } = langueDuDepot(repo.config);
  console.error(formaterAnomalie({ code: 'piste-referentiel-vide', params: { racine: root } }, language));
  process.exit(1);
}
for (const label of labels) console.log(label);
