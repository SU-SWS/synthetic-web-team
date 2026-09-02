// All checks live here. Each returns an array of findings:
//   { id, state, detail, fix? }
// state is one of: pass | fail | unknown | not_applicable
//
// THE RULE THAT MATTERS: a check that cannot run returns `unknown`, never
// `pass`. This is not theoretical. A harness in this project once printed
// "TOTAL VIOLATIONS: 0" while axe had silently failed to load. A report that
// says clean when it means did not run is worse than no report.
//
// Second rule: report per item. "The footer is wrong" is not actionable.
// "Trademarks points at the wrong URL" is.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'node-html-parser';
import YAML from 'yaml';
import { RESULTS_PATH as AXE_RESULTS_PATH, SCHEMA as AXE_SCHEMA } from './axe.mjs';
import { RESULTS_PATH as PERF_RESULTS_PATH, SCHEMA as PERF_SCHEMA } from './perf.mjs';
import { newestMtime } from './browser.mjs';

const read = (p) => readFileSync(p, 'utf8');
const readYaml = (p) => YAML.parse(read(p));
const ok = (id, detail) => ({ id, state: 'pass', detail });
const bad = (id, detail, fix) => ({ id, state: 'fail', detail, fix });
const dunno = (id, detail) => ({ id, state: 'unknown', detail });
const na = (id, detail) => ({ id, state: 'not_applicable', detail });

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

export function findHtml(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.html')) out.push(p);
    }
  })(dir);
  return out.sort();
}

function pkg(root) {
  const p = join(root, 'package.json');
  return existsSync(p) ? JSON.parse(read(p)) : null;
}

function deps(root) {
  const j = pkg(root);
  if (!j) return {};
  return { ...(j.dependencies || {}), ...(j.devDependencies || {}) };
}

function installed(root, name) {
  const p = join(root, 'node_modules', name, 'package.json');
  return existsSync(p) ? JSON.parse(read(p)) : null;
}

// --------------------------------------------------------------------------
// footer: reads the contract, never hardcodes the link set
// --------------------------------------------------------------------------

export function footer({ root, html, standards }) {
  const contractPath = join(standards, 'fragments', 'global-footer.yml');
  if (!existsSync(contractPath)) {
    return [dunno('footer.global.present', `contract not found at ${contractPath}`)];
  }
  if (!html.length) {
    return [dunno('footer.global.present', 'no built HTML found; run the build first')];
  }

  const c = readYaml(contractPath);
  const expected = [...c.resource_links, ...c.policy_links];
  const out = [];

  const missingFooter = [];
  for (const f of html) {
    const doc = parse(read(f));
    if (!doc.querySelector('footer')) missingFooter.push(relative(root, f));
  }
  out.push(
    missingFooter.length
      ? bad('footer.global.present', `no <footer> on ${missingFooter.length} page(s): ${missingFooter.slice(0, 3).join(', ')}`,
          'Add the Global Footer to the shared layout.')
      : ok('footer.global.present', `present on all ${html.length} page(s)`)
  );

  // Link set, checked on the first page. The footer is in a shared layout, so
  // per-page divergence is a different (rarer) problem than a wrong contract.
  const doc = parse(read(html[0]));
  const footEl = doc.querySelector('footer');
  if (!footEl) {
    out.push(dunno('footer.global.exact', 'no footer to inspect'));
    out.push(dunno('footer.no-additions', 'no footer to inspect'));
    return out;
  }

  const anchors = footEl.querySelectorAll('a').map((a) => ({
    label: a.text.replace(/\s+/g, ' ').trim(),
    href: (a.getAttribute('href') || '').trim(),
  }));

  const problems = [];
  for (const want of expected) {
    const hit = anchors.find((a) => a.label === want.label);
    if (!hit) problems.push(`missing link "${want.label}"`);
    else if (hit.href !== want.href) {
      problems.push(`"${want.label}" points at ${hit.href}, contract says ${want.href}`);
    }
  }
  const order = expected.map((e) => e.label).filter((l) => anchors.some((a) => a.label === l));
  const actualOrder = anchors.map((a) => a.label).filter((l) => order.includes(l));
  if (order.join('|') !== actualOrder.join('|')) problems.push('link order differs from the contract');

  out.push(
    problems.length
      ? bad('footer.global.exact', problems.join('; '),
          'The Global Footer is immutable. The contract is standards/fragments/global-footer.yml.')
      : ok('footer.global.exact', `all ${expected.length} links match label, href, and order`)
  );

  const extra = anchors.filter((a) => !expected.some((e) => e.label === a.label));
  out.push(
    extra.length
      ? bad('footer.no-additions',
          `${extra.length} link(s) not in the contract: ${extra.map((e) => `"${e.label}"`).join(', ')}`,
          'Unit links belong in a LOCAL footer above the Global Footer, not inside it.')
      : ok('footer.no-additions', 'no additional links inside the Global Footer')
  );

  const text = footEl.text.replace(/\s+/g, ' ');
  const missingCopy = (c.copyright?.lines || []).filter((l) => !text.includes(l.replace('©', '©')));
  out.push(
    missingCopy.length
      ? bad('footer.copyright', `missing: ${missingCopy.join(' / ')}`, 'Both copyright lines are part of the fragment.')
      : ok('footer.copyright', 'copyright lines present')
  );

  const a11yLink = anchors.find((a) => a.label === 'Accessibility');
  out.push(
    a11yLink ? ok('a11y.link-present', `Accessibility link -> ${a11yLink.href}`)
             : bad('a11y.link-present', 'no Accessibility link in the footer',
                   'MinWeb requires a barrier-reporting link. Normally https://www.stanford.edu/site/accessibility')
  );

  return out;
}

// --------------------------------------------------------------------------
// identity bar: DOM POSITION, not string order
// --------------------------------------------------------------------------

