// Performance budget runner. Measures first-party transfer bytes and request
// counts per route in real Chromium, using the same plumbing as the axe runner.
//
// Deliberately NOT Lighthouse. The reasoning is in
// standards/stack/performance-budget.yml and the short version is that a
// Lighthouse score moves ten points between runs on a shared CI runner, and a
// self-moving number in a trended compliance score teaches people to ignore the
// score. Bytes are exact.
//
// Same honesty rule as axe: anything that could not be measured writes a status
// other than `ok`, and the reader in checks.mjs turns that into `unknown`.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import YAML from 'yaml';
import {
  serve, launchChromium, settleAnimations, routeFor, newestMtime, writeResults,
} from './browser.mjs';

export const RESULTS_PATH = join('.sws', 'perf-results.json');
export const SCHEMA = 1;

const KB = 1024;

/** Load the budget standard, then apply any project override from the manifest. */
export function loadBudget({ standards, manifest }) {
  const p = standards ? join(standards, 'stack', 'performance-budget.yml') : null;
  if (!p || !existsSync(p)) return { error: `no performance budget at ${p ?? 'standards/stack/performance-budget.yml'}` };

  let doc;
  try { doc = YAML.parse(readFileSync(p, 'utf8')); }
  catch (err) { return { error: `performance-budget.yml is not valid YAML: ${err.message}` }; }

  const b = doc?.budgets;
  if (!b?.total_kb) return { error: 'performance-budget.yml has no budgets.total_kb' };

  const limits = {
    total_kb: b.total_kb,
    requests: b.requests,
    ...(b.by_type ?? {}),
  };

  // A project override is a recorded divergence, not a workaround, so track
  // which keys came from the manifest and say so in the report.
  const overrides = {};
  const o = manifest?.performance_budget;
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'reason') continue;
      if (typeof v === 'number' && k in limits) { limits[k] = v; overrides[k] = v; }
    }
  }

  return {
    limits, overrides,
    overrideReason: o?.reason ?? null,
    thirdParty: doc.third_party ?? {},
    version: doc.version ?? null,
  };
}

// Classify by content-type, falling back to the URL extension. Content-type is
// authoritative when present; a local server can be terse about unusual types.
function classify(contentType, url) {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  if (ct.startsWith('image/')) return 'images';
  if (ct.startsWith('font/')) return 'fonts';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'js';
  if (ct.includes('css')) return 'css';
  if (ct.includes('html')) return 'html';
  if (!ct) {
    const ext = (url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'ico'].includes(ext)) return 'images';
    if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) return 'fonts';
    if (['js', 'mjs', 'cjs'].includes(ext)) return 'js';
    if (ext === 'css') return 'css';
    if (['html', 'htm'].includes(ext)) return 'html';
  }
  return 'other';
}

/**
 * Measure every built route. Always resolves; never throws.
 */
