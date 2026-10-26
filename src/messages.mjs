// Le catalogue des messages, par langue : un message par code d'anomalie —
// RG-anomalies-codees.
//
// Chaque message est une fonction de ses paramètres, et d'une fonction qui dit
// une anomalie enveloppée dans la même langue. Le français reprend mot pour mot
// les messages d'avant les codes : la forme textuelle ne doit rien changer pour
// les consommateurs qui ne lisent pas encore les codes. Un catalogue par module,
// pour qu'un module et ses messages se relisent ensemble.

import { commun } from './messages/commun.mjs';
import { verification } from './messages/verification.mjs';
import { lecture } from './messages/lecture.mjs';
import { livraison } from './messages/livraison.mjs';
import { propagation } from './messages/propagation.mjs';
import { pistes } from './messages/pistes.mjs';

const CATALOGUES = [commun, verification, lecture, livraison, propagation, pistes];

function fusionner(langue) {
  const tout = {};
  for (const c of CATALOGUES)
    for (const [code, message] of Object.entries(c[langue])) {
      // Deux modules qui prendraient le même code lui feraient dire deux choses.
      if (code in tout) throw new Error(`code d'anomalie en double : ${code}`);
      tout[code] = message;
    }
  return tout;
}

export const MESSAGES = { fr: fusionner('fr'), en: fusionner('en') };
