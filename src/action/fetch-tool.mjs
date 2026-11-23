// First step of the actions: gets the tool ready.
//
// `github.action_path` designates the folder GitHub fetched this repo into. It
// is copied outside the calling repo's working tree, so as to leave nothing
// behind that would then be committed, and its dependencies are installed
// there.

import { cpSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ActionError, runNpm } from './support.mjs';

/**
 * Where the tool is, relative to the action's own folder, what proves that
 * it is there, and where it is copied. The roadmap items action lives in a
 * sub-folder of the repo: its tool is the repo's root.
 */
export const TOOLS = {
  propagator: { from: '.', sentinel: 'src/propagate.mjs', copy: 'ssk-canon-action', name: 'Propagateur' },
  checker: { from: '..', sentinel: 'src/check-roadmap-item.mjs', copy: 'ssk-canon-pistes', name: 'Vérificateur' },
};

/**
 * @param {'propagator' | 'checker'} kind
 * @param {{ actionPath: string, temp: string, npm?: typeof runNpm }} where
 * @returns {string} the folder the tool was copied to
 */
export function fetchTool(kind, { actionPath, temp, npm = runNpm }) {
  const tool = TOOLS[kind];
  const source = resolve(actionPath, tool.from);

  if (!existsSync(join(source, tool.sentinel))) {
    throw new ActionError(`${tool.name} introuvable sous ${source} — la structure du dépôt outil a changé.`);
  }

  const destination = join(temp, tool.copy);
  cpSync(source, destination, { recursive: true });
  npm(['ci', '--omit=dev'], destination);
  return destination;
}

/** @param {NodeJS.ProcessEnv} env @param {'propagator' | 'checker'} kind */
export function main(env, kind) {
  fetchTool(kind, { actionPath: env.ACTION_PATH, temp: env.RUNNER_TEMP });
}