export async function runPerf({ root, dist, html, standards, manifest }) {
  const started = new Date().toISOString();
  const bail = (status, detail) => writeResults(root, RESULTS_PATH, {
    schema: SCHEMA, status, detail, generated: started, routes: [],
  });

  if (!dist || !existsSync(dist)) return bail('no-build', 'no build output found; run the build first');
  if (!html.length) {
    return bail('no-build', `no HTML found in ${relative(root, dist) || dist}; run the build first`);
  }

  const budget = loadBudget({ standards, manifest });
  if (budget.error) return bail('no-budget', budget.error);

  const { browser, playwrightPkg, error } = await launchChromium(root);
  if (error) {
    return bail(/Playwright package/.test(error) ? 'deps-missing' : 'browser-unavailable', error);
  }

  const srv = await serve(dist);
  const routes = [];

  try {
    const context = await browser.newContext();
    for (const file of html) {
      const route = routeFor(dist, file);
      const page = await context.newPage();

      const bytes = { html: 0, css: 0, js: 0, images: 0, fonts: 0, other: 0 };
      const thirdParty = new Map();
      let firstPartyRequests = 0;

      page.on('response', async (res) => {
        const url = res.url();
        const isFirstParty = url.startsWith(srv.origin);
        let len = 0;
        try {
          // Uncompressed body length. The local server does not gzip, so for
          // first-party assets this is the raw size, which is what the budget
          // is calibrated against.
          len = (await res.body()).length;
        } catch {
          // Redirects and aborted requests have no body. Not an error.
        }
        if (isFirstParty) {
          firstPartyRequests++;
          bytes[classify(res.headers()['content-type'], url)] += len;
        } else {
          const origin = (() => { try { return new URL(url).origin; } catch { return url; } })();
          const prev = thirdParty.get(origin) ?? { bytes: 0, requests: 0 };
          thirdParty.set(origin, { bytes: prev.bytes + len, requests: prev.requests + 1 });
        }
      });

      try {
        const resp = await page.goto(`${srv.origin}${route}`, { waitUntil: 'load', timeout: 30_000 });
        if (!resp || !resp.ok()) throw new Error(`HTTP ${resp ? resp.status() : 'no response'}`);
        await settleAnimations(page);

        // Unscored context only. See the header: lab timings on a build server
        // are not evidence about a reader on campus wifi.
        const timings = await page.evaluate(() => {
          const n = performance.getEntriesByType('navigation')[0];
          return n ? {
            domContentLoaded: Math.round(n.domContentLoadedEventEnd),
            load: Math.round(n.loadEventEnd),
          } : null;
        }).catch(() => null);

        const total = Object.values(bytes).reduce((a, b) => a + b, 0);
        routes.push({
          route,
          file: relative(root, file),
          status: 'ok',
          firstParty: {
            total_kb: +(total / KB).toFixed(1),
            requests: firstPartyRequests,
            by_type_kb: Object.fromEntries(
              Object.entries(bytes).map(([k, v]) => [k, +(v / KB).toFixed(1)])),
          },
          thirdParty: [...thirdParty.entries()]
            .map(([origin, v]) => ({ origin, kb: +(v.bytes / KB).toFixed(1), requests: v.requests }))
            .sort((a, b) => b.kb - a.kb),
          timings_ms_unscored: timings,
        });
      } catch (err) {
        routes.push({ route, file: relative(root, file), status: 'error', error: err.message });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await srv.stop();
  }

  const failedRoutes = routes.filter((r) => r.status !== 'ok');
  const okRoutes = routes.filter((r) => r.status === 'ok');

  // Evaluate the budget per route. The worst route decides, because a reader
  // lands on one page, not on an average.
  const breaches = [];
  for (const r of okRoutes) {
    const checks = [
      ['total_kb', r.firstParty.total_kb],
      ['requests', r.firstParty.requests],
      ...Object.entries(r.firstParty.by_type_kb).map(([k, v]) => [`${k}_kb`, v]),
    ];
    for (const [key, actual] of checks) {
      const limit = budget.limits[key];
      if (typeof limit === 'number' && actual > limit) {
        breaches.push({ route: r.route, key, actual, limit, overridden: key in budget.overrides });
      }
    }
  }

  const origins = new Set(okRoutes.flatMap((r) => r.thirdParty.map((t) => t.origin)));

  return writeResults(root, RESULTS_PATH, {
    schema: SCHEMA,
    status: failedRoutes.length === 0 ? 'ok'
      : (failedRoutes.length === routes.length ? 'error' : 'partial'),
    detail: failedRoutes.length ? `${failedRoutes.length} of ${routes.length} route(s) could not be measured` : undefined,
    generated: started,
    finished: new Date().toISOString(),
    distMtime: newestMtime(dist),
    versions: { playwright: playwrightPkg, browser: browser.version() },
    budget: {
      version: budget.version,
      limits: budget.limits,
      overrides: budget.overrides,
      overrideReason: budget.overrideReason,
      measures: 'first-party uncompressed bytes',
    },
    totals: {
      routes: routes.length,
      breaches: breaches.length,
      worst_total_kb: okRoutes.length ? Math.max(...okRoutes.map((r) => r.firstParty.total_kb)) : null,
      third_party_origins: origins.size,
      third_party_kb: +(okRoutes.reduce((a, r) => a + r.thirdParty.reduce((x, t) => x + t.kb, 0), 0)).toFixed(1),
    },
    breaches,
    thirdPartyOrigins: [...origins].sort(),
    routes,
  });
}