export function identity({ root, html, standards, dist }) {
  if (!html.length) return [dunno('brand.identity-bar.present', 'no built HTML found')];

  const SELECTORS = ['#su-identity', '.su-identity', '[data-su-identity]', '#stanford-identity'];
  const out = [];
  const missing = [];
  const badOrder = [];

  for (const f of html) {
    const doc = parse(read(f));
    const body = doc.querySelector('body');
    if (!body) { missing.push(relative(root, f)); continue; }

    const kids = body.childNodes.filter((n) => n.nodeType === 1);
    const idx = kids.findIndex((el) => SELECTORS.some((s) => {
      try { return el.matches?.(s); } catch { return false; }
    }));

    if (idx === -1) { missing.push(relative(root, f)); continue; }

    // Permitted: index 0, or index 1 preceded only by a skip link.
    const first = kids[0];
    const firstIsSkip =
      first?.rawTagName === 'a' &&
      (/skip/i.test(first.getAttribute('class') || '') || /skip/i.test(first.text || ''));
    if (!(idx === 0 || (idx === 1 && firstIsSkip))) {
      badOrder.push(`${relative(root, f)}: identity bar is child ${idx}, preceded by <${kids.slice(0, idx).map((k) => k.rawTagName).join(', ')}>`);
    }
  }

  out.push(
    missing.length
      ? bad('brand.identity-bar.present', `not found on ${missing.length} page(s): ${missing.slice(0, 3).join(', ')}`,
          'Add the Stanford Identity Bar to the shared layout.')
      : ok('brand.identity-bar.present', `present on all ${html.length} page(s)`)
  );
  out.push(
    badOrder.length
      ? bad('brand.identity-bar.nothing-above', badOrder.slice(0, 3).join(' | '),
          'Only a skip navigation link may precede the Identity Bar.')
      : ok('brand.identity-bar.nothing-above', 'nothing precedes it except the skip link')
  );

  // ---- exact markup, which is what fixes the height ----------------------
  //
  // CLASSES, NOT PIXELS. A measured height would be the obvious check and it
  // would be flaky: the bar measures 28.8px at 1280px and 30.1px at 1600px,
  // because the line box depends on the metrics of whichever font actually
  // resolves for --font-stanford. A brand check that drifts by a pixel gets
  // switched off. The classes are exact, deterministic, and on Decanter's scale
  // they can only produce the Stanford height.
  //
  // This exists because this project shipped a bar at roughly 44px -- `py-12` in
  // a centred wrapper with `font-serif text-24 md:text-27` -- which was visibly
  // taller than every other Stanford site.
  const fragPath = standards && join(standards, 'fragments', 'identity-bar.yml');
  if (!fragPath || !existsSync(fragPath)) {
    out.push(dunno('brand.identity-bar.exact', `contract not found at ${fragPath ?? 'standards/fragments/identity-bar.yml'}`));
    return out;
  }

  let frag;
  try { frag = readYaml(fragPath); }
  catch (err) { out.push(dunno('brand.identity-bar.exact', `contract is not valid YAML: ${err.message}`)); return out; }

  const problems = [];
  const classesOf = (el) => (el?.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  const offend = (list, patterns) => (patterns ?? [])
    .flatMap((rx) => list.filter((c) => new RegExp(rx).test(c)).map((c) => ({ c, rx })));

  // The bar is in a shared layout, so the first page is representative; a
  // per-page divergence is a different and rarer problem.
  const doc = parse(read(html[0]));
  const bar = SELECTORS.map((sel) => { try { return doc.querySelector(sel); } catch { return null; } }).find(Boolean);

  if (!bar) {
    out.push(dunno('brand.identity-bar.exact', 'no Identity Bar element to inspect'));
    return out;
  }

  const barClasses = classesOf(bar);
  for (const want of frag.container?.classes ?? []) {
    if (!barClasses.includes(want)) problems.push(`bar is missing \`${want}\``);
  }
  for (const { c, rx } of offend(barClasses, frag.container?.disallowed_class_patterns)) {
    problems.push(`bar has \`${c}\`, which changes its height (matches ${rx})`);
  }

  const link = bar.querySelector('a');
  if (!link) {
    problems.push('bar contains no link');
  } else {
    const linkClasses = classesOf(link);
    for (const want of frag.link?.classes ?? []) {
      if (!linkClasses.includes(want)) problems.push(`logo link is missing \`${want}\``);
    }
    for (const { c, rx } of offend(linkClasses, frag.link?.disallowed_class_patterns)) {
      problems.push(`logo link has \`${c}\`, which changes its size (matches ${rx})`);
    }
    const href = (link.getAttribute('href') || '').trim();
    if (frag.link?.href && href !== frag.link.href) {
      problems.push(`logo link points at ${href || '(nothing)'}, contract says ${frag.link.href}`);
    }
  }

  // ---- the Stanford ligature font -----------------------------------------
  //
  // If the bar is on the page, this font is required. Decanter's
  // --font-stanford falls back to Source Serif 4, so omitting it does not error
  // -- the wordmark just renders in the wrong typeface, and the bar comes out
  // 28.8px instead of 30.8px. It looks like a rendering quirk rather than a
  // brand defect, which is exactly why it needs a check.
  //
  // Decanter 8 publishes no font assets, so "we installed Decanter" is not
  // enough: the @font-face has to be declared by the project.
  if (frag.font?.required) {
    const css = [];
    (function walk(d) {
      if (!existsSync(d)) return;
      for (const name of readdirSync(d)) {
        const fp = join(d, name);
        if (statSync(fp).isDirectory()) walk(fp);
        else if (fp.endsWith('.css')) css.push(read(fp));
      }
    })(dist ?? '');
    // Inline <style> counts too, and so does a linked stylesheet we cannot see
    // (a CDN URL in the markup), so search the HTML as well.
    const haystack = [...css, ...html.map(read)].join('\n');

    const family = frag.font.family ?? 'Stanford';
    const declared = new RegExp(`@font-face[^}]*font-family\\s*:\\s*['"]?${family}['"]?`, 'i').test(haystack)
      || new RegExp(`font-family\\s*:\\s*['"]?${family}['"]?[^}]*src\\s*:`, 'i').test(haystack);
    const referenced = (frag.font.sources ?? [])
      .some((src) => src.url && haystack.includes(src.url.split('/').pop()));

    out.push(declared || referenced
      ? ok('brand.identity-bar.font-loaded', `${family} font face declared`)
      : bad('brand.identity-bar.font-loaded',
          `the Identity Bar is present but no @font-face for "${family}" was found in the build`,
          `Without it, --font-stanford falls back to Source Serif 4: the wordmark renders in the wrong typeface and the bar measures ${frag.measured?.bar_height_px ? '28.8px instead of ' + frag.measured.bar_height_px + 'px' : 'the wrong height'}. Decanter 8 ships no font assets, so declare it yourself — the CSS is in standards/fragments/identity-bar.yml under font.css, served from the University Communications media CDN.`));
  }

  out.push(problems.length
    ? bad('brand.identity-bar.exact', problems.slice(0, 4).join('; '),
        `The Identity Bar is brand furniture with a fixed height. Use the markup in standards/fragments/identity-bar.yml verbatim: ${(frag.container?.classes ?? []).join(' ')} on the container, and \`logo inline-block text-20 leading-none\` on the link. Not font-serif -- \`logo\` is a Decanter component class carrying the Stanford font and its ligatures.`)
    : ok('brand.identity-bar.exact', `matches the contract (extracted ${frag.extracted ?? 'unknown'}), ~${frag.measured?.bar_height_px ?? '?'}px tall`));

  return out;
}

// --------------------------------------------------------------------------
// decanter: check the whole dependency tree, not just the top level
// --------------------------------------------------------------------------

export function decanter({ root }) {
  const out = [];
  const d = installed(root, 'decanter');
  const declared = deps(root).decanter;

  if (!d) {
    out.push(declared
      ? dunno('decanter.installed', `declared as "${declared}" but not installed; run install first`)
      : na('decanter.installed', 'decanter is not a dependency of this project'));
  } else {
    const major = String(d.version).split('.')[0];
    out.push(major === '8'
      ? ok('decanter.installed', `decanter ${d.version}`)
      : bad('decanter.installed', `decanter resolved to ${d.version}, expected 8.x`,
            'v7 is a Tailwind 3 JS preset and v8 is CSS-first. Install decanter@^8, or note that the git v8 branch form is also valid.'));

    out.push(d.main === 'src/css/index.css'
      ? ok('decanter.css-first', `main is ${d.main}`)
      : bad('decanter.css-first', `main is "${d.main}", expected src/css/index.css`,
            'A tailwind.config.js main field means v7 is installed.'));
  }

  // Nested tailwind is the silent v7 tell.
  const nested = join(root, 'node_modules', 'decanter', 'node_modules', 'tailwindcss');
  out.push(existsSync(nested)
    ? bad('decanter.no-nested-tailwind', 'node_modules/decanter/node_modules/tailwindcss exists',
          'v7 crept in beneath a v4 top level. Delete node_modules and the lockfile, then reinstall.')
    : ok('decanter.no-nested-tailwind', 'no nested tailwind under decanter'));

  const tw = installed(root, 'tailwindcss');
  out.push(!tw
    ? dunno('decanter.tailwind-major', 'tailwindcss not installed')
    : String(tw.version).startsWith('4')
      ? ok('decanter.tailwind-major', `tailwindcss ${tw.version}`)
      : bad('decanter.tailwind-major', `tailwindcss ${tw.version}, expected 4.x`,
            'Decanter 8 requires Tailwind 4.'));

  const cfg = ['tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.ts']
    .filter((f) => existsSync(join(root, f)));
  out.push(cfg.length
    ? bad('decanter.no-js-config', `found ${cfg.join(', ')}`,
          'Decanter 8 has no JS config. Its presence signals a v7 mental model.')
    : ok('decanter.no-js-config', 'no tailwind JS config'));

  out.push(deps(root)['@astrojs/tailwind']
    ? bad('decanter.no-dead-integration', '@astrojs/tailwind is a dependency',
          'Dead package: supports neither current Astro nor Tailwind 4. Use @tailwindcss/vite.')
    : ok('decanter.no-dead-integration', '@astrojs/tailwind absent'));

  // Entry CSS: redundant tailwind import, and the @source myth.
  const cssFiles = [];
  (function walk(d) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p); }
      else if (n.endsWith('.css')) cssFiles.push(p);
    }
  })(join(root, 'src'));

  const entry = cssFiles.find((f) => /@import\s+['"]decanter['"]/.test(read(f)));
  if (!entry) {
    out.push(d ? bad('decanter.entry-css', 'no CSS file imports decanter',
              "Add @import 'decanter'; to your entry CSS. That is the whole integration.")
              : na('decanter.entry-css', 'decanter not in use'));
  } else {
    const body = read(entry);
    out.push(ok('decanter.entry-css', `${relative(root, entry)} imports decanter`));
    if (/@import\s+['"]tailwindcss['"]/.test(body)) {
      out.push(bad('decanter.no-redundant-tailwind-import',
        `${relative(root, entry)} imports both tailwindcss and decanter`,
        'Decanter imports Tailwind itself. Harmless but redundant, ~340 bytes.'));
    } else {
      out.push(ok('decanter.no-redundant-tailwind-import', 'no redundant tailwindcss import'));
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// seo
// --------------------------------------------------------------------------

export function seo({ root, html, dist }) {
  if (!html.length) return [dunno('seo.title-unique', 'no built HTML found')];
  const out = [];
  const titles = [];
  const noDesc = [];
  const noCanon = [];

  for (const f of html) {
    const doc = parse(read(f));
    const t = doc.querySelector('title')?.text?.trim();
    titles.push({ f: relative(root, f), t });
    const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
    if (!desc) noDesc.push(relative(root, f));
    if (!doc.querySelector('link[rel="canonical"]')) noCanon.push(relative(root, f));
  }

  const empty = titles.filter((x) => !x.t);
  const seen = new Map();
  for (const x of titles) if (x.t) seen.set(x.t, (seen.get(x.t) || 0) + 1);
  const dupes = [...seen].filter(([, n]) => n > 1).map(([t]) => t);

  out.push(empty.length || dupes.length
    ? bad('seo.title-unique',
        [empty.length && `${empty.length} page(s) with no title`,
         dupes.length && `duplicate title(s): ${dupes.slice(0, 2).map((d) => `"${d}"`).join(', ')}`]
          .filter(Boolean).join('; '),
        'Every page needs a unique, non-empty title.')
    : ok('seo.title-unique', `${titles.length} unique titles`));

  out.push(noDesc.length
    ? bad('seo.meta-description', `${noDesc.length} page(s) without one: ${noDesc.slice(0, 3).join(', ')}`)
    : ok('seo.meta-description', 'all pages have a meta description'));

  out.push(noCanon.length
    ? bad('seo.canonical', `${noCanon.length} page(s) without a canonical link`,
        'Requires `site` set in the framework config. Missing `site` also silently breaks the sitemap.')
    : ok('seo.canonical', 'canonical links present'));

  const sitemap = ['sitemap-index.xml', 'sitemap.xml'].find((f) => existsSync(join(dist, f)));
  out.push(sitemap
    ? ok('seo.sitemap', `${sitemap} emitted`)
    : bad('seo.sitemap', 'no sitemap in the build output',
        'Add @astrojs/sitemap and set `site` in the config.'));

  const robotsPath = join(dist, 'robots.txt');
  if (!existsSync(robotsPath)) {
    out.push(bad('seo.robots', 'no robots.txt', 'Add public/robots.txt with a Sitemap: reference.'));
    out.push(bad('seo.robots-ai-sections', 'no robots.txt'));
  } else {
    const r = read(robotsPath);
    out.push(/sitemap:/i.test(r)
      ? ok('seo.robots', 'robots.txt references the sitemap')
      : bad('seo.robots', 'robots.txt does not reference the sitemap'));
    const AI = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended'];
    const named = AI.filter((a) => r.includes(a));
    out.push(named.length
      ? ok('seo.robots-ai-sections', `addresses ${named.length} AI user agent(s)`)
      : { id: 'seo.robots-ai-sections', state: 'fail',
          detail: 'no AI crawler rules; silence is a default rather than a decision',
          fix: 'Allow retrieval bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot). Whether to allow TRAINING crawlers is a unit policy call, not ours to impose.' });
  }

  const llms = existsSync(join(dist, 'llms.txt'));
  out.push(llms
    ? { id: 'seo.no-llms-txt-on-marketing', state: 'fail',
        detail: 'llms.txt present',
        fix: '97% of published llms.txt files get zero requests and AI search crawlers read HTML directly. It is fetched by IDE coding agents, so it belongs on documentation sites only.' }
    : ok('seo.no-llms-txt-on-marketing', 'no llms.txt, correct for a unit site'));

  const ld = html.some((f) => read(f).includes('application/ld+json'));
  out.push(ld
    ? ok('seo.structured-data', 'JSON-LD present (for rich results, NOT an AI-citation lever)')
    : bad('seo.structured-data', 'no JSON-LD found',
        'Add EducationalOrganization or Organization plus BreadcrumbList. For rich results only.'));

  return out;
}

// --------------------------------------------------------------------------
// a11y: needs a real browser, so this reports unknown by design
// --------------------------------------------------------------------------
// axe: this module does not run axe, it reads what `sws a11y` recorded. Keeping
// the browser out of `sws check` means check stays fast and installable
// everywhere; the tradeoff is that a missing results file is a normal state and
// must read as `unknown` rather than as a failure.
//
// Four things become `unknown`, and the third is the one people get wrong:
//   1. no results file            axe was never run
//   2. status is not `ok`         deps missing, no browser, or a partial run
//   3. results predate the build  a stale pass is not a pass
//   4. schema mismatch            do not guess at an old shape
// --------------------------------------------------------------------------

export function axeFinding({ root, dist, html }) {
  // The finding id is repeated literally at every call site rather than held in
  // a variable. Deliberate: scripts/validate-criteria.mjs proves every emitted
  // id has a criterion by grepping this file statically, and a variable is
  // invisible to it. The gate caught exactly that when this module was written.
  const p = join(root, AXE_RESULTS_PATH);

  if (!existsSync(p)) {
    return dunno('a11y.axe.routes', !html.length
      ? 'no built HTML found; run the build, then `sws a11y`'
      : 'axe has not been run. Run `sws a11y` (needs @playwright/test and @axe-core/playwright in this project)');
  }

  let r;
  try { r = JSON.parse(read(p)); }
  catch (err) { return dunno('a11y.axe.routes', `${AXE_RESULTS_PATH} is not valid JSON (${err.message}); re-run \`sws a11y\``); }

  if (r.schema !== AXE_SCHEMA) {
    return dunno('a11y.axe.routes', `${AXE_RESULTS_PATH} is schema ${r.schema ?? '?'}, this CLI expects ${AXE_SCHEMA}; re-run \`sws a11y\``);
  }
  if (r.status !== 'ok') {
    return dunno('a11y.axe.routes', `axe did not complete (${r.status}): ${r.detail ?? 'no detail recorded'}`);
  }

  // Staleness. If anything in dist is newer than the recorded build state, the
  // results describe a build that no longer exists.
  if (dist && existsSync(dist)) {
    const now = newestMtime(dist);
    if (typeof r.distMtime === 'number' && now > r.distMtime + 1000) {
      return dunno('a11y.axe.routes', `axe results predate the current build (build is ${Math.round((now - r.distMtime) / 1000)}s newer); re-run \`sws a11y\``);
    }
  }

  const routes = Array.isArray(r.routes) ? r.routes : [];
  if (!routes.length) return dunno('a11y.axe.routes', 'axe results record no routes; re-run `sws a11y`');

  // Every built page should have been audited. A results file covering three of
  // twelve routes is not evidence about the other nine.
  if (html.length && routes.length < html.length) {
    return dunno('a11y.axe.routes', `axe covered ${routes.length} of ${html.length} built page(s); re-run \`sws a11y\``);
  }

  const offenders = routes.filter((x) => (x.counts?.violations ?? 0) > 0);
  const total = offenders.reduce((a, x) => a + x.counts.violations, 0);
  const engine = r.versions?.axe ? `axe ${r.versions.axe}` : 'axe';

  if (!offenders.length) {
    return ok('a11y.axe.routes', `${engine}: 0 violations across ${routes.length} route(s) at ${r.tags?.join(', ') ?? 'WCAG 2.1 AA'}`);
  }

  // Per item, not in aggregate. "The page has violations" is not actionable.
  const detail = offenders.slice(0, 4).map((x) => {
    const worst = x.violations.slice(0, 3)
      .map((v) => `${v.id}${v.nodeCount > 1 ? ` x${v.nodeCount}` : ''}`).join(', ');
    return `${x.route}: ${worst}`;
  }).join(' | ');

  return bad('a11y.axe.routes',
    `${engine}: ${total} violation(s) on ${offenders.length} of ${routes.length} route(s). ${detail}`,
    `Full detail with selectors and help URLs is in ${AXE_RESULTS_PATH}. Each violation lists a helpUrl explaining the fix.`);
}

// --------------------------------------------------------------------------

export function a11y({ root, dist, html }) {
  const out = [];

  out.push(axeFinding({ root, dist, html }));

  // Static structural checks that genuinely can run here.
  if (html.length) {
    const noLang = [], noSkip = [], badHeads = [], noAlt = [];
    for (const f of html) {
      const doc = parse(read(f));
      const htmlEl = doc.querySelector('html');
      if (!htmlEl?.getAttribute('lang')) noLang.push(relative(root, f));

      const firstA = doc.querySelector('body a');
      if (!firstA || !/skip/i.test((firstA.getAttribute('class') || '') + firstA.text)) {
        noSkip.push(relative(root, f));
      }

      const heads = doc.querySelectorAll('h1,h2,h3,h4,h5,h6')
        .map((h) => Number(h.rawTagName[1]));
      const h1s = heads.filter((n) => n === 1).length;
      if (h1s !== 1) badHeads.push(`${relative(root, f)}: ${h1s} h1`);
      else for (let i = 1; i < heads.length; i++) {
        if (heads[i] - heads[i - 1] > 1) { badHeads.push(`${relative(root, f)}: h${heads[i - 1]} -> h${heads[i]}`); break; }
      }

      const imgs = doc.querySelectorAll('img').filter((im) => im.getAttribute('alt') === undefined);
      if (imgs.length) noAlt.push(`${relative(root, f)}: ${imgs.length}`);
    }
    out.push(noLang.length ? bad('a11y.lang', `missing lang on ${noLang.length} page(s)`) : ok('a11y.lang', 'html lang set'));
    out.push(noSkip.length ? bad('a11y.skiplink', `no skip link first on ${noSkip.length} page(s)`,
      'A skip navigation link must be the first focusable element.') : ok('a11y.skiplink', 'skip link is first'));
    out.push(badHeads.length ? bad('a11y.heading-order', badHeads.slice(0, 3).join(' | '),
      'Exactly one h1 per page, no skipped levels. Heading level is structure, not size.') : ok('a11y.heading-order', 'heading structure valid'));
    out.push(noAlt.length ? bad('a11y.image-alt', `images without alt: ${noAlt.slice(0, 3).join(', ')}`,
      'Decorative images use alt="". Every img needs the attribute.') : ok('a11y.image-alt', 'all images have alt'));
  }

  out.push(dunno('a11y.manual-checklist',
    'automation covers roughly 30% of issues per ODA guidance; the manual WCAG 2.1 AA checklist is not automatable'));
  return out;
}

// --------------------------------------------------------------------------
// perf: reads what `sws perf` recorded, same contract as axe. Budgets
// first-party uncompressed bytes and request counts, not Lighthouse scores;
// the reasoning is in standards/stack/performance-budget.yml.
// --------------------------------------------------------------------------

export function perf({ root, dist, html }) {
  const p = join(root, PERF_RESULTS_PATH);

  if (!existsSync(p)) {
    return [dunno('perf.budget', !html.length
      ? 'no built HTML found; run the build, then `sws perf`'
      : 'performance budget has not been measured. Run `sws perf` (needs @playwright/test in this project)')];
  }

  let r;
  try { r = JSON.parse(read(p)); }
  catch (err) { return [dunno('perf.budget', `${PERF_RESULTS_PATH} is not valid JSON (${err.message}); re-run \`sws perf\``)]; }

  if (r.schema !== PERF_SCHEMA) {
    return [dunno('perf.budget', `${PERF_RESULTS_PATH} is schema ${r.schema ?? '?'}, this CLI expects ${PERF_SCHEMA}; re-run \`sws perf\``)];
  }
  if (r.status !== 'ok') {
    return [dunno('perf.budget', `measurement did not complete (${r.status}): ${r.detail ?? 'no detail recorded'}`)];
  }
  if (dist && existsSync(dist) && typeof r.distMtime === 'number') {
    const now = newestMtime(dist);
    if (now > r.distMtime + 1000) {
      return [dunno('perf.budget', `budget results predate the current build (build is ${Math.round((now - r.distMtime) / 1000)}s newer); re-run \`sws perf\``)];
    }
  }
  const routes = Array.isArray(r.routes) ? r.routes : [];
  if (!routes.length) return [dunno('perf.budget', 'budget results record no routes; re-run `sws perf`')];
  if (html.length && routes.length < html.length) {
    return [dunno('perf.budget', `budget covered ${routes.length} of ${html.length} built page(s); re-run \`sws perf\``)];
  }

  const worst = r.totals.worst_total_kb;
  const limit = r.budget.limits.total_kb;
  const overridden = Object.keys(r.budget.overrides ?? {});
  const suffix = overridden.length ? `. Project override on ${overridden.join(', ')}` : '';

  if (!r.breaches.length) {
    return [ok('perf.budget',
      `worst route ${worst} KB of ${limit} KB budget, first-party uncompressed, across ${routes.length} route(s)${suffix}`)];
  }

  // Per item. "Over budget" is not actionable; "js is 210 KB against 150" is.
  const detail = r.breaches.slice(0, 4)
    .map((b) => `${b.route} ${b.key.replace(/_kb$/, '')} ${b.actual}${b.key.endsWith('_kb') ? ' KB' : ''} > ${b.limit}`)
    .join(' | ');

  return [bad('perf.budget', `${r.breaches.length} budget breach(es). ${detail}`,
    `Full measurement in ${PERF_RESULTS_PATH}. The usual wins on a Stanford site are fewer and correctly sized images, fewer islands, and no client-side framework for static content. If the budget is genuinely wrong for this site, override it in .sws/manifest.yml under performance_budget with a reason.`)];
}

// --------------------------------------------------------------------------
// secrets: the only blocking check
// --------------------------------------------------------------------------

const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/sk_live_[A-Za-z0-9]{20,}/, 'Stripe live secret key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./, 'JWT'],
  [/(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9!@#$%^&*_\-]{16,}['"]/i, 'hardcoded credential'],
];

export function secrets({ root }) {
  let files;
  try {
    files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch {
    return [dunno('minweb.no-secrets', 'not a git repository, or git unavailable; cannot enumerate tracked files')];
  }

  const SKIP = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|zip|mp4|webm)$/i;
  const hits = [];
  for (const f of files) {
    if (SKIP.test(f) || f.includes('node_modules')) continue;
    const p = join(root, f);
    if (!existsSync(p) || statSync(p).size > 512 * 1024) continue;
    const body = read(p);
    for (const [re, label] of SECRET_PATTERNS) {
      const m = body.match(re);
      if (m) {
        const line = body.slice(0, m.index).split('\n').length;
        hits.push(`${f}:${line} looks like a ${label}`);
        break;
      }
    }
  }

  if (!hits.length) return [ok('minweb.no-secrets', `${files.length} tracked files scanned, nothing found`)];

  return [{
    id: 'minweb.no-secrets',
    state: 'fail',
    blocking: true,
    detail: hits.slice(0, 5).join('; '),
    fix: [
      'ROTATE THE CREDENTIAL NOW. It is already in git history and blocking a deploy does not un-leak it.',
      'Then remove it from history (git filter-repo or BFG), then force-push.',
      'Then move the value into Vault or your host\'s environment settings.',
    ].join(' '),
  }];
}

// --------------------------------------------------------------------------
// hygiene, build, workflow, manifest, ownership
// --------------------------------------------------------------------------

export function hygiene({ root, html, manifest }) {
  const out = [];
  if (!html.length) {
    out.push(dunno('minweb.https-only', 'no built HTML found'));
  } else {
    const bads = [];
    for (const f of html) {
      const m = read(f).match(/http:\/\/(?!localhost|127\.0\.0\.1)[a-z0-9.-]*stanford\.edu/gi);
      if (m) bads.push(`${relative(root, f)}: ${[...new Set(m)].slice(0, 2).join(', ')}`);
    }
    out.push(bads.length
      ? bad('minweb.https-only', bads.slice(0, 3).join(' | '), 'Use https:// for Stanford URLs.')
      : ok('minweb.https-only', 'no insecure Stanford URLs'));
  }

  const major = Number(process.versions.node.split('.')[0]);
  out.push(major >= 22
    ? ok('build.node-major', `node ${process.versions.node}`)
    : bad('build.node-major', `node ${process.versions.node}; 22.12+ needed, 24 LTS preferred`));

  const fa = Object.keys(deps(root)).filter((d) => /^@fortawesome\/pro-/.test(d));
  out.push(fa.length
    ? bad('security.no-fontawesome-pro', `${fa.join(', ')}`,
        'Licence-gated with a preinstall token check. A unit site inheriting this gets an install failure and a licence nobody mentioned. Use Heroicons.')
    : ok('security.no-fontawesome-pro', 'no FontAwesome Pro packages'));

  // Consent UI, and the framing matters more than the detection.
  //
  // A cookie banner is NOT forbidden at Stanford. It is simply not required:
  // the Global Footer's Privacy link satisfies the disclosure obligation, so a
  // banner is a deliberate addition rather than a default. Any unit is free to
  // add one.
  //
  // So this reports an UNDECLARED one, exactly like the third-party tooling
  // check below it, and passes once the project records the choice in
  // .sws/manifest.yml under `privacy.consent_tooling`. An earlier version
  // reported the mere presence of consent UI as a failure, which asserted a
  // prohibition Stanford does not have -- and this project has no business
  // inventing policy.
  //
  // This was two substrings anywhere in the document -- /cookie/ AND
  // /(accept|consent)/ -- and it produced a false failure on this project's own
  // site, which is the worst possible place for it to fire. "cookie" came from
  // the MANDATED Global Footer link (`title="Privacy and cookie policy"`, part
  // of the byte-exact contract every compliant Stanford site must carry), and
  // "accept" came from prose about accepted risks. So the check fired on the one
  // element the project requires, on a page with no banner anywhere.
  //
  // A check that fails a correct site gets the whole tool switched off. Now it
  // looks for the two things a real banner actually has: a container named like
  // one, or a control whose OWN text asks you to accept cookies.
  //
  // An earlier version of this fix ALSO skipped the whole <footer>, on the
  // theory that its content is mandated. That was unnecessary -- the mandated
  // link's text is "Privacy", which matches neither pattern -- and it opened a
  // real evasion gap: a banner placed inside the footer went undetected. Scan
  // everything.
  const CONSENT_CONTAINER = /(?:id|class)="[^"]*(?:cookie[-_ ]?(?:consent|banner|notice|bar|law)|consent[-_ ]?(?:banner|bar|manager|modal)|gdpr[-_ ]?(?:banner|notice))[^"]*"/i;
  const CONSENT_CONTROL = /\b(?:accept|allow|agree\s+to|opt\s+in\s+to)\b[^<>]{0,30}\bcookies?\b|\bcookies?\b[^<>]{0,30}\b(?:accept(?:ed)?|allow(?:ed)?)\b/i;

  const bannerHits = [];
  for (const f of html) {
    const doc = parse(read(f));
    const markup = read(f);
    if (CONSENT_CONTAINER.test(markup)) { bannerHits.push(`${relative(root, f)}: element named like a consent banner`); continue; }
    for (const el of doc.querySelectorAll('button, a, [role="button"]')) {
      const label = (el.text || '').replace(/\s+/g, ' ').trim();
      if (label && CONSENT_CONTROL.test(label)) {
        bannerHits.push(`${relative(root, f)}: control labelled "${label.slice(0, 40)}"`);
        break;
      }
    }
  }
  const declared = String(manifest?.privacy?.consent_tooling ?? '').trim();
  if (!bannerHits.length) {
    out.push(ok('privacy.consent-ui-declared', 'no consent UI in the built output'));
  } else if (declared) {
    out.push(ok('privacy.consent-ui-declared',
      `consent UI present and declared in .sws/manifest.yml: ${declared.split('\n')[0].slice(0, 80)}`));
  } else {
    out.push(bad('privacy.consent-ui-declared',
      `consent UI present but not declared: ${bannerHits.slice(0, 3).join('; ')}`,
      'This is allowed — no cookie banner is required at Stanford, but none is forbidden either. Record it in .sws/manifest.yml under privacy.consent_tooling with the reason, consult the University Privacy Office, and remember the banner is now yours to keep accessible.'));
  }

  return out;
}

export function build({ root, dist }) {
  const out = [];
  out.push(existsSync(dist)
    ? ok('build.succeeds', `build output present at ${relative(root, dist) || dist}`)
    : dunno('build.succeeds', `no build output at ${dist}; run the build first`));

  const cfg = ['astro.config.mjs', 'astro.config.js', 'astro.config.ts']
    .map((f) => join(root, f)).find(existsSync);
  if (!cfg) {
    out.push(na('build.static-output', 'no Astro config; not an Astro project'));
    out.push(na('build.base-path', 'no Astro config'));
    return out;
  }
  const c = read(cfg);
  out.push(/output:\s*['"]static['"]/.test(c) || !/output:/.test(c)
    ? ok('build.static-output', "output is 'static' (or default)")
    : bad('build.static-output', 'output is not static', "GitHub Pages needs output: 'static'. 'hybrid' no longer exists."));

  out.push(/\bsite:\s*['"]https?:\/\//.test(c)
    ? ok('build.site-set', '`site` is set')
    : bad('build.site-set', '`site` is not set in the Astro config',
        'Without it the sitemap emits nothing and canonical URLs are wrong. Most common configuration miss.'));

  out.push(/\bbase:\s*['"]/.test(c)
    ? ok('build.base-path', '`base` is set for a subpath deploy')
    : na('build.base-path', 'no `base` set; correct unless deploying to a subpath'));
  return out;
}

export function workflow({ root }) {
  // .github/workflows is a REPOSITORY-level concern, so walk up to find it. A
  // site can legitimately live in a subdirectory (this project's own docs site
  // does) with CI defined at the repo root. Looking only in the project
  // directory reported a false failure on a correctly configured repo.
  let dir = null;
  let d = root;
  for (let i = 0; i < 6; i++) {
    const c = join(d, '.github', 'workflows');
    if (existsSync(c)) { dir = c; break; }
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  if (!dir) {
    return [
      bad('workflow.push-to-main-deploys', 'no .github/workflows directory',
        'Push to main should deploy. Pull requests are first-class but never required.'),
      dunno('workflow.report-reaches-a-reader', 'no workflows to inspect'),
    ];
  }
  const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => join(dir, f));
  const all = files.map(read).join('\n---\n');
  const out = [];

  out.push(/on:[\s\S]{0,200}push:[\s\S]{0,120}branches:\s*\[?\s*['"]?main/.test(all)
    ? ok('workflow.push-to-main-deploys', 'triggers on push to main')
    : bad('workflow.push-to-main-deploys', 'no push-to-main trigger found',
        'Many campus editors work through the GitHub web UI, which is push-to-main by construction.'));

  const perms = [];
  if (!/issues:\s*write/.test(all)) perms.push('issues: write');
  if (!/pull-requests:\s*write/.test(all)) perms.push('pull-requests: write');
  out.push(perms.length
    ? bad('workflow.report-reaches-a-reader', `missing permissions: ${perms.join(', ')}`,
        'Without these the advisory report is produced and nobody sees it, which is worse than not running it.')
    : ok('workflow.report-reaches-a-reader', 'report permissions present'));

  return out;
}

// Consent tooling, by package name and by the script hosts these products load
// from. Stanford requires NO cookie banner: the Global Footer's Privacy link
// carries the disclosure, and guidance actively tells units not to build one.
// So finding one of these is not a failure in itself, it is an undeclared
// deliberate choice, which is the thing this project cares about.
const CONSENT_TOOLING = [
  'onetrust', 'cookiebot', 'cookieyes', 'osano', 'termly', 'iubenda',
  'klaro', 'tarteaucitron', 'cookieconsent', 'usercentrics', 'trustarc',
  'quantcast', 'civic-cookie-control', 'cookiehub', 'cookiefirst',
];

export function manifest({ root, html }) {
  const p = join(root, '.sws', 'manifest.yml');
  if (!existsSync(p)) {
    return [
      bad('manifest.present', 'no .sws/manifest.yml',
        'Records standards version, resolved versions, tier, owners, prior art, and divergences.'),
      dunno('minweb.siteimprove', 'no manifest to read'),
      dunno('minweb.ownership', 'no manifest to read'),
      dunno('manifest.divergences-explained', 'no manifest to read'),
      dunno('privacy.consent-tooling-declared', 'no manifest to read'),
    ];
  }
  const m = readYaml(p) || {};
  const out = [ok('manifest.present', `.sws/manifest.yml, standards v${m.standards_version ?? '?'}`)];

  out.push(m.siteimprove
    ? ok('minweb.siteimprove', 'Siteimprove registration recorded')
    : bad('minweb.siteimprove', 'Siteimprove registration not recorded',
        'Required for public-facing Stanford sites. Google Analytics is not required.'));

  const b = m.owners?.business, t = m.owners?.technical;
  const isStanford = (s) => typeof s === 'string' && /@stanford\.edu/.test(s);
  out.push(isStanford(b?.email) && isStanford(t?.email)
    ? ok('minweb.ownership', `business: ${b.email}, technical: ${t.email}`)
    : bad('minweb.ownership', 'business owner and/or technical administrator missing a stanford.edu email',
        'MinWeb requires both be identifiable with valid Stanford affiliation.'));

  // Divergence is supported and expected. Only SILENT divergence is a problem,
  // so what gets checked is the presence of a reason, never the choice itself.
  const divs = Array.isArray(m.divergences) ? m.divergences : [];
  const named = (d) => d?.changed || d?.from || '(unnamed)';
  if (!divs.length) {
    out.push(na('manifest.divergences-explained', 'no divergences recorded'));
  } else {
    const silent = divs.filter((d) => !String(d?.reason ?? '').trim());
    out.push(silent.length
      ? bad('manifest.divergences-explained',
          `${silent.length} of ${divs.length} divergence(s) record no reason: ${silent.map(named).join('; ')}`,
          'Add a one-line `reason:` and the `cost_accepted:`. Deviating is supported; not saying why is not.')
      : ok('manifest.divergences-explained', `${divs.length} divergence(s), each with a reason`));
  }

  // Consent tooling: declared, or flagged. Not banned, because a unit may have
  // a real reason, but it is never the default and it needs the Privacy Office.
  const found = new Set();
  for (const name of Object.keys(deps(root))) {
    const hit = CONSENT_TOOLING.find((c) => name.toLowerCase().includes(c));
    if (hit) found.add(hit);
  }
  for (const f of html) {
    const markup = read(f).toLowerCase();
    for (const c of CONSENT_TOOLING) if (markup.includes(c)) found.add(c);
  }
  const declared = m.privacy?.consent_tooling;
  if (!found.size) {
    out.push(ok('privacy.consent-tooling-declared', 'no consent tooling present, which is the Stanford default'));
  } else if (String(declared ?? '').trim()) {
    out.push(ok('privacy.consent-tooling-declared',
      `${[...found].join(', ')} present and declared in .sws/manifest.yml`));
  } else {
    out.push(bad('privacy.consent-tooling-declared',
      `${[...found].join(', ')} present but not declared in .sws/manifest.yml`,
      'No cookie banner is required at Stanford; the Global Footer Privacy link carries the disclosure. If you are keeping this, record it under privacy.consent_tooling with the reason, and consult the University Privacy Office.'));
  }

  return out;
}

// --------------------------------------------------------------------------
// security: response headers. Only meaningful on a server-rendered target, so
// everything here is not_applicable on a static build rather than failing.
// --------------------------------------------------------------------------

function nextConfig(root) {
  const f = ['next.config.ts', 'next.config.mjs', 'next.config.js']
    .map((n) => join(root, n)).find(existsSync);
  return f ? { path: f, body: read(f) } : null;
}

export function security({ root }) {
  const cfg = nextConfig(root);
  if (!cfg) {
    return [
      na('security.csp-present', 'no Next config; response headers are not applicable to a static build'),
      na('security.headers-set', 'no Next config'),
      na('security.editor-csp-separate', 'no Next config'),
    ];
  }
  const out = [];
  const b = cfg.body;

  // A dynamically built CSP is normal (the homesite composes it from an array),
  // so look for the header name rather than trying to parse a policy.
  const hasHeaders = /async\s+headers\s*\(/.test(b) || /headers\s*:\s*async/.test(b);
  if (!hasHeaders) {
    out.push(bad('security.csp-present', 'no headers() function in the Next config',
      "This recipe's main capability over astro-static is response headers. Add headers() returning a Content-Security-Policy."));
    out.push(bad('security.headers-set', 'no headers() function in the Next config'));
  } else {
    out.push(/Content-Security-Policy/i.test(b)
      ? ok('security.csp-present', 'CSP configured in headers()')
      : bad('security.csp-present', 'headers() exists but sets no Content-Security-Policy'));

    const want = [
      ['Strict-Transport-Security', 'HSTS'],
      ['X-Content-Type-Options', 'nosniff'],
      ['Referrer-Policy', 'referrer policy'],
      ['Permissions-Policy', 'permissions policy'],
    ];
    const missing = want.filter(([h]) => !new RegExp(h, 'i').test(b)).map(([, l]) => l);
    out.push(missing.length
      ? bad('security.headers-set', `missing: ${missing.join(', ')}`,
          'Report per header. All four are cheap and all four are expected on a Stanford site.')
      : ok('security.headers-set', 'HSTS, nosniff, referrer policy, and permissions policy all set'));

    if (/strict-dynamic/.test(b)) {
      out.push(ok('security.csp-strict-dynamic', "CSP uses 'strict-dynamic'"));
    } else if (/Content-Security-Policy/i.test(b)) {
      out.push(bad('security.csp-strict-dynamic',
        "CSP does not use 'strict-dynamic'",
        'A host allowlist drifts and eventually allows everything. Prefer strict-dynamic with nonces, injected at the edge.'));
    }
  }

  // Storyblok Visual Editor needs its own policy: the app must not be iframable,
  // the editor must be.
  const usesStoryblok = Object.keys(deps(root)).some((d) => d.startsWith('@storyblok/'));
  if (!usesStoryblok) {
    out.push(na('security.editor-csp-separate', 'Storyblok not in use'));
  } else {
    // A CSP composed at runtime (the homesite builds it from an array via a
    // helper) cannot be read reliably by regex: `frame-ancestors` and the
    // allowed origin end up in different expressions. Reporting `fail` there
    // would be a false alarm on a CORRECT config, so report `unknown` and say
    // why. Guessing in either direction is worse than admitting the limit.
    const dynamic = /frame-ancestors\s*\$\{/.test(b) || /=>\s*\[/.test(b);
    const allowsStoryblok = /storyblok\.com/i.test(b);
    const noindexed = /X-Robots-Tag/i.test(b) && /noindex/i.test(b);

    if (dynamic && allowsStoryblok && noindexed) {
      out.push(dunno('security.editor-csp-separate',
        'CSP is composed at runtime, so this cannot be verified statically. ' +
        'storyblok.com and a noindex header are both present, which is consistent with a correct setup. ' +
        'Confirm against the served headers on a deploy preview.'));
    } else if (dynamic) {
      out.push(dunno('security.editor-csp-separate',
        'CSP is composed at runtime and this check cannot follow it. ' +
        [!allowsStoryblok && 'no storyblok.com origin found anywhere in the config',
         !noindexed && 'no noindex X-Robots-Tag found'].filter(Boolean).join('; ') +
        '. Verify against the served headers.'));
    } else {
      const editorPolicy = /frame-ancestors[^;'"`]*storyblok\.com/i.test(b);
      out.push(editorPolicy && noindexed
        ? ok('security.editor-csp-separate', 'editor route has its own CSP and is noindexed')
        : bad('security.editor-csp-separate',
            [!editorPolicy && 'no frame-ancestors allowing storyblok.com',
             !noindexed && 'editor route not noindexed'].filter(Boolean).join('; '),
            "One policy cannot serve both: the app needs frame-ancestors 'none', the editor must be iframable by the CMS."));
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// next: framework-specific wiring
// --------------------------------------------------------------------------

export function next({ root, html }) {
  const cfg = nextConfig(root);
  const isNext = !!cfg || !!deps(root).next;
  if (!isNext) {
    return ['next.postcss-configured', 'next.no-vite-tailwind', 'next.no-tailwind-config', 'next.metadata-base']
      .map((id) => na(id, 'not a Next project'));
  }
  const out = [];

  const post = ['postcss.config.mjs', 'postcss.config.js', 'postcss.config.json']
    .map((n) => join(root, n)).find(existsSync);
  out.push(post && /@tailwindcss\/postcss/.test(read(post))
    ? ok('next.postcss-configured', `${relative(root, post)} registers @tailwindcss/postcss`)
    : bad('next.postcss-configured', post ? 'postcss config does not register @tailwindcss/postcss' : 'no postcss config',
        'Next compiles Tailwind through PostCSS. Without this, Decanter is imported and never compiled.'));

  out.push(deps(root)['@tailwindcss/vite']
    ? bad('next.no-vite-tailwind', '@tailwindcss/vite is a dependency',
        'That is the Astro integration. Next uses @tailwindcss/postcss. Signals a copied Astro config.')
    : ok('next.no-vite-tailwind', '@tailwindcss/vite absent, correct for Next'));

  const twCfg = ['tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.ts']
    .filter((f) => existsSync(join(root, f)));
  out.push(twCfg.length
    ? bad('next.no-tailwind-config', `found ${twCfg.join(', ')}`,
        'Scaffold with --no-tailwind. Decanter 8 has no JS config.')
    : ok('next.no-tailwind-config', 'no tailwind JS config'));

  // metadataBase is the Next equivalent of Astro's `site`, and the same miss.
  const layouts = [];
  (function walk(d) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p); }
      else if (/^layout\.(t|j)sx?$/.test(n)) layouts.push(p);
    }
  })(join(root, 'app'));

  if (!layouts.length) {
    out.push(dunno('next.metadata-base', 'no app/layout file found; App Router expected'));
  } else {
    const hit = layouts.find((f) => /metadataBase/.test(read(f)));
    out.push(hit
      ? ok('next.metadata-base', `metadataBase set in ${relative(root, hit)}`)
      : bad('next.metadata-base', 'metadataBase not set in any app layout',
          'Without it canonical and Open Graph URLs do not resolve absolutely. The Next equivalent of Astro\'s `site`.'));
  }
  return out;
}

export const ALL = { footer, identity, decanter, seo, a11y, perf, secrets, hygiene, build, workflow, manifest, security, next };
