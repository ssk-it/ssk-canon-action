// What a step of the composite actions runs: `shell: node {0}`, with this single
// line as its script —
//
//   require(require('node:path').join(process.env.RUNNER_TEMP, 'ssk-canon-action', 'src', 'action', 'launcher.cjs'))('commit-writes')
//
// The platform's own shells are `bash`, `pwsh` and `cmd`: a step written in one
// of them runs on the runners that have it, and a self-hosted Windows runner
// has bash only if its service's PATH says so. Node is already required by the
// action, and is on every runner that runs it. The script reaches the modules
// of this folder through a file URL, which is the only form of an absolute path
// that `import()` accepts on Windows.
//
// CommonJS, and not an ES module: the platform writes the step's script to a
// file with no extension, which Node reads as CommonJS.

'use strict';

const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

/**
 * Runs `main` of the module `name` of this folder, with the step's environment
 * and the given arguments; a failure becomes an error annotation and a non-zero
 * exit code.
 *
 * @param {string} name the module, without extension
 * @param {...string} args handed to its `main` after the environment
 */
module.exports = function launch(name, ...args) {
  import(pathToFileURL(join(__dirname, `${name}.mjs`)).href)
    .then((module) => module.main(process.env, ...args))
    .catch((error) => {
      // a failure whose cause has already been printed says nothing more
      if (!error.silent) console.error(`::error::${error.message}`);
      process.exitCode = 1;
    });
};
