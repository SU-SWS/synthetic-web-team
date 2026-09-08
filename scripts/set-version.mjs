#!/usr/bin/env node
// Set the version across every package, in lockstep.
//
// WHY A SCRIPT AND NOT `npm version`. Two things have to move together and
// `npm version` moves neither:
//
//   1. `@su-sws/synthetic-web-team-mcp` DEPENDS ON the root package with a caret range. A patch
//      bump is survivable (`^0.1.0` still matches 0.1.1), but a minor or major
//      one is not: `^0.1.0` does not match 0.2.0, so a published @su-sws/synthetic-web-team-mcp
//      would quietly resolve an OLD root package and ship stale standards. That
//      is the failure this script exists to prevent, and it is silent.
//   2. The two published packages are versioned in lockstep on purpose. The
//      split exists so CI does not download an MCP SDK to run `sws check`, not
//      because they evolve separately -- so one version number, and the CLI's
//      version is always the standards version it carries.
//
// The private workspace packages are moved too. Nothing reads their versions,
// but leaving them at 0.1.0 forever makes every future reader wonder whether
// the drift is meaningful.
//
// Usage:
//   node scripts/set-version.mjs patch|minor|major
//   node scripts/set-version.mjs --set 1.2.3
//   node scripts/set-version.mjs patch --dry-run

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Root first: it is the source of the current version and the target of the
// dependency range that has to be rewritten.
const ROOT_PKG = 'package.json';
const PUBLISHED = [ROOT_PKG, 'packages/mcp/package.json'];
const PRIVATE = ['packages/cli/package.json', 'packages/wizard/package.json'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const setIndex = args.indexOf('--set');
const explicit = setIndex !== -1 ? args[setIndex + 1] : null;
const bump = args.find((a) => ['patch', 'minor', 'major'].includes(a));

const die = (msg) => { console.error(`  ${msg}`); process.exit(2); };

if (!explicit && !bump) {
  die('Usage: set-version.mjs patch|minor|major [--dry-run]   or   --set <x.y.z>');
}

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const rootPkg = read(ROOT_PKG);
const rootName = rootPkg.name;
const current = rootPkg.version;

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function next() {
  if (explicit) {
    if (!SEMVER.test(explicit)) die(`--set expects x.y.z, got: ${explicit}`);
    return explicit;
  }
  const m = SEMVER.exec(current);
  if (!m) die(`current version is not plain x.y.z, so it cannot be bumped safely: ${current}`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const version = next();
if (version === current) die(`version is already ${version}`);

const changes = [];

for (const rel of [...PUBLISHED, ...PRIVATE]) {
  const pkg = read(rel);
  const before = pkg.version;
  pkg.version = version;

  // The range that would otherwise go stale. Rewritten wherever it appears
  // rather than only in the one place we currently know about, so adding a
  // second internal consumer does not reintroduce the bug.
  //
  // Skipped in the root package itself. `workspaces` includes ".", so an
  // `npm install` after a rename once wrote a devDependency from the root onto
  // ITSELF -- harmless in a workspace, where it resolves to a symlink, but a
  // package depending on its own version is nonsense to maintain and would have
  // been silently carried forward on every release from here on.
  let depNote = '';
  for (const block of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (rel === ROOT_PKG) continue;
    if (pkg[block]?.[rootName]) {
      pkg[block][rootName] = `^${version}`;
      depNote = ` (+ ${block}.${rootName} → ^${version})`;
    }
  }

  changes.push(`${rel}: ${before} → ${version}${depNote}`);
  if (!dryRun) writeFileSync(join(ROOT, rel), `${JSON.stringify(pkg, null, 2)}\n`);
}

console.log(`  ${current} → ${version}${dryRun ? '  (dry run, nothing written)' : ''}`);
for (const c of changes) console.log(`    ${c}`);

// Consumed by the release workflow. Printed on its own line so the workflow
// reads a value rather than parsing the prose above it.
console.log(`version=${version}`);
