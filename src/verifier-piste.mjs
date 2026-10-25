// Vérifie le rattachement d'une piste à l'événement de son issue, et le signale
// par un commentaire sur l'issue — RG-piste-rattachee.
//
// Le référentiel est lu sur la branche principale par le chargeur partagé : les
// identifiants d'un domaine et d'une fonctionnalité sont ceux du format, lus une
// seule fois (RG-parseur-partage).
//
//   node src/verifier-piste.mjs [chemin-du-referentiel] [--evenement <fichier>] [--sans-commentaire]
//
// L'événement est celui que GitHub décrit dans `GITHUB_EVENT_PATH`. Sans
// `--sans-commentaire`, le script lit l'issue et ses commentaires par l'API, avec
// `GITHUB_TOKEN`, sur le dépôt `GITHUB_REPOSITORY`.

import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRepo } from './parse.mjs';
import { checkPiste, planifierCommentairePiste } from './pistes.mjs';

/**
 * Vérifie une piste et met son commentaire à jour.
 *
 * Les étiquettes sont relues sur l'issue au moment de la vérification plutôt
 * que dans l'événement : une issue ouverte avec trois étiquettes émet quatre
 * événements, et seul l'état présent dit ce qu'il faut signaler.
 *
 * @param {{ racine: string, api: {
 *   lireIssue(): Promise<{ labels: ReadonlyArray<string | { name?: string }> }>,
 *   listerCommentaires(): Promise<ReadonlyArray<{ id: number, body?: string, user?: { type?: string } }>>,
 *   creer(corps: string): Promise<unknown>,
 *   modifier(id: number, corps: string): Promise<unknown>,
 *   supprimer(id: number): Promise<unknown>,
 * } }} options
 */
export async function verifierPiste({ racine, api }) {
  const { labels } = await api.lireIssue();
  const resultat = checkPiste(labels ?? [], loadRepo(racine));

  // Une issue qui n'est plus une piste n'a plus à porter le signalement : on le
  // retire, comme d'une piste remise en ordre.
  const plan = planifierCommentairePiste(await api.listerCommentaires(), resultat.ecarts);
  if (plan.action === 'creer') await api.creer(plan.corps);
  else if (plan.action === 'modifier') await api.modifier(plan.id, plan.corps);
  else if (plan.action === 'supprimer') await api.supprimer(plan.id);

  return { ...resultat, action: plan.action };
}

/**
 * L'issue et ses commentaires, par l'API REST de GitHub.
 *
 * @param {{ depot: string, numero: number, jeton: string, api?: string }} options
 */
export function apiGitHub({ depot, numero, jeton, api = 'https://api.github.com' }) {
  const appeler = async (methode, chemin, corps) => {
    const reponse = await fetch(`${api}/repos/${depot}${chemin}`, {
      method: methode,
      headers: {
        authorization: `Bearer ${jeton}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(corps ? { 'content-type': 'application/json' } : {}),
      },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    // Le message dit l'appel qui a échoué : une permission `issues: write`
    // oubliée dans le workflow se lit sinon comme une panne de la plateforme.
    if (!reponse.ok)
      throw new Error(`${methode} ${chemin} : ${reponse.status} ${await reponse.text()}`);
    return reponse.status === 204 ? null : reponse.json();
  };

  return {
    lireIssue: () => appeler('GET', `/issues/${numero}`),
    async listerCommentaires() {
      const tous = [];
      for (let page = 1; ; page += 1) {
        const lot = await appeler('GET', `/issues/${numero}/comments?per_page=100&page=${page}`);
        tous.push(...lot);
        if (lot.length < 100) return tous;
      }
    },
    creer: (body) => appeler('POST', `/issues/${numero}/comments`, { body }),
    modifier: (id, body) => appeler('PATCH', `/issues/comments/${id}`, { body }),
    supprimer: (id) => appeler('DELETE', `/issues/comments/${id}`),
  };
}

/** L'issue telle que l'événement la décrit, sans rien lire ni écrire ailleurs. */
function apiHorsLigne(issue) {
  return {
    lireIssue: async () => issue,
    listerCommentaires: async () => [],
    creer: async () => {},
    modifier: async () => {},
    supprimer: async () => {},
  };
}

async function main(argv) {
  const args = argv.slice(2);
  const option = (nom) => {
    const i = args.indexOf(nom);
    return i === -1 ? undefined : args.splice(i, 2)[1];
  };
  const sansCommentaire = args.includes('--sans-commentaire');
  const fichierEvenement = option('--evenement') ?? process.env.GITHUB_EVENT_PATH;
  const racine = args.find((a) => !a.startsWith('--')) ?? '.';

  const evenement = fichierEvenement ? JSON.parse(readFileSync(fichierEvenement, 'utf8')) : {};
  const issue = evenement.issue;

  let ecarts = [];
  if (!issue) console.log('Aucune issue dans cet événement : rien à vérifier.');
  else {
    const api = sansCommentaire
      ? apiHorsLigne(issue)
      : apiGitHub({
          depot: process.env.GITHUB_REPOSITORY,
          numero: issue.number,
          jeton: process.env.GITHUB_TOKEN,
        });
    const resultat = await verifierPiste({ racine, api });
    ecarts = resultat.ecarts;
    if (!resultat.piste) console.log(`Issue #${issue.number} : pas une piste.`);
    for (const e of ecarts) console.log(`::warning::#${issue.number} — ${e}`);
    if (!sansCommentaire) console.log(`Commentaire : ${resultat.action}.`);
  }

  console.log(ecarts.length ? `${ecarts.length} écart(s) de rattachement` : 'aucun écart de rattachement');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ecarts=${ecarts.length}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main(process.argv).catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
