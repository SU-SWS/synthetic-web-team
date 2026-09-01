// The tools. Each one exists because an agent gets it wrong or gets it slowly
// by reading files, not merely because it could be exposed.
//
// Every handler returns text content and never throws: an MCP tool that throws
// gives the calling model a stack trace, which it then tries to reason about. A
// structured "here is what went wrong and what to do" is always more useful.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import YAML from 'yaml';

const ok = (text) => ({ content: [{ type: 'text', text }] });
const problem = (text) => ({ content: [{ type: 'text', text }], isError: true });

// --------------------------------------------------------------------------
// sws_get_standard
// --------------------------------------------------------------------------

/** Every L0 document, as { key, path, title }. Built once at startup. */
export function indexStandards(standardsDir) {
  if (!standardsDir || !existsSync(standardsDir)) return [];
  const out = [];
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!['.md', '.yml', '.yaml'].includes(extname(name))) continue;
      const rel = relative(standardsDir, p).split(/[\\/]/).join('/');
      out.push({
        // "policy/minweb.md" -> "minweb"; "recipes/astro-static/RECIPE.md"
        // -> "astro-static". The key is what an agent would actually type.
        key: rel.replace(/\.(md|ya?ml)$/, '').split('/').filter((s) => !/^(RECIPE|README|INDEX)$/i.test(s)).pop(),
        area: rel.split('/')[0],
        path: rel,
        abs: p,
      });
    }
  })(standardsDir);
  return out;
}

// Words an agent is likely to use that are not the filename. Kept small and
// explicit: a fuzzy matcher that guesses wrong is worse than one that says
// "did you mean" and lists the options.
const ALIASES = {
  footer: 'global-footer', 'global footer': 'global-footer',
  'identity bar': 'brand', logo: 'brand', colour: 'brand', color: 'brand',
  typography: 'brand', font: 'brand', fonts: 'brand',
  a11y: 'accessibility', wcag: 'accessibility', axe: 'accessibility',
  siteimprove: 'accessibility', oda: 'accessibility',
  security: 'minsec', tier: 'minsec', patching: 'minsec',
  minweb: 'minweb', secrets: 'minweb', https: 'minweb', owner: 'minweb',
  privacy: 'privacy', minpriv: 'privacy', cookies: 'privacy', cookie: 'privacy',
  dra: 'privacy', consent: 'privacy',
  auth: 'identity', sso: 'identity', saml: 'identity', oidc: 'identity',
  login: 'identity', weblogin: 'identity',
  vpat: 'procurement', acr: 'procurement',
  tailwind: 'decanter', css: 'decanter', tokens: 'decanter',
  seo: 'discoverability', geo: 'discoverability', llms: 'discoverability',
  forms: 'forms', form: 'forms',
  ia: 'ia', sitemap: 'ia', urls: 'ia', navigation: 'ia', redirects: 'ia',
  content: 'content', voice: 'content', 'alt text': 'content',
  components: 'components', storybook: 'components',
  escalation: 'escalation', office: 'escalation', 'who do i ask': 'escalation',
};

export function getStandard(index, topic) {
  if (!index.length) return problem('No standards directory is available to this server.');
  const q = String(topic ?? '').trim().toLowerCase();
  if (!q) {
    return ok(`Topics available:\n${index.map((e) => `  ${e.key}  (${e.path})`).join('\n')}`);
  }

  const wanted = ALIASES[q] ?? q;
  const exact = index.find((e) => e.key.toLowerCase() === wanted)
    ?? index.find((e) => e.path.toLowerCase() === wanted);
  const hit = exact ?? index.find((e) => e.key.toLowerCase().includes(wanted))
    ?? index.find((e) => e.path.toLowerCase().includes(wanted));

  if (!hit) {
    const near = index.filter((e) => e.key.toLowerCase().includes(wanted.slice(0, 4))).slice(0, 6);
    return problem(`No standard matches "${topic}".` +
      (near.length ? `\n\nDid you mean:\n${near.map((e) => `  ${e.key}`).join('\n')}` : '') +
      `\n\nCall with no topic to list everything.`);
  }
  return ok(`# ${hit.path}\n\n${readFileSync(hit.abs, 'utf8')}`);
}

