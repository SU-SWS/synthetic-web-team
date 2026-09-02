#!/usr/bin/env node
// Every skill in skills/ must reach BOTH consumer paths, byte-identical.
//
// This is the CI half of the skill-path invariant, and it replaces a stale
// check that could not work here. `sync-skills.mjs --check` compares the two
// LOCAL copies, which are gitignored in this repo and therefore absent in every
// CI checkout -- so as a CI gate it was red unconditionally and told us nothing.
//
// The failure that actually happened is a different one: the six shared sws-*
// skills sat missing from both emitted paths for three weeks. That is an
// EMITTER bug, not a local-copy bug, and it travels to consumer projects, where
// `.agents/skills/` and `.claude/skills/` are committed with no skills/ source
// to regenerate from. So drive the real emitter and assert coverage.
//
// This can go red: hardcode a skill list in plan(), drop a target path, filter
// by prefix, or mangle contents on the way out, and this fails.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { plan } from '../packages/create-web-team/src/emit.mjs';

const SOURCE = 'skills';
const TARGETS = ['.agents/skills', '.claude/skills'];

let failures = 0;
const fail = (msg) => { console.log(`::error::${msg}`); console.log(`FAIL  ${msg}`); failures++; };

const source = {};
for (const name of readdirSync(SOURCE)) {
  const f = join(SOURCE, name, 'SKILL.md');
  if (existsSync(f)) source[name] = readFileSync(f, 'utf8');
}
const names = Object.keys(source).sort();
if (!names.length) fail(`no skills found in ${SOURCE}/`);

// Minimal but real arguments. No editors: pointer files are not under test
// here, and an empty list keeps this pinned to the universal core, which is
// where the skills live.
const files = plan({
  root: '.',
  source: '.',
  editors: [],
  answers: { recipe: 'astro-static', siteName: 'validate-emit', unit: 'SWS' },
  tier: { id: 'low', label: 'Low' },
});

const emitted = new Map(files.map((f) => [f.path, f.contents]));

for (const target of TARGETS) {
  const got = [...emitted.keys()]
    .filter((p) => p.startsWith(`${target}/`))
    .map((p) => p.slice(target.length + 1).replace(/\/SKILL\.md$/, ''))
    .sort();

  const missing = names.filter((n) => !got.includes(n));
  const extra = got.filter((n) => !names.includes(n));
  if (missing.length) fail(`${target} is missing ${missing.length} skill(s): ${missing.join(', ')}`);
  if (extra.length) fail(`${target} emits ${extra.length} skill(s) not in ${SOURCE}/: ${extra.join(', ')}`);

  const differ = names.filter(
    (n) => emitted.has(`${target}/${n}/SKILL.md`) && emitted.get(`${target}/${n}/SKILL.md`) !== source[n]
  );
  if (differ.length) fail(`${target} contents differ from ${SOURCE}/: ${differ.join(', ')}`);

  if (!missing.length && !extra.length && !differ.length) {
    console.log(`OK     ${target}  ${got.length} skills, byte-identical to ${SOURCE}/`);
  }
}

// The consumer invariant from docs/skill-paths.md: the two committed
// directories must be identical to each other, because if they diverge that
// project's Cursor and Claude Code follow different instructions.
const [a, b] = TARGETS;
const divergent = names.filter(
  (n) => emitted.get(`${a}/${n}/SKILL.md`) !== emitted.get(`${b}/${n}/SKILL.md`)
);
if (divergent.length) fail(`${a} and ${b} disagree on: ${divergent.join(', ')}`);
else console.log(`OK     ${a} and ${b} are identical`);

const emittedSkillFiles = [...emitted.keys()].filter((p) => /^\.(agents|claude)\/skills\/.+\/SKILL\.md$/.test(p)).length;
console.log(`\n${names.length} skills in ${SOURCE}/, ${emittedSkillFiles} files emitted across ${TARGETS.length} paths`);
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
