#!/usr/bin/env node
// Two gates, in both directions. The second one was added after the first
// missed a real gap: the CLI emitted `build.site-set` findings for weeks with
// no matching criterion, so the check ran and scored nothing.
//
//   1. Every criterion maps to an implemented check, or is marked manual.
//      A criterion with no check is a wish.
//   2. Every finding id a check can emit has a criterion somewhere.
//      A check with no criterion is invisible: it runs, reports, and scores 0.
//
// Also resolves `extends` chains so an inherited criterion counts as defined.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import YAML from '../packages/cli/node_modules/yaml/dist/index.js';

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
  const orphans = a.criteria.filter((c) => !c.check && !c.manual);
  for (const o of orphans) fail(`${id}: criterion "${o.id}" has no check and is not marked manual`);

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

// Gate 3, advisory: a criterion pointing at a check module that never emits its
// id. Not a hard failure because a check may legitimately emit conditionally,
// but it is usually a rename that only got applied on one side.
const neverEmitted = [...allCriterionIds].filter((id) => !emitted.has(id));
const declaredWithCheck = new Set();
for (const r of recipes) {
  const a = load(r);
  a?.criteria.filter((c) => c.check && !c.manual).forEach((c) => declaredWithCheck.add(c.id));
}
const suspicious = neverEmitted.filter((id) => declaredWithCheck.has(id));
for (const id of suspicious.sort()) {
  console.log(`WARN  criterion "${id}" names a check but no check emits that id`);
}

console.log(`\n${allCriterionIds.size} distinct criteria across ${recipes.length} recipe(s)`);
console.log(`${emitted.size} finding ids emitted by checks`);
console.log(failures ? `\n${failures} failure(s)` : '\nBoth gates passed.');
process.exit(failures ? 1 : 0);
