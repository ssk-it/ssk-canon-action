// The messages of the propagation (`propagate.mjs`, `pending-propagation.mjs`).

export const propagation = {
  fr: {
    'enonce-non-fourni': (p) =>
      `${p.cible} : aucun énoncé fourni par les cadrages qui le créent ou le modifient`,
    'regle-creee-sans-rattachement': (p) =>
      `règle ${p.regle} : créée par un cadrage mais rattachée à aucune fonctionnalité — ` +
      `créer le fichier avec son rattachement avant de livrer`,
    'integrite-avant-propagation': (p, tell) => `intégrité : ${tell(p.anomalie)}`,

    // the command-line propagation report
    'rapport-propagation-problemes': (p) => `${p.nombre} problème(s) — aucune écriture effectuée :`,
    'rapport-propagation-a-jour': () => 'Référentiel déjà à jour — rien à propager.',
    'rapport-propagation-ecritures': (p) =>
      `${p.nombre} règle(s) ${p.simulation ? 'à écrire' : 'écrites'} :`,
    'rapport-propagation-simulation': () => '(simulation — aucun fichier modifié)',

    // what the Action writes after the propagation
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
    'action-identite-absente': () =>
      "Demande ouverte avec le jeton du workflow, faute de l'application de l'automatisation : " +
      'ses contrôles attendront une approbation humaine. Transmettre la variable SSK_CANON_APP_ID ' +
      'et le secret SSK_CANON_APP_CLE à la propagation — outillage/application-propagation.sh.',
    'action-identite-indisponible': () =>
      "Jeton de l'application de l'automatisation refusé — application non installée sur ce dépôt, " +
      'ou clé SSK_CANON_APP_CLE erronée : demande ouverte avec le jeton du workflow, ' +
      'ses contrôles attendront une approbation humaine.',
    'action-fusion-automatique-demandee': () =>
      'Fusion automatique demandée : la demande se fusionnera une fois les contrôles requis verts.',
    'action-fusion-automatique-refusee': () =>
      'Fusion automatique refusée — à autoriser sur le dépôt (outillage/preparer-depot-cadre.sh) : ' +
      'la demande attend une fusion à la main.',
    'action-demande-mise-a-jour': (p) =>
      `Demande de propagation #${p.numero} dépassée par la branche principale : mise à jour.`,
    'action-demande-non-mise-a-jour': (p) =>
      `Demande de propagation #${p.numero} dépassée par la branche principale, et sa mise à jour refusée : ` +
      'la mettre à jour à la main.',
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
    'integrite-avant-propagation': (p, tell) => `integrity: ${tell(p.anomalie)}`,

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
    'action-identite-absente': () =>
      'Pull request opened with the workflow token, for lack of the automation’s app: ' +
      'its checks will wait for a human’s approval. Pass the SSK_CANON_APP_ID variable ' +
      'and the SSK_CANON_APP_CLE secret to the propagation — outillage/application-propagation.sh.',
    'action-identite-indisponible': () =>
      'Token of the automation’s app refused — app not installed on this repo, ' +
      'or wrong SSK_CANON_APP_CLE key: pull request opened with the workflow token, ' +
      'its checks will wait for a human’s approval.',
    'action-fusion-automatique-demandee': () =>
      'Automatic merge requested: the pull request will merge once the required checks are green.',
    'action-fusion-automatique-refusee': () =>
      'Automatic merge refused — to allow on the repo (outillage/preparer-depot-cadre.sh): ' +
      'the pull request waits for a merge by hand.',
    'action-demande-mise-a-jour': (p) =>
      `Propagation pull request #${p.numero} overtaken by the main branch: updated.`,
    'action-demande-non-mise-a-jour': (p) =>
      `Propagation pull request #${p.numero} overtaken by the main branch, and its update refused: ` +
      'update it by hand.',
    'action-commit-corps': () => 'Writes computed from the delivered scopings.',
    'action-demande-corps': () =>
      'Writes computed from the delivered scopings, by the propagation.\n\n' +
      'The main branch refuses a direct push: these writes go through\n' +
      'a pull request so that the required checks run.',
  },
};
