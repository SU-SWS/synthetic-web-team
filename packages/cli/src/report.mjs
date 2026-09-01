// Scoring and rendering.
//
// Scoring rules, which encode decisions rather than arithmetic:
//
//   pass          earns its weight
//   fail          earns nothing
//   unknown       COUNTS toward the total and earns nothing. A check that could
//                 not run must not flatter the score. If axe never ran, its 10
//                 points are withheld rather than excluded.
//   acknowledged  earns its weight, and the score is annotated. Earning zero
//                 would mean the score never recovers, and people would stop
//                 documenting risk acceptance, which is the behaviour we most
//                 want.
//   not_applicable  excluded from the total entirely.

// Grouping is by what the reader can DO, not by policy chapter. Note every
// test requires a non-passing state: a blocking check that PASSES is not a
// blocking finding, and an earlier version of this listed `minweb.no-secrets`
// under "Blocking launch" while it was green.
const GROUPS = [
  ['Blocking launch', (f) => f.state === 'fail' && (f.blocking || f.weight >= 4)],
  ['Should fix',      (f) => f.state === 'fail' && f.weight >= 2],
  ['Consider',        (f) => f.state === 'fail'],
  ['Could not check', (f) => f.state === 'unknown'],
  ['Accepted risks',  (f) => f.state === 'acknowledged'],
];

export function score(findings) {
  let earned = 0, possible = 0, ack = 0;
  for (const f of findings) {
    if (f.state === 'not_applicable' || !f.weight) continue;
    possible += f.weight;
    if (f.state === 'pass') earned += f.weight;
    else if (f.state === 'acknowledged') { earned += f.weight; ack++; }
  }
  return {
    value: possible ? Math.round((earned / possible) * 100) : 100,
    earned, possible, acknowledged: ack,
  };
}

export function group(findings) {
  const seen = new Set();
  const out = [];
  for (const [name, test] of GROUPS) {
    const items = findings.filter((f) => !seen.has(f.id) && test(f));
    items.forEach((f) => seen.add(f.id));
    if (items.length) out.push([name, items]);
  }
  return out;
}

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', blue: '\x1b[36m',
};
const paint = (s, c) => (process.stdout.isTTY ? `${C[c]}${s}${C.reset}` : s);

const ICON = { pass: '+', fail: '!', unknown: '?', acknowledged: '~', not_applicable: '.' };

export function renderTerminal({ findings, sc, recipe, blocking }) {
  const L = [];
  L.push('');
  L.push(paint(`  Stanford compliance report`, 'bold') + paint(`  ${recipe}`, 'dim'));
  L.push('');

  const bar = '#'.repeat(Math.round(sc.value / 5)).padEnd(20, '.');
  const colour = sc.value >= 90 ? 'green' : sc.value >= 70 ? 'yellow' : 'red';
  L.push(`  ${paint(bar, colour)}  ${paint(String(sc.value), 'bold')}/100` +
    (sc.acknowledged ? paint(`  (includes ${sc.acknowledged} accepted risk${sc.acknowledged > 1 ? 's' : ''})`, 'dim') : ''));
  L.push('');

  for (const [name, items] of group(findings)) {
    const c = name === 'Blocking launch' ? 'red'
      : name === 'Should fix' ? 'yellow'
      : name === 'Could not check' ? 'blue' : 'dim';
    L.push(`  ${paint(name, c)}`);
    for (const f of items) {
      L.push(`    ${ICON[f.state]} ${paint(f.id, 'bold')}  ${f.detail}`);
      if (f.fix) L.push(`      ${paint('->', 'dim')} ${f.fix}`);
    }
    L.push('');
  }

  const passed = findings.filter((f) => f.state === 'pass').length;
  L.push(paint(`  ${passed} passing, ${findings.filter((f) => f.state === 'fail').length} to fix, ` +
    `${findings.filter((f) => f.state === 'unknown').length} unchecked`, 'dim'));

  // "Blocking launch" means fix before go-live. It does NOT mean the build
  // fails, and saying so prevents people concluding the check is broken when
  // CI stays green. Only committed credentials fail a build.
  if (findings.some((f) => f.state === 'fail')) {
    L.push(paint('  "Blocking launch" means fix before go-live, not that CI failed.', 'dim'));
    L.push(paint('  Only a committed credential fails a build.', 'dim'));
  }

  // The honesty line. Never let a green report imply conformance.
  L.push(paint('  Automated checks cover roughly 30% of accessibility issues (ODA).', 'dim'));
  L.push(paint('  A passing run is a floor, not a conformance claim.', 'dim'));

  if (blocking.length) {
    L.push('');
    L.push(paint('  BLOCKED: ' + blocking.map((b) => b.id).join(', '), 'red'));
  }
  L.push('');
  return L.join('\n');
}

