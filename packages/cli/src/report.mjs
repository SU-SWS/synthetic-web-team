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
