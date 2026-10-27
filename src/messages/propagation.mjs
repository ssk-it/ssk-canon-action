// Les messages de la propagation (`propagate.mjs`, `propagation-en-attente.mjs`).

export const propagation = {
  fr: {
    'enonce-non-fourni': (p) =>
      `${p.cible} : aucun énoncé fourni par les cadrages qui le créent ou le modifient`,
    'regle-creee-sans-rattachement': (p) =>
      `règle ${p.regle} : créée par un cadrage mais rattachée à aucune fonctionnalité — ` +
      `créer le fichier avec son rattachement avant de livrer`,
    'integrite-avant-propagation': (p, dire) => `intégrité : ${dire(p.anomalie)}`,

    // le rapport de la propagation en ligne de commande
    'rapport-propagation-problemes': (p) => `${p.nombre} problème(s) — aucune écriture effectuée :`,
    'rapport-propagation-a-jour': () => 'Référentiel déjà à jour — rien à propager.',
    'rapport-propagation-ecritures': (p) =>
      `${p.nombre} règle(s) ${p.simulation ? 'à écrire' : 'écrites'} :`,
    'rapport-propagation-simulation': () => '(simulation — aucun fichier modifié)',

    // ce que l'Action écrit après la propagation
    'action-rien-a-commiter': () => 'Référentiel déjà à jour — rien à commiter.',
    'action-ecritures-poussees': () => 'Écritures poussées sur la branche principale.',
    'action-propagation-en-attente': () =>
      'Une demande de propagation attend déjà sa fusion — pas de seconde demande.',
    'action-push-refuse': (p) => `Push direct refusé — la propagation passe par « ${p.branche} ».`,
    'action-verification-lancee': () => 'Vérification lancée sur la demande de propagation.',
    'action-verification-non-lancee': (p) =>
      `Vérification non lancée : « ${p.workflow} » doit accepter workflow_dispatch, ` +
      'et la propagation avoir la permission actions: write — reprendre les modèles. ' +
      "D'ici là, fermer puis rouvrir la demande la déclenche.",
    'action-commit-corps': () => 'Écritures calculées à partir des cadrages livrés.',
    'action-demande-corps': () =>
      'Écritures calculées à partir des cadrages livrés, par la propagation.\n\n' +
      'La branche principale refuse un push direct : ces écritures passent par\n' +
      "une demande de fusion pour que les contrôles requis s'exécutent.",
  },
  en: {
    'enonce-non-fourni': (p) =>
      `${p.cible}: no statement provided by the scopings that create or modify it`,
    'regle-creee-sans-rattachement': (p) =>
      `rule ${p.regle}: created by a scoping but attached to no feature — ` +
      `create the file with its attachment before delivering`,
    'integrite-avant-propagation': (p, dire) => `integrity: ${dire(p.anomalie)}`,

    'rapport-propagation-problemes': (p) => `${p.nombre} problem(s) — nothing written:`,
    'rapport-propagation-a-jour': () => 'Specification already up to date — nothing to propagate.',
    'rapport-propagation-ecritures': (p) =>
      `${p.nombre} rule(s) ${p.simulation ? 'to write' : 'written'}:`,
    'rapport-propagation-simulation': () => '(dry run — no file changed)',

    'action-rien-a-commiter': () => 'Specification already up to date — nothing to commit.',
    'action-ecritures-poussees': () => 'Writes pushed to the main branch.',
    'action-propagation-en-attente': () =>
      'A propagation pull request is already awaiting merge — no second one.',
    'action-push-refuse': (p) => `Direct push refused — propagation goes through “${p.branche}”.`,
    'action-verification-lancee': () => 'Verification started on the propagation pull request.',
    'action-verification-non-lancee': (p) =>
      `Verification not started: “${p.workflow}” must accept workflow_dispatch, ` +
      'and the propagation needs the actions: write permission — update from the templates. ' +
      'Until then, closing and reopening the pull request triggers it.',
    'action-commit-corps': () => 'Writes computed from the delivered scopings.',
    'action-demande-corps': () =>
      'Writes computed from the delivered scopings, by the propagation.\n\n' +
      'The main branch refuses a direct push: these writes go through\n' +
      'a pull request so that the required checks run.',
  },
};
