// Shared plumbing for the two checks that need a real browser: axe and the
// performance budget. Extracted so they cannot drift apart, because the
// interesting parts are the same for both — serving a build with a framework
// `base` prefix, resolving Playwright from the consumer's project rather than
// this CLI, and waiting for animations before measuring anything.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// How long to let CSS animations settle before measuring. Too short and axe
// reads colour mid-fade; see the long note at the analyze() call in axe.mjs.
export const ANIMATION_BUDGET_MS = 2500;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

// Astro's `base` is the wrinkle: with base set, files sit at the dist root but
// internal links point at /<base>/..., so a naive server 404s every asset and
// the page gets measured unstyled. Rather than parsing framework config, try
// progressively looser resolutions.
function resolveFile(dist, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const segments = clean.split('/').filter((s) => s && s !== '.' && s !== '..');
  for (const segs of [segments, segments.slice(1)]) {
    const base = join(dist, ...segs);
    for (const p of [base, `${base}.html`, join(base, 'index.html')]) {
      // Containment: never serve outside dist, even though the input is ours.
      if (!p.startsWith(dist + sep) && p !== dist) continue;
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
  }
  return null;
}

/** Static server over the build output. Resolves to { server, port, origin, stop }. */
export function serve(dist) {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const file = resolveFile(dist, req.url || '/');
      if (!file) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        server, port,
        origin: `http://127.0.0.1:${port}`,
        stop: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

// Files the CLI itself writes into the build output. Excluded from the staleness
// calculation because we know we wrote them and they are not a rebuild.
//
// Without this, the recommended pipeline defeats its own guard: `sws check
// --badge dist/badge.json` bumps the directory mtime, so a later `sws doctor`
// decides the axe and perf results predate the build and withholds 13 points.
// A false `unknown` is safe but it is still a false alarm, and false alarms are
// what get a check switched off. Observed while wiring this project's own Pages
// workflow.
//
// Deliberately a short, explicit list rather than a pattern: anything else
// appearing in dist after a measurement genuinely should invalidate it.
export const CLI_ARTIFACTS = new Set(['badge.json']);

// Newest mtime anywhere in dist. Both runners record it and both readers
// recompute it, so they MUST agree on the exclusions — hence one shared set.
// A pass recorded against a previous build is not evidence about this one, and
// in a report the two are indistinguishable.
export function newestMtime(dir) {
  let newest = 0;
  (function walk(d, depth) {
    for (const name of readdirSync(d)) {
      if (depth === 0 && CLI_ARTIFACTS.has(name)) continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p, depth + 1);
      else newest = Math.max(newest, st.mtimeMs);
    }
  })(dir, 0);
  return newest;
}

export function writeResults(root, relPath, payload) {
  mkdirSync(join(root, '.sws'), { recursive: true });
  writeFileSync(join(root, relPath), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

// Resolve a module from the project's node_modules, not the CLI's.
//
// CJS interop matters here and cost a debugging round. Both `playwright` and
// `@playwright/test` are CommonJS, so `import()` returns a namespace whose named
// exports are whatever cjs-module-lexer detected statically — `chromium` is not
// among them and lands only on `.default`. Reading `mod.chromium` alone looks
// exactly like "Playwright is not installed". Merge default onto the namespace
// so callers see one shape.
export async function fromProject(root, name) {
  const req = createRequire(join(root, 'package.json'));
  const mod = await import(pathToFileURL(req.resolve(name)).href);
  const d = mod.default;
  return (d && typeof d === 'object') ? { ...d, ...mod } : mod;
}

/**
 * Find Playwright in the project and launch Chromium.
 * Returns { browser, playwrightPkg } or { error } — never throws, because a
 * missing browser is a normal state that must read as `unknown`, not a crash.
 */
export async function launchChromium(root) {
  let pw, playwrightPkg;
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    try { pw = await fromProject(root, name); playwrightPkg = name; break; } catch { /* next */ }
  }
  const chromium = pw?.chromium ?? pw?.default?.chromium;
  if (!chromium?.launch) {
    return { error: 'no Playwright package exporting `chromium`. Install with: npm i -D @playwright/test && npx playwright install chromium' };
  }
  try {
    const browser = await chromium.launch();
    return { browser, playwrightPkg };
  } catch (err) {
    // Overwhelmingly "browser not downloaded". Say the fix.
    return { error: `could not launch Chromium: ${err.message.split('\n')[0]}. Try: npx playwright install chromium` };
  }
}

/**
 * Let entry animations finish before measuring. Bounded, because an infinite
 * animation (a spinner) never finishes. Never throws.
 */
export async function settleAnimations(page, budget = ANIMATION_BUDGET_MS) {
  await page.evaluate(async (ms) => {
    const anims = document.getAnimations ? document.getAnimations() : [];
    if (!anims.length) return;
    await Promise.race([
      // allSettled: a cancelled animation rejects, and that is not an error.
      Promise.allSettled(anims.map((a) => a.finished)),
      new Promise((r) => setTimeout(r, ms)),
    ]);
  }, budget).catch(() => { /* measuring an unsettled page beats failing the route */ });
}

/** dist-relative file path -> the URL path a reader would visit. */
export function routeFor(dist, file) {
  const rel = file.slice(dist.length + 1).split(sep).join('/');
  return `/${rel}`.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
}
