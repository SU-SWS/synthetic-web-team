#!/usr/bin/env node
// Framework-specific checks, against scratch projects of each kind.
//
// The bug this guards: astro.headers-in-host-config ran on every project, so a
// Next site whose headers() sends the whole default set, on pages and static
// files alike, was told netlify.toml "is missing" all five headers. A check
// written for one framework now never runs on another, and shared checks give
// the fix for the framework in front of them. Also guarded: a commented-out
// CSP in the Next config counted as a CSP.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { framework, security, seo, next, build } from '../packages/cli/src/checks.mjs';

const CLI = resolve('packages/cli/bin/sws.mjs');
const STANDARDS = resolve('standards');

let failures = 0;
let passes = 0;
const check = (cond, msg) => {
  if (cond) { passes++; console.log(`OK     ${msg}`); }
  else { console.log(`::error::${msg}`); console.log(`FAIL   ${msg}`); failures++; }
};
const scenario = (name) => console.log(`\n${name}`);

const scratch = [];
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'sws-fw-'));
  scratch.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}
const find = (findings, id) => findings.find((f) => f.id === id);

const pkg = (deps) => JSON.stringify({ dependencies: deps });
const NEXT = { 'package.json': pkg({ next: '^16.0.0' }) };
const ASTRO = { 'package.json': pkg({ astro: '^5.0.0' }), 'astro.config.mjs': 'export default {};\n' };
const NETLIFY_NO_HEADERS = { 'netlify.toml': '[build]\n  command = "npm run build"\n' };

const header = (key, value) => `{ key: '${key}', value: '${value}' },`;
const HEADERS = [
  header('Strict-Transport-Security', 'max-age=31536000'),
  header('X-Content-Type-Options', 'nosniff'),
  header('Referrer-Policy', 'strict-origin-when-cross-origin'),
  header('Permissions-Policy', 'camera=()'),
  header('X-Frame-Options', 'SAMEORIGIN'),
].join('\n        ');
const nextConfig = (extra = '') => `export default {
  async headers() {
    return [{ source: '/(.*)', headers: [
        ${HEADERS}
        ${extra}
    ] }];
  },
};
`;

scenario('framework() tells the projects apart');
{
  check(framework(repo(NEXT)) === 'next', 'next in dependencies: next');
  check(framework(repo({ 'next.config.ts': nextConfig() })) === 'next', 'a Next config alone: next');
  check(framework(repo(ASTRO)) === 'astro', 'astro in dependencies with a config: astro');
  check(framework(repo({ 'index.html': '<!doctype html>' })) === null, 'neither: a static site');
}

scenario('astro.headers-in-host-config never runs on a Next project');
{
  const f = find(security({ root: repo({ ...NEXT, ...NETLIFY_NO_HEADERS, 'next.config.ts': nextConfig() }) }),
    'astro.headers-in-host-config');
  check(f.state === 'not_applicable', `Next with a bare netlify.toml: not_applicable (got ${f.state})`);
  check(/headers\(\)/.test(f.detail) && /security\.headers-set/.test(f.detail), 'and it says where Next headers are checked');

  const r = spawnSync('node', [CLI, 'check', '--format', 'json', '--no-publish', '--no-summary', '--standards', STANDARDS], {
    cwd: repo({ ...NEXT, ...NETLIFY_NO_HEADERS, 'next.config.ts': nextConfig(), '.sws/manifest.yml': YAML.stringify({ recipe: 'next-ssr' }) }),
    encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' },
  });
  const report = JSON.parse(r.stdout);
  check(!report.findings.some((x) => x.id.startsWith('astro.')), 'a next-ssr report has no astro.* findings at all');
  check(find(report.findings, 'security.headers-set').state === 'pass', 'and the Next headers check passes');
}

