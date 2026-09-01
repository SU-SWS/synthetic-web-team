// axe runner. Separate from the check modules because it needs a real browser,
// which the CLI deliberately does not depend on.
//
// THE RULE THIS FILE EXISTS TO OBEY: a check that cannot run reports `unknown`,
// never `pass`. A harness in this project once printed "TOTAL VIOLATIONS: 0"
// while axe had silently failed to load. Every early return below writes a
// status other than `ok`, and the reader in checks.mjs turns anything that is
// not `ok` into `unknown`. There is no code path here that can produce a clean
// result without axe having actually reported one.
//
// Shared browser plumbing lives in browser.mjs, alongside the perf runner.

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  serve, launchChromium, settleAnimations, revealAll, routeFor, newestMtime, writeResults, fromProject,
} from './browser.mjs';

export const RESULTS_PATH = join('.sws', 'axe-results.json');
export const SCHEMA = 1;

// The policy target, and nothing above it. Siteimprove's AAA and best-practice
// findings are reported separately and are not this check's business.
export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export { newestMtime };

/**
 * Run axe over every built route. Always resolves; never throws. The returned
 * payload's `status` is `ok` only when axe genuinely reported on every route.
 */
export async function runAxe({ root, dist, html }) {
  const started = new Date().toISOString();
  const bail = (status, detail) => writeResults(root, RESULTS_PATH, {
    schema: SCHEMA, status, detail, generated: started, tags: TAGS, routes: [],
  });

  if (!dist || !existsSync(dist)) return bail('no-build', 'no build output found; run the build first');
  if (!html.length) {
    return bail('no-build', `no HTML found in ${relative(root, dist) || dist}; run the build first`);
  }

  // Dependencies live in the project. Missing ones are a normal, expected state.
  let AxeBuilder;
  try {
    // Exports both `default` and `AxeBuilder`; take whichever is a constructor
    // so an upstream packaging change does not silently break the run.
    const axeMod = await fromProject(root, '@axe-core/playwright');
    AxeBuilder = typeof axeMod.default === 'function' ? axeMod.default : axeMod.AxeBuilder;
    if (typeof AxeBuilder !== 'function') throw new Error('@axe-core/playwright did not export a constructor');
  } catch (err) {
    return bail('deps-missing',
      `${err.message}. Install with: npm i -D @playwright/test @axe-core/playwright && npx playwright install chromium`);
  }

  const { browser, playwrightPkg, error } = await launchChromium(root);
  if (error) {
    return bail(/Playwright package/.test(error) ? 'deps-missing' : 'browser-unavailable', error);
  }

  const srv = await serve(dist);
  const versions = { playwright: playwrightPkg, browser: browser.version() };
  const routes = [];
  let engine = null;

  try {
    const context = await browser.newContext();
    for (const file of html) {
      const route = routeFor(dist, file);
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      try {
        const resp = await page.goto(`${srv.origin}${route}`, { waitUntil: 'load', timeout: 30_000 });
        if (!resp || !resp.ok()) throw new Error(`HTTP ${resp ? resp.status() : 'no response'}`);

        // TWO STEPS, IN THIS ORDER, EACH FOR A DIFFERENT MEASURED BUG.
        //
        // 1. revealAll: entry motion holds below-fold content at opacity 0
        //    until it scrolls into view, and axe SKIPS invisible elements. So
        //    without scrolling, whole sections go unaudited and the clean
        //    result is a false negative -- which is worse than a false
        //    positive, because a false positive gets investigated. Measured on
        //    this project's own site: 116 rule-nodes unscrolled, 145 scrolled.
        //
        // 2. settleAnimations: axe's color-contrast rule reads *computed*
        //    colour, so an element captured mid-fade reports the blend against
        //    its backdrop. This site once produced four such failures at ratios
        //    of 1.05 to 1.55 (#f9f9f9 on #ffffff), all false.
        //
        // Reveal first, then settle: scrolling is what starts the animations
        // that then need to finish.
        await revealAll(page);
        await settleAnimations(page);

        const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

        // THE GUARD. axe returning four empty buckets means it did not run. A
        // real audit always classifies rules somewhere. Without this, a failed
        // injection reads as a clean page, which is the bug in the header above.
        const classified = (results.violations?.length ?? 0) + (results.passes?.length ?? 0)
          + (results.incomplete?.length ?? 0) + (results.inapplicable?.length ?? 0);
        if (!results.testEngine?.version || classified === 0) {
          throw new Error('axe reported no rule results at all, so it did not run');
        }
        engine ??= results.testEngine;

        routes.push({
          route,
          file: relative(root, file),
          status: 'ok',
          counts: {
            violations: results.violations.length,
            passes: results.passes.length,
            incomplete: results.incomplete.length,
            // Node counts, not just rule counts. Rules stay flat while coverage
            // changes, so this is the number that shows whether entry motion is
            // hiding content from the audit.
            passNodes: results.passes.reduce((a, r) => a + r.nodes.length, 0),
            violationNodes: results.violations.reduce((a, r) => a + r.nodes.length, 0),
          },
          pageErrors,
          violations: results.violations.map((v) => ({
            id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
            tags: v.tags.filter((t) => TAGS.includes(t)),
            nodes: v.nodes.slice(0, 5).map((n) => ({
              target: n.target.join(' '),
              failureSummary: (n.failureSummary || '').replace(/\s+/g, ' ').trim(),
            })),
            nodeCount: v.nodes.length,
          })),
        });
      } catch (err) {
        // One bad route does not invalidate the others, but it does mean the run
        // is incomplete, which the aggregate status below reflects.
        routes.push({ route, file: relative(root, file), status: 'error', error: err.message, pageErrors });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await srv.stop();
  }

  const failed = routes.filter((r) => r.status !== 'ok');
  return writeResults(root, RESULTS_PATH, {
    schema: SCHEMA,
    // `partial` is deliberately not `ok`: an incomplete run cannot award points.
    status: failed.length === 0 ? 'ok' : (failed.length === routes.length ? 'error' : 'partial'),
    detail: failed.length ? `${failed.length} of ${routes.length} route(s) could not be audited` : undefined,
    generated: started,
    finished: new Date().toISOString(),
    distMtime: newestMtime(dist),
    tags: TAGS,
    versions: { ...versions, axe: engine?.version ?? null },
    totals: {
      routes: routes.length,
      violations: routes.reduce((a, r) => a + (r.counts?.violations ?? 0), 0),
      incomplete: routes.reduce((a, r) => a + (r.counts?.incomplete ?? 0), 0),
    },
    routes,
  });
}
