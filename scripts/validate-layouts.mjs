#!/usr/bin/env node
// Source checks, against scratch projects laid out the way each recipe does.
//
// The bug this guards: decanter.entry-css only searched src/, so a Next site
// with its entry CSS in styles/global.css, the layout the next-ssr recipe
// itself describes, failed with "no CSS file imports decanter". The Next
// layout search had the opposite assumption, app/ only, and missed src/app/.
// Each layout runs with and without git, because the file list comes from git
// when there is one and from a walk of the tree when there is not.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { decanter, next } from '../packages/cli/src/checks.mjs';

let failures = 0;
const scratch = [];

// A project with Decanter and Next installed, plus the files given.
function repo(files, { git }) {
  const root = mkdtempSync(join(tmpdir(), 'sws-layout-'));
  scratch.push(root);
  const all = {
    'package.json': JSON.stringify({ dependencies: { decanter: '^8.0.0', next: '^16.0.0' } }),
    'node_modules/decanter/package.json': JSON.stringify({ name: 'decanter', version: '8.0.0', main: 'src/css/index.css' }),
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  if (git) execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

function expect(name, check, id, files, want, detail) {
  for (const git of [true, false]) {
    const f = check({ root: repo(files, { git }), html: [] }).find((x) => x.id === id);
    const label = `${name} (${git ? 'git' : 'no git'})`;
    const okState = f?.state === want;
    const okDetail = !detail || f?.detail?.includes(detail);
    if (okState && okDetail) console.log(`OK     ${want.padEnd(7)}  ${id}: ${label}`);
    else { console.log(`FAIL   ${id}: ${label}: expected ${want}${detail ? ` naming ${detail}` : ''}, got ${f?.state}  ${f?.detail ?? ''}`); failures++; }
  }
}

const DECANTER = "@import 'decanter';\n";
const LAYOUT = (meta) => `export const metadata = { ${meta} };\nexport default function Root({ children }) { return children; }\n`;

// decanter.entry-css: found wherever the project keeps its entry CSS.
expect('Next, styles/global.css', decanter, 'decanter.entry-css', { 'styles/global.css': DECANTER }, 'pass', 'styles/global.css');
expect('Next, app/globals.css', decanter, 'decanter.entry-css', { 'app/globals.css': DECANTER }, 'pass', 'app/globals.css');
expect('Next under src/, src/app/globals.css', decanter, 'decanter.entry-css', { 'src/app/globals.css': DECANTER }, 'pass', 'src/app/globals.css');
expect('Astro, src/styles/global.css', decanter, 'decanter.entry-css', { 'src/styles/global.css': DECANTER }, 'pass', 'src/styles/global.css');
expect('no CSS imports decanter', decanter, 'decanter.entry-css', { 'styles/global.css': "@import 'tailwindcss';\n" }, 'fail');

// Dependencies and build output are not the project's entry CSS.
expect('only a dependency imports decanter', decanter, 'decanter.entry-css',
  { 'node_modules/some-theme/theme.css': DECANTER }, 'fail');
expect('only the build output imports decanter', decanter, 'decanter.entry-css',
  { '.gitignore': 'dist/\n', 'dist/assets/index.css': DECANTER }, 'fail');
expect('only a dot-folder imports decanter', decanter, 'decanter.entry-css',
  { '.gitignore': '.next/\n', '.next/static/css/app.css': DECANTER }, 'fail');

// The redundant import is checked in the entry that was found, wherever it is.
expect('entry in styles/ imports tailwindcss too', decanter, 'decanter.no-redundant-tailwind-import',
  { 'styles/global.css': `@import 'tailwindcss';\n${DECANTER}` }, 'fail', 'styles/global.css');

// next.metadata-base: the root layout in app/ or src/app/.
expect('app/layout.tsx sets it', next, 'next.metadata-base',
  { 'app/layout.tsx': LAYOUT("metadataBase: new URL('https://example.stanford.edu')") }, 'pass', 'app/layout.tsx');
expect('src/app/layout.tsx sets it', next, 'next.metadata-base',
  { 'src/app/layout.tsx': LAYOUT("metadataBase: new URL('https://example.stanford.edu')") }, 'pass', 'src/app/layout.tsx');
expect('a nested route group layout sets it', next, 'next.metadata-base',
  { 'app/(site)/layout.tsx': LAYOUT("metadataBase: new URL('https://example.stanford.edu')") }, 'pass', 'app/(site)/layout.tsx');
expect('src/app/layout.tsx without it', next, 'next.metadata-base',
  { 'src/app/layout.tsx': LAYOUT("title: 'Example'") }, 'fail');
expect('no App Router', next, 'next.metadata-base', { 'pages/index.tsx': 'export default () => null;\n' }, 'unknown', 'src/app/');
expect('a layout outside app/ is not the App Router', next, 'next.metadata-base',
  { 'components/layout.tsx': LAYOUT("metadataBase: new URL('https://example.stanford.edu')") }, 'unknown');

for (const d of scratch) rmSync(d, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