export function renderMarkdown({ findings, sc, recipe, blocking }) {
  const L = [];
  L.push(`## Stanford compliance report`);
  L.push('');
  L.push(`**Score ${sc.value}/100**` +
    (sc.acknowledged ? ` (includes ${sc.acknowledged} accepted risk${sc.acknowledged > 1 ? 's' : ''})` : '') +
    `  ·  recipe \`${recipe}\``);
  L.push('');
  if (blocking.length) {
    L.push(`> **Blocked:** ${blocking.map((b) => `\`${b.id}\``).join(', ')}`);
    L.push('');
  }
  for (const [name, items] of group(findings)) {
    L.push(`<details${name === 'Blocking launch' ? ' open' : ''}><summary><strong>${name}</strong> (${items.length})</summary>`);
    L.push('');
    for (const f of items) {
      L.push(`- \`${f.id}\` ${f.detail}`);
      if (f.fix) L.push(`  - ${f.fix}`);
    }
    L.push('');
    L.push('</details>');
    L.push('');
  }
  L.push('<sub>Automated checks cover roughly 30% of accessibility issues per ODA guidance. ' +
    'A passing run is a floor, not a conformance claim. Findings are advisory except committed secrets.</sub>');
  return L.join('\n');
}

export function renderJson({ findings, sc, recipe, blocking }) {
  return JSON.stringify({
    recipe, score: sc, blocking: blocking.map((b) => b.id),
    counts: ['pass', 'fail', 'unknown', 'acknowledged', 'not_applicable']
      .reduce((a, s) => ({ ...a, [s]: findings.filter((f) => f.state === s).length }), {}),
    findings,
  }, null, 2);
}

// ---------------------------------------------------------------------------
// Destinations. Rendering is separated from publishing (github.mjs) so every
// body below can be built and inspected without a network or a token.
// ---------------------------------------------------------------------------

const band = (v) => (v >= 90 ? 'brightgreen' : v >= 70 ? 'yellow' : v >= 50 ? 'orange' : 'red');

/** Arrow for a delta. Neutral when flat: an unchanged score is not bad news. */
const arrow = (d) => (d > 0 ? '▲' : d < 0 ? '▼' : '·');

function honestyFooter() {
  return '<sub>Automated checks cover roughly 30% of accessibility issues per ODA guidance. ' +
    'A passing run is a floor, not a conformance claim. Everything is advisory except committed secrets.</sub>';
}

/**
 * The PR comment. One per PR, updated in place.
 *
 * Deliberately short at the top: score, trend, and what changed. The plan's
 * example is "88, down from 94, three new contrast findings in Hero.astro" —
 * the delta and its cause matter more than the full list, which is collapsed.
 */
export function renderPrComment({ findings, sc, recipe, blocking }, { trend, runUrl } = {}) {
  const L = [];
  const t = trend ? ` ${arrow(trend.delta)} ${trend.text}` : '';
  L.push(`### Stanford compliance report — **${sc.value}/100**${t}`);
  L.push('');

  const fails = findings.filter((f) => f.state === 'fail');
  const unknowns = findings.filter((f) => f.state === 'unknown');
  L.push(`\`${recipe}\` · ${findings.filter((f) => f.state === 'pass').length} passing · ` +
    `${fails.length} to fix · ${unknowns.length} unchecked` +
    (sc.acknowledged ? ` · ${sc.acknowledged} accepted risk${sc.acknowledged > 1 ? 's' : ''}` : ''));
  L.push('');

  if (blocking.length) {
    L.push(`> [!CAUTION]`);
    L.push(`> **This is the one thing that fails a build:** ${blocking.map((b) => `\`${b.id}\``).join(', ')}.`);
    L.push(`> Rotate the credential first — blocking the deploy does not un-leak it.`);
    L.push('');
  } else if (!fails.length) {
    L.push(`> [!NOTE]`);
    L.push(`> No automated failures. Nothing here blocks the build in any case.`);
    L.push('');
  }

  // The biggest available win, named. A list of twelve findings gets skimmed;
  // one specific next action gets done.
  const worst = [...fails].sort((a, b) => b.weight - a.weight)[0];
  if (worst) {
    L.push(`**Biggest win available:** \`${worst.id}\` (${worst.weight} point${worst.weight === 1 ? '' : 's'}) — ${worst.detail}`);
    L.push('');
  }

  L.push(renderMarkdown({ findings, sc, recipe, blocking: [] }).split('\n').slice(4).join('\n'));
  if (runUrl) L.push(`\n[Full run](${runUrl}) · the HTML report is attached to it as an artifact.`);
  return L.join('\n');
}

/**
 * The persistent "Site health" issue body.
 *
 * Findable by someone who has never opened the Actions tab, notifies watchers,
 * and accumulates history in its own edit trail. The score history is embedded
 * as an HTML comment by history.embedInBody(); the caller appends it.
 */
