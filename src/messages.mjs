// The message catalogue, per language: one message per anomaly code —
// RG-anomalies-codees.
//
// Each message is a function of its parameters, and of a function that tells
// a wrapped anomaly in the same language. The French repeats word for word
// the messages from before the codes: the text form must change nothing for
// consumers that do not read the codes yet. One catalogue per module, so that
// a module and its messages are read together.

import { common } from './messages/common.mjs';
import { verification } from './messages/verification.mjs';
import { reading } from './messages/reading.mjs';
import { delivery } from './messages/delivery.mjs';
import { propagation } from './messages/propagation.mjs';
import { roadmapItems } from './messages/roadmap-items.mjs';
import { citations } from './messages/citations.mjs';

const CATALOGUES = [common, verification, reading, delivery, propagation, roadmapItems, citations];

function mergeCatalogues(language) {
  const all = {};
  for (const c of CATALOGUES)
    for (const [code, message] of Object.entries(c[language])) {
      // Two modules taking the same code would make it say two things.
      if (code in all) throw new Error(`duplicate anomaly code: ${code}`);
      all[code] = message;
    }
  return all;
}

export const MESSAGES = { fr: mergeCatalogues('fr'), en: mergeCatalogues('en') };