// --------------------------------------------------------------------------
// sws_footer_html
//
// The tool the plan says justifies the server on its own. The Global Footer is
// immutable, frequently gotten wrong, and mechanically generable -- and this
// project typed two of its ten URLs wrong from memory in its own first draft.
// Generating from the contract means that cannot happen again.
// --------------------------------------------------------------------------

export function footerHtml(standardsDir, { unit } = {}) {
  const p = standardsDir && join(standardsDir, 'fragments', 'global-footer.yml');
  if (!p || !existsSync(p)) return problem(`Footer contract not found at ${p ?? 'standards/fragments/global-footer.yml'}.`);

  let c;
  try { c = YAML.parse(readFileSync(p, 'utf8')); }
  catch (err) { return problem(`Footer contract is not valid YAML: ${err.message}`); }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const li = (l) => `      <li><a href="${esc(l.href)}"${l.title ? ` title="${esc(l.title)}"` : ''}>${esc(l.label)}</a></li>`;

  const html = `<footer>
  <nav aria-label="${esc(c.structure?.nav?.aria_label ?? 'global footer menu')}">
    <ul>
${c.resource_links.map(li).join('\n')}
    </ul>
    <ul>
${c.policy_links.map(li).join('\n')}
    </ul>
  </nav>
${(c.copyright?.lines ?? []).map((l) => `  <span>${esc(l)}</span>`).join('\n')}
</footer>`;

  const notes = [
    `Generated from standards/fragments/global-footer.yml (extracted ${c.extracted ?? 'unknown date'}).`,
    '',
    'RULES THAT APPLY TO THIS MARKUP:',
    '- Immutable. Do not alter, reorder, or add links, and put nothing else inside it.',
    '- The links are TWO lists inside ONE nav, not one list of ten. A check written',
    '  against a flat list produces false failures on correct markup.',
    '- Unit links belong in a LOCAL footer ABOVE this one. Putting them inside is the',
    '  single most common Stanford brand violation.',
    '- Decanter 8 supplies the styling. Add classes from it; do not hand-write brand CSS.',
  ];
  if (unit) {
    notes.push('', `You passed unit "${unit}". The Global Footer takes no unit content —`,
      `put "${unit}" links in a local footer above it.`);
  }
  return ok(`${html}\n\n<!--\n${notes.join('\n')}\n-->`);
}

// --------------------------------------------------------------------------
// sws_check
//
// Shells out to the sws CLI rather than reimplementing the checks.
// Deliberate: running the same binary a human runs means the MCP result and the
// terminal result can never disagree, which is the drift this project is
// organised against. The cost is one process spawn, which is nothing next to
// two implementations of a compliance score.
// --------------------------------------------------------------------------

function cliPath() {
  try {
    const req = createRequire(import.meta.url);
    return req.resolve('@su-sws/sws-cli/bin/sws.mjs');
  } catch {
    // Workspace layout, when exports are not resolvable from here.
    const guess = new URL('../../cli/bin/sws.mjs', import.meta.url).pathname;
    return existsSync(guess) ? guess : null;
  }
}

