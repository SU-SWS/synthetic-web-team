// Where the content is. Exported as resolved paths so no consumer has to guess
// at a relative walk, which is exactly what broke `npx create-web-team`: it
// looked three directories up expecting a git checkout, found node_modules, and
// exited.
//
// TWO LAYOUTS, ONE API. In a published tarball the content sits beside this
// file. In this repository it does not: `standards/`, `skills/` and `AGENTS.md`
// live at the repo root and are staged in here only at pack time (see
// scripts/stage.mjs). Resolving both keeps `npm install` at the root working for
// development without a build step, which is the same convention-over-
// compilation instinct as the rest of the project.

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Packed layout first, then the repo root. Order matters: if someone has both,
// the staged copy is the one that would ship, so it is the one to trust.
const ROOTS = [HERE, resolve(HERE, '..', '..')];

function locate(name) {
  for (const r of ROOTS) {
    const p = join(r, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Absolute path to `standards/` (L0), or null if unavailable. */
export const standardsDir = locate('standards');

/** Absolute path to `skills/` (L1), or null. */
export const skillsDir = locate('skills');

/** Absolute path to `AGENTS.md`, or null. */
export const agentsPath = locate('AGENTS.md');

/**
 * The directory containing all three, which is what the wizard wants as its
 * `--source`. Null when the content is not present, so callers can say so
 * rather than half-installing.
 */
export const contentRoot = (() => {
  for (const r of ROOTS) {
    if (existsSync(join(r, 'AGENTS.md')) && existsSync(join(r, 'skills'))
        && existsSync(join(r, 'standards'))) return r;
  }
  return null;
})();

/** True when this package can actually supply content. */
export const isComplete = Boolean(contentRoot);
