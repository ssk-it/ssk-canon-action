// Tells whether a module is the one Node was asked to run, as opposed to one
// that was imported.
//
// Both sides are compared as real paths: `import.meta.url` is a URL, which
// encodes spaces and, on Windows, reads `file:///C:/…`, and Node resolves
// symbolic links in the main module's URL, whereas `process.argv[1]` keeps the
// path as it was typed. Comparing `import.meta.url` with `file://${argv[1]}`
// is therefore false on Windows and on any path that goes through a link, so
// that a command-line tool silently did nothing.

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} metaUrl the `import.meta.url` of the module asking
 */
export function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(entry);
  } catch {
    return false;
  }
}