export function renderIssueBody({ findings, sc, recipe, blocking }, { trend, spark, runUrl, sha, updatedAt } = {}) {
  const L = [];
  L.push(`# Site health — ${sc.value}/100`);
  L.push('');
  if (trend) L.push(`**${arrow(trend.delta)} ${trend.text}**`);
  if (spark) L.push(`\`${spark}\`  <sub>last ${spark.length} runs, 0–100 scale</sub>`);
  L.push('');
  L.push(`Recipe \`${recipe}\` · updated ${updatedAt ?? new Date().toISOString()}` +
    (sha ? ` · \`${String(sha).slice(0, 7)}\`` : ''));
  L.push('');
  L.push('This issue is rewritten in place on every push to the default branch. ' +
    'It is not a task list and closing it will not stop the checks — reopen or ' +
    'delete it and the next run recreates it.');
  L.push('');

  if (blocking.length) {
    L.push(`> [!CAUTION]`);
    L.push(`> **${blocking.map((b) => `\`${b.id}\``).join(', ')}** — the only finding type that fails a build.`);
    L.push('');
  }

  L.push(renderMarkdown({ findings, sc, recipe, blocking: [] }).split('\n').slice(4).join('\n'));
  if (runUrl) L.push(`\n[Latest run](${runUrl})`);
  L.push('');
  L.push(honestyFooter());
  return L.join('\n');
}

/**
 * shields.io endpoint payload, for a README badge.
 *
 * Written as a file rather than pushed anywhere: deploy it with the site and
 * point shields at the deployed URL, so the badge needs no gist, no secret, and
 * no third-party service beyond shields itself.
 */
export function renderBadge(sc) {
  return JSON.stringify({
    schemaVersion: 1,
    label: 'Stanford compliance',
    message: `${sc.value}/100`,
    color: band(sc.value),
  });
}

/** Standalone HTML report, for the CI artifact. No assets, no network. */
export function renderHtml({ findings, sc, recipe, blocking }, { trend, spark, sha, runUrl } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = group(findings).map(([name, items]) => `
    <section>
      <h2>${esc(name)} <span class="count">${items.length}</span></h2>
      <table>
        <thead><tr><th>Criterion</th><th>Detail</th><th>Wt</th></tr></thead>
        <tbody>${items.map((f) => `
          <tr class="${esc(f.state)}">
            <td><code>${esc(f.id)}</code>${f.policy ? `<div class="policy">${esc(f.policy)}</div>` : ''}</td>
            <td>${esc(f.detail)}${f.fix ? `<div class="fix">${esc(f.fix)}</div>` : ''}</td>
            <td>${f.weight || ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stanford compliance report — ${sc.value}/100</title>
<style>
  :root { --cardinal:#8C1515; --ink:#2E2D29; --line:#e3e3e1; }
  *{box-sizing:border-box}
  body{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       color:var(--ink);margin:0;padding:2rem 1.5rem;max-width:60rem;margin-inline:auto}
  h1{font-size:1.5rem;margin:0 0 .25rem}
  .score{font-size:3rem;font-weight:700;line-height:1;color:var(--cardinal)}
  .meta{color:#5f5e5b;font-size:.875rem}
  .spark{font-family:ui-monospace,monospace;font-size:1.25rem;letter-spacing:1px}
  section{margin-top:2rem}
  h2{font-size:1.05rem;border-bottom:2px solid var(--line);padding-bottom:.35rem}
  .count{color:#5f5e5b;font-weight:400;font-size:.875rem}
  table{width:100%;border-collapse:collapse;font-size:.9rem}
  th{text-align:left;color:#5f5e5b;font-weight:600;font-size:.8rem;padding:.4rem .5rem}
  td{padding:.5rem;border-top:1px solid var(--line);vertical-align:top}
  code{font-family:ui-monospace,monospace;font-size:.85em}
  .fix,.policy{color:#5f5e5b;font-size:.85em;margin-top:.25rem}
  tr.fail td:first-child{border-left:3px solid var(--cardinal)}
  tr.unknown td:first-child{border-left:3px solid #b9b6b0}
  tr.acknowledged td:first-child{border-left:3px solid #7a9a01}
  footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line);
         color:#5f5e5b;font-size:.85rem}
</style></head><body>
<h1>Stanford compliance report</h1>
<div class="score">${sc.value}<span style="font-size:1rem;color:#5f5e5b">/100</span></div>
${trend ? `<p class="meta">${esc(arrow(trend.delta))} ${esc(trend.text)}</p>` : ''}
${spark ? `<p class="spark">${esc(spark)}</p>` : ''}
<p class="meta">Recipe <code>${esc(recipe)}</code>${sha ? ` · <code>${esc(String(sha).slice(0, 7))}</code>` : ''}
 · ${new Date().toISOString()}${runUrl ? ` · <a href="${esc(runUrl)}">run</a>` : ''}</p>
${blocking.length ? `<p class="meta"><strong>Blocked:</strong> ${blocking.map((b) => esc(b.id)).join(', ')}</p>` : ''}
${rows}
<footer>
  Automated checks cover roughly <strong>30%</strong> of accessibility issues per ODA guidance.
  A passing run is a floor, not a conformance claim. Everything is advisory except committed secrets.
</footer>
</body></html>
`;
}
