#!/usr/bin/env node
// Four gates. Each was added after the previous set missed a real gap, so the
// comments below are a record of what actually went wrong.
//
//   1. Every criterion maps to a check, or is marked manual, or declares
//      `unimplemented:`. A criterion with none of those is a wish.
//   2. Every finding id a check can emit has a criterion somewhere.
//      A check with no criterion is invisible: it runs, reports, and scores 0.
//      Added after the CLI emitted `build.site-set` for weeks, scoring nothing.
//   3. Every criterion that names a check has some check that emits its id.
//      Was advisory; all five standing warnings turned out to be real.
//   4. Every `check:` names a module that actually exists. The CLI iterates the
//      module registry and ignores `check:`, so a typo here is invisible.
//
// Also resolves `extends` chains so an inherited criterion counts as defined.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
// Root devDependency, not a reach into packages/cli/node_modules. That deep
// path worked only while npm happened not to hoist it, and it made this script
// silently dependent on another package's install layout.
import YAML from 'yaml';

const RECIPES = 'standards/recipes';
let failures = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };

function load(id, seen = new Set()) {
  const p = join(RECIPES, id, 'acceptance.yml');
  if (!existsSync(p)) return null;
  if (seen.has(id)) { fail(`circular extends at ${id}`); return null; }
  seen.add(id);
  const own = YAML.parse(readFileSync(p, 'utf8')) || {};
  if (!own.extends) return { ...own, criteria: own.criteria ?? [] };
  const parent = load(own.extends, seen);
  if (!parent) { fail(`${id} extends ${own.extends}, not found`); return { ...own, criteria: own.criteria ?? [] }; }
  const merged = new Map(parent.criteria.map((c) => [c.id, c]));
  for (const o of own.overrides ?? []) {
    if (!merged.has(o.id)) fail(`${id} overrides "${o.id}", which ${own.extends} does not define`);
    else if (o.applies === false) merged.delete(o.id);
    else merged.set(o.id, { ...merged.get(o.id), ...o });
  }
  for (const c of own.criteria ?? []) merged.set(c.id, c);
  return { ...own, criteria: [...merged.values()] };
}

const recipes = readdirSync(RECIPES).filter((d) => existsSync(join(RECIPES, d, 'acceptance.yml')));
const allCriterionIds = new Set();

for (const id of recipes) {
  const a = load(id);
  if (!a) continue;
  a.criteria.forEach((c) => allCriterionIds.add(c.id));

  // Gate 1
  const orphans = a.criteria.filter((c) => !c.check && !c.manual && !c.unimplemented);
  for (const o of orphans) {
    fail(`${id}: criterion "${o.id}" has no check, is not marked manual, and declares no \`unimplemented:\` reason`);
  }

  const manual = a.criteria.filter((c) => c.manual).length;
  console.log(`${id.padEnd(16)} ${String(a.criteria.length).padStart(3)} criteria` +
    `  ${String(manual).padStart(2)} manual` +
    (a.extends ? `  extends ${a.extends}` : ''));
}

// Gate 2: harvest every finding id the checks can emit. Match only ids in the
// position an id actually occupies: the first argument to a result helper, or an
// explicit `id:` property. A looser regex also matched string literals like
// 'robots.txt' and 'astro.config.js', which are filenames, not ids.
const src = readFileSync('packages/cli/src/checks.mjs', 'utf8');
const ID = String.raw`([a-z][a-z0-9]*(?:\.[a-z0-9-]+)+)`;
const emitted = new Set([
  ...[...src.matchAll(new RegExp(String.raw`\b(?:ok|bad|dunno|na)\('${ID}'`, 'g'))].map((m) => m[1]),
  ...[...src.matchAll(new RegExp(String.raw`\bid:\s*'${ID}'`, 'g'))].map((m) => m[1]),
]);

for (const id of [...emitted].filter((i) => !allCriterionIds.has(i)).sort()) {
  fail(`check emits "${id}" but no recipe declares a criterion for it (it would score 0)`);
}

// Gate 3: a criterion that names a check but whose id no check ever emits.
// This was advisory on the theory that a check might emit conditionally. It
// never did: all five standing warnings were real, three fixable and two
// mislabelled. Advisory meant they sat there for weeks, so it fails now.
//
// Two declared escapes, both of which must say so in the criterion:
//   manual: true        a person verifies it; reported as a prompt, never scored
//   unimplemented: <why> honest debt. Still reports `unknown` and still
//                        withholds its weight, so declaring it costs the score
//                        exactly what leaving it silent did.
const neverEmitted = [...allCriterionIds].filter((id) => !emitted.has(id));
const declaredWithCheck = new Set();
const declaredDebt = new Map();
for (const r of recipes) {
  const a = load(r);
  for (const c of a?.criteria ?? []) {
    if (c.unimplemented) declaredDebt.set(c.id, c.unimplemented);
    if (c.check && !c.manual && !c.unimplemented) declaredWithCheck.add(c.id);
  }
}
for (const id of neverEmitted.filter((i) => declaredWithCheck.has(i)).sort()) {
  fail(`criterion "${id}" names a check but no check emits that id. ` +
    `Implement it, mark it \`manual: true\`, or declare \`unimplemented:\` with a reason.`);
}

// Gate 4: a criterion pointing at a check module that does not exist. The CLI
// iterates the module registry and ignores `check:`, so a typo here is
// invisible at runtime and scores nothing. `minweb.ownership` named a module
// called `ownership` for weeks; the check lives in `manifest`.
const { ALL } = await import('../packages/cli/src/checks.mjs');
for (const r of recipes) {
  for (const c of load(r)?.criteria ?? []) {
    if (c.check && !(c.check in ALL)) {
      fail(`${r}: criterion "${c.id}" names check module "${c.check}", which does not exist. ` +
        `Known modules: ${Object.keys(ALL).sort().join(', ')}`);
    }
  }
}

for (const [id, why] of [...declaredDebt].sort()) {
  console.log(`DEBT  ${id}  ${String(why).trim().split('\n')[0]}`);
}

console.log(`\n${allCriterionIds.size} distinct criteria across ${recipes.length} recipe(s)`);
console.log(`${emitted.size} finding ids emitted by checks`);
console.log(failures ? `\n${failures} failure(s)` : '\nAll four gates passed.');
process.exit(failures ? 1 : 0);