scenario('it still runs where host config is how headers are sent');
{
  const astro = find(security({ root: repo({ ...ASTRO, ...NETLIFY_NO_HEADERS }) }), 'astro.headers-in-host-config');
  check(astro.state === 'fail', `Astro with a bare netlify.toml: fail (got ${astro.state})`);
  const html = find(security({ root: repo({ 'index.html': '<!doctype html>', ...NETLIFY_NO_HEADERS }) }), 'astro.headers-in-host-config');
  check(html.state === 'fail', `a static site with a bare netlify.toml: fail (got ${html.state})`);
  const commented = find(security({ root: repo({ ...ASTRO, 'netlify.toml': '# Strict-Transport-Security X-Content-Type-Options Referrer-Policy Permissions-Policy X-Frame-Options\n' }) }),
    'astro.headers-in-host-config');
  check(commented.state === 'fail', 'header names only in a netlify.toml comment do not count');
}

scenario('next.* checks never run on an Astro project, nor astro.* build checks on Next');
{
  const n = next({ root: repo(ASTRO), html: [] });
  check(n.length && n.every((f) => f.state === 'not_applicable'), 'every next.* finding on Astro is not_applicable');
  const b = build({ root: repo(NEXT), dist: '/nonexistent', manifest: {} }).filter((f) => f.id.startsWith('astro.'));
  check(b.length && b.every((f) => f.state === 'not_applicable'), 'every astro.* build finding on Next is not_applicable');
}

scenario('a commented-out CSP is not a CSP, and the Netlify nonce plugin is one');
{
  const commented = nextConfig("// { key: 'Content-Security-Policy', value: CSP },\n        /* { key: 'Content-Security-Policy' } */");
  const none = find(security({ root: repo({ ...NEXT, 'next.config.ts': commented }) }), 'security.csp-present');
  check(/no CSP/.test(none.detail), `commented out: "no CSP" (got "${none.detail}")`);

  const live = find(security({ root: repo({ ...NEXT, 'next.config.ts': nextConfig("{ key: 'Content-Security-Policy', value: \"default-src 'self' https://example.stanford.edu\" },") }) }), 'security.csp-present');
  check(/CSP set by headers\(\) in the Next config/.test(live.detail), 'set in headers(): credited to headers()');

  const plugin = find(security({ root: repo({ ...NEXT, 'next.config.ts': nextConfig(), 'netlify.toml': '[[plugins]]\n  package = "@netlify/plugin-csp-nonce"\n' }) }), 'security.csp-present');
  check(/CSP set by @netlify\/plugin-csp-nonce/.test(plugin.detail), 'from the Netlify plugin: credited to the plugin');

  const onlyComments = nextConfig().replace(/\{ key: 'X-Frame-Options'.*\},/, "// { key: 'X-Frame-Options', value: 'SAMEORIGIN' },");
  const missing = find(security({ root: repo({ ...NEXT, 'next.config.ts': onlyComments }) }), 'security.headers-set');
  check(missing.state === 'fail' && /frame options/.test(missing.detail), 'a header only in a comment is reported missing');

  const urls = find(security({ root: repo({ ...NEXT, 'next.config.ts': nextConfig() }) }), 'security.headers-set');
  check(urls.state === 'pass', 'a URL in a string is not mistaken for a comment');
}

scenario('shared SEO checks give the fix for the framework in front of them');
{
  const page = (root) => {
    const f = join(root, 'out', 'index.html');
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, '<!doctype html><html lang="en"><head><title>Home</title></head><body></body></html>');
    return { root, html: [f], dist: join(root, 'out') };
  };
  const onNext = seo(page(repo(NEXT)));
  check(/metadataBase/.test(find(onNext, 'seo.canonical').fix) && !/`site`/.test(find(onNext, 'seo.canonical').fix),
    'Next: the canonical fix names metadataBase, not `site`');
  check(/app\/sitemap\.ts/.test(find(onNext, 'seo.sitemap').fix), 'Next: the sitemap fix names app/sitemap.ts');
  const onAstro = seo(page(repo(ASTRO)));
  check(/`site`/.test(find(onAstro, 'seo.canonical').fix), 'Astro: the canonical fix names `site`');
  check(/@astrojs\/sitemap/.test(find(onAstro, 'seo.sitemap').fix), 'Astro: the sitemap fix names @astrojs/sitemap');
}

for (const d of scratch) rmSync(d, { recursive: true, force: true });
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