export function check(defaultRoot, { path, standards } = {}) {
  const bin = cliPath();
  if (!bin) return problem('Could not locate the sws CLI. Install @su-sws/sws-cli.');
  const cwd = path ? path : defaultRoot;
  if (!existsSync(cwd)) return problem(`Path does not exist: ${cwd}`);

  const args = ['doctor', '--format', 'json', '--no-publish', '--no-summary'];
  if (standards) args.push('--standards', standards);

  let out;
  try {
    // `doctor`, not `check`: doctor always exits 0, so a compliance finding can
    // never look like a tool failure to the model.
    out = execFileSync('node', [bin, ...args], {
      cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1' },
    });
  } catch (err) {
    return problem(`sws could not run in ${cwd}: ${(err.stderr || err.message || '').toString().slice(0, 600)}`);
  }

  let r;
  try { r = JSON.parse(out); }
  catch { return problem(`sws returned output that is not JSON:\n${out.slice(0, 600)}`); }

  const by = (s) => r.findings.filter((f) => f.state === s);
  const line = (f) => `- ${f.id}${f.weight ? ` (${f.weight}pt)` : ''}: ${f.detail}${f.fix ? `\n    fix: ${f.fix}` : ''}`;

  const parts = [
    `# Compliance report: ${r.score.value}/100`,
    ``,
    `Recipe \`${r.recipe}\` in ${cwd}`,
    `${r.counts.pass} passing, ${r.counts.fail} to fix, ${r.counts.unknown} unchecked` +
      (r.counts.acknowledged ? `, ${r.counts.acknowledged} accepted` : ''),
    ``,
  ];
  if (by('fail').length) parts.push(`## To fix\n${by('fail').map(line).join('\n')}\n`);
  if (by('unknown').length) parts.push(`## Could not check\n${by('unknown').map(line).join('\n')}\n`);
  if (by('acknowledged').length) parts.push(`## Accepted risks\n${by('acknowledged').map(line).join('\n')}\n`);

  parts.push(
    `## How to read this`,
    `Everything is advisory except \`minweb.no-secrets\`, which is the only finding`,
    `that fails a build. "Could not check" is never a pass: those points are`,
    `withheld. Run \`sws a11y\` and \`sws perf\` after a build to convert the axe and`,
    `performance criteria from unchecked into real results.`,
    ``,
    `Automated checks cover roughly 30% of accessibility issues per ODA guidance.`,
    `A passing report is a floor, not a conformance claim. Never tell a user their`,
    `site is accessible on the strength of this.`,
    ``,
    `<details><summary>Raw JSON</summary>\n\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`\n</details>`,
  );
  return ok(parts.join('\n'));
}

// --------------------------------------------------------------------------
// sws_decanter_token
//
// Reads the INSTALLED package's own CSS, so it is version-accurate by
// construction rather than by staying in sync with a separate service. This is
// why the project does not depend on decanter-mcp for v8 work.
// --------------------------------------------------------------------------

export function decanterToken(defaultRoot, { query, path } = {}) {
  const root = path || defaultRoot;
  const dir = join(root, 'node_modules', 'decanter', 'src', 'css');
  if (!existsSync(dir)) {
    return problem(
      `Decanter is not installed under ${root}.\n\n` +
      `Install it first: npm i decanter@beta  (checked 2026-09-01: dist-tag \`latest\` is 7.5.3, ` +
      `so a bare \`npm i decanter\` gets v7, which is a Tailwind 3 JS preset and architecturally ` +
      `different from v8. See standards/patterns/decanter.md.)`);
  }

  let version = 'unknown';
  try {
    version = JSON.parse(readFileSync(join(root, 'node_modules', 'decanter', 'package.json'), 'utf8')).version;
  } catch { /* keep going: the CSS is what matters */ }

  // Custom properties, with the file they came from so an agent can cite it.
  const tokens = [];
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (extname(name) !== '.css') continue;
      const rel = relative(dir, p).split(/[\\/]/).join('/');
      for (const m of readFileSync(p, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
        tokens.push({ name: m[1], value: m[2].trim().replace(/\s+/g, ' '), file: rel });
      }
    }
  })(dir);

  if (!tokens.length) return problem(`No custom properties found under ${dir}.`);

  const q = String(query ?? '').trim().toLowerCase();
  const hits = q
    ? tokens.filter((t) => t.name.toLowerCase().includes(q) || t.value.toLowerCase().includes(q))
    : tokens;

  if (!hits.length) {
    const areas = [...new Set(tokens.map((t) => t.file))].sort();
    return problem(`No Decanter token matches "${query}" in ${version}.\n\nFiles searched:\n` +
      areas.map((a) => `  ${a}`).join('\n'));
  }

  const shown = hits.slice(0, 60);
  return ok([
    `# Decanter ${version} tokens matching "${query || '(all)'}"`,
    `${hits.length} match${hits.length === 1 ? '' : 'es'}${hits.length > shown.length ? `, showing ${shown.length}` : ''}`,
    ``,
    ...shown.map((t) => `- \`${t.name}\`: \`${t.value}\`  — ${t.file}`),
    ``,
    `Use the token, never the literal value. \`var(${shown[0].name})\` or the Tailwind`,
    `utility Decanter generates from it.`,
    ``,
    `A token name does not tell you whether a colour pairing passes contrast.`,
    `Decanter's palette contains both passing and failing combinations, so check`,
    `pairings at design time.`,
  ].join('\n'));
}
