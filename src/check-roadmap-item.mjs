// Checks the links of a roadmap item on its issue's event, and reports them
// through a comment on the issue — RG-piste-rattachee.
//
// The specification is read on the main branch by the shared loader: the
// identifiers of a domain and of a feature are those of the format, read only
// once (RG-parseur-partage).
//
//   node src/check-roadmap-item.mjs [chemin-du-referentiel] [--evenement <fichier>] [--sans-commentaire]
//
// The event is the one GitHub describes in `GITHUB_EVENT_PATH`. Without
// `--sans-commentaire`, the script reads the issue and its comments through the
// API, with `GITHUB_TOKEN`, on the repo `GITHUB_REPOSITORY`.
//
// The log and the comment are given in the repo's language, declared in its
// `ssk-canon.yml` — RG-langue-du-depot.

import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formaterAnomalie, langueDuDepot } from './anomalies.mjs';
import { loadRepo } from './parse.mjs';
import { checkPiste, planifierCommentairePiste } from './pistes.mjs';

/**
 * Checks a roadmap item and updates its comment.
 *
 * The labels are re-read on the issue at the time of the check rather than in
 * the event: an issue opened with three labels emits four events, and only the
 * present state tells what must be reported.
 *
 * @param {{ racine: string, api: {
 *   lireIssue(): Promise<{ labels: ReadonlyArray<string | { name?: string }> }>,
 *   listerCommentaires(): Promise<ReadonlyArray<{ id: number, body?: string, user?: { type?: string } }>>,
 *   creer(corps: string): Promise<unknown>,
 *   modifier(id: number, corps: string): Promise<unknown>,
 *   supprimer(id: number): Promise<unknown>,
 * } }} options
 */
export async function checkRoadmapItemEvent({ racine: root, api }) {
  const { labels } = await api.lireIssue();
  const repo = loadRepo(root);
  const { langue: language } = langueDuDepot(repo.config);
  const result = checkPiste(labels ?? [], repo, language);

  // An issue that is no longer a roadmap item no longer has to carry the
  // report: it is removed, as from a roadmap item put back in order.
  const plan = planifierCommentairePiste(await api.listerCommentaires(), result.ecarts, language);
  if (plan.action === 'creer') await api.creer(plan.corps);
  else if (plan.action === 'modifier') await api.modifier(plan.id, plan.corps);
  else if (plan.action === 'supprimer') await api.supprimer(plan.id);

  return { ...result, action: plan.action };
}

/**
 * The issue and its comments, through GitHub's REST API.
 *
 * @param {{ repo: string, number: number, token: string, api?: string }} options
 */
export function githubApi({ repo, number, token, api = 'https://api.github.com' }) {
  const call = async (method, path, body) => {
    const response = await fetch(`${api}/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    // The message names the call that failed: an `issues: write` permission
    // forgotten in the workflow otherwise reads as a platform outage.
    if (!response.ok)
      throw new Error(`${method} ${path} : ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  };

  return {
    lireIssue: () => call('GET', `/issues/${number}`),
    async listerCommentaires() {
      const all = [];
      for (let page = 1; ; page += 1) {
        const batch = await call('GET', `/issues/${number}/comments?per_page=100&page=${page}`);
        all.push(...batch);
        if (batch.length < 100) return all;
      }
    },
    creer: (body) => call('POST', `/issues/${number}/comments`, { body }),
    modifier: (id, body) => call('PATCH', `/issues/comments/${id}`, { body }),
    supprimer: (id) => call('DELETE', `/issues/comments/${id}`),
  };
}

/** The issue as the event describes it, without reading or writing anything elsewhere. */
function offlineApi(issue) {
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
  const option = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args.splice(i, 2)[1];
  };
  const noComment = args.includes('--sans-commentaire');
  const eventFile = option('--evenement') ?? process.env.GITHUB_EVENT_PATH;
  const root = args.find((a) => !a.startsWith('--')) ?? '.';

  const event = eventFile ? JSON.parse(readFileSync(eventFile, 'utf8')) : {};
  const issue = event.issue;

  // The log's language, the repo's; badly declared, it is reported.
  const { langue: language, anomalies } = langueDuDepot(loadRepo(root).config);
  const say = (code, params = {}) => formaterAnomalie({ code, params }, language);
  for (const a of anomalies) console.log(`::warning::${formaterAnomalie(a, language)}`);

  let discrepancies = [];
  if (!issue) console.log(say('piste-sans-issue'));
  else {
    const api = noComment
      ? offlineApi(issue)
      : githubApi({
          repo: process.env.GITHUB_REPOSITORY,
          number: issue.number,
          token: process.env.GITHUB_TOKEN,
        });
    const result = await checkRoadmapItemEvent({ racine: root, api });
    discrepancies = result.ecarts;
    if (!result.piste) console.log(say('piste-pas-une-piste', { numero: issue.number }));
    for (const d of discrepancies) console.log(`::warning::#${issue.number} — ${d}`);
    if (!noComment) console.log(say('piste-commentaire-action', { action: result.action }));
  }

  console.log(discrepancies.length ? say('piste-ecarts', { nombre: discrepancies.length }) : say('piste-aucun-ecart'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ecarts=${discrepancies.length}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main(process.argv).catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
