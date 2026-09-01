#!/usr/bin/env node
// Stage the repository's content into this package so `npm pack` can include it,
// then remove it again afterwards.
//
// WHY A COPY. `standards/`, `skills/` and `AGENTS.md` live at the repo root and
// that is the single source of truth: `scripts/validate-skills.mjs` reads them
// there, `scripts/sync-skills.mjs` emits from there, and the docs site cites
// them by root-relative path. npm cannot include files from outside a package
// directory, so the choice was to move the content in here and symlink back
// (breaking every one of those readers) or to copy at pack time. Copying keeps
// one source of truth and costs one script.
//
// The staged copies are gitignored and removed by `postpack`. If you find them
// lying around, a pack run was interrupted: `node scripts/stage.mjs --clean`.

import { cpSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const REPO = resolve(PKG, '..', '..');

// Exactly what ships. Anything not listed here is not content: not the plan, not
// the docs site, not the packages.
const ITEMS = ['standards', 'skills', 'AGENTS.md'];

const clean = process.argv.includes('--clean');

function count(dir) {
  let n = 0;
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      statSync(p).isDirectory() ? walk(p) : n++;
    }
  })(dir);
  return n;
}

for (const item of ITEMS) {
  const dest = join(PKG, item);
  rmSync(dest, { recursive: true, force: true });
  if (clean) continue;

  const src = join(REPO, item);
  if (!existsSync(src)) {
    console.error(`stage: ${src} does not exist. Run from the repository, not a tarball.`);
    process.exit(1);
  }
  cpSync(src, dest, { recursive: true });
}

if (clean) {
  console.log(`stage: removed ${ITEMS.join(', ')} from packages/standards`);
} else {
  const files = ITEMS.reduce((a, i) => {
    const p = join(PKG, i);
    return a + (statSync(p).isDirectory() ? count(p) : 1);
  }, 0);
  console.log(`stage: copied ${ITEMS.join(', ')} into packages/standards (${files} files)`);
}
