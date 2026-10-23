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
import { plan, STANDARDS_DIR, IMPORT, CONTRACT_BEGIN, CONTRACT_END } from '../packages/wizard/src/emit.mjs';
import { EDITORS } from '../packages/wizard/src/detect.mjs';

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
const args = {
  root: '.',
  source: '.',
  editors: [],
  answers: { recipe: 'astro-static', siteName: 'validate-emit', unit: 'SWS' },
  tier: { id: 'low', label: 'Low' },
};

// Skills are USER scope: installed once into the person's tool rather than
// copied into every repository. The emitted paths are unchanged -- only the root
// they are written under differs -- so the target directories below still apply.
const userFiles = plan({ ...args, scope: 'user' });
const projectFiles = plan({ ...args, scope: 'project' });

const emitted = new Map(userFiles.map((f) => [f.path, f.contents]));

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

// The invariant from docs/skill-paths.md, which now lives in the home directory
// rather than in each project: the two directories must be identical to each
// other, because if they diverge then Cursor and Claude Code follow different
// instructions with no obvious cause.
const [a, b] = TARGETS;
const divergent = names.filter(
  (n) => emitted.get(`${a}/${n}/SKILL.md`) !== emitted.get(`${b}/${n}/SKILL.md`)
);
if (divergent.length) fail(`${a} and ${b} disagree on: ${divergent.join(', ')}`);
else console.log(`OK     ${a} and ${b} are identical`);

// ---- the two-part install: scopes must not overlap, and must cover ---------
//
// These three gates are what stop the split from silently collapsing back into
// one install. The first regression to expect is a skill leaking into project
// scope, which would put a frozen copy in every repository again.
const userPaths = new Set(userFiles.map((f) => f.path));
const projectPaths = new Set(projectFiles.map((f) => f.path));

const overlap = [...userPaths].filter((x) => projectPaths.has(x));
if (overlap.length) fail(`user and project scope both emit: ${overlap.join(', ')}`);
else console.log(`OK     scopes are disjoint  ${userPaths.size} user, ${projectPaths.size} project`);

const leaked = [...projectPaths].filter((x) => /skills\/.+\/SKILL\.md$/.test(x));
if (leaked.length) fail(`project scope emits ${leaked.length} skill file(s), e.g. ${leaked.slice(0, 3).join(', ')}`);
else console.log('OK     project scope emits no skills');

for (const required of ['AGENTS.md', '.sws/manifest.yml', '.sws/acknowledged.yml']) {
  if (!projectPaths.has(required)) fail(`project scope is missing ${required}`);
}
const stdCount = [...projectPaths].filter((x) => x.startsWith(`${STANDARDS_DIR}/`)).length;
if (!stdCount) fail(`project scope emits no ${STANDARDS_DIR}/ files`);
else console.log(`OK     project scope  AGENTS.md, .sws state, ${stdCount} standards files`);

// ---- what a project gets, with every editor selected -----------------------
//
// Three invariants, each the fix for a problem a real project hit:
//   - nothing at the root but AGENTS.md and the pointer files an editor needs,
//     because a `standards/` folder next to the team's source is clutter
//   - no committed file names a .claude/ path, because many teams git-ignore it
//   - CLAUDE.md and GEMINI.md are exactly `@AGENTS.md`, as Next.js writes them,
//     and AGENTS.md is the contract between markers, citing .sws/standards/
const everyEditor = plan({ ...args, editors: EDITORS, scope: 'project' });
const pointers = new Set(EDITORS.flatMap((e) => e.emits));

const stray = everyEditor.map((f) => f.path)
  .filter((x) => x !== 'AGENTS.md' && !x.startsWith('.sws/') && !pointers.has(x));
if (stray.length) fail(`project scope writes outside .sws/: ${stray.join(', ')}`);
else console.log(`OK     project scope  everything but AGENTS.md and ${pointers.size} editor pointers is under .sws/`);

// A path INSIDE a project's .claude/. Naming the directory to say why nothing
// goes there is the contract doing its job, and `~/.claude/skills` is the
// person's home directory, which is where skills do go.
const PROJECT_CLAUDE_PATH = /(^|[^~\w/])\.claude\/[\w-]/m;
// A file outside .sws/ may already exist for the project's own reasons, so it
// is added to, never written over. The one exception is a file under our own
// name (`sws.mdc`, `sws.md`), which nobody else would have.
const overwrites = everyEditor
  .filter((f) => !f.path.startsWith('.sws/') && !f.merge && !/(^|\/)sws\.[a-z]+$/.test(f.path))
  .map((f) => f.path);
if (overwrites.length) fail(`would overwrite a file the project may own: ${overwrites.join(', ')}`);
else console.log('OK     every shared file is merged into, never overwritten');

const claudePaths = everyEditor.filter((f) => !f.path.startsWith(`${STANDARDS_DIR}/`) && PROJECT_CLAUDE_PATH.test(f.contents));
if (claudePaths.length) fail(`committed file names a .claude/ path: ${claudePaths.map((f) => f.path).join(', ')}`);
else console.log('OK     no emitted contract, pointer or state file names a .claude/ path');

for (const name of ['CLAUDE.md', 'GEMINI.md']) {
  const f = everyEditor.find((x) => x.path === name);
  if (!f) fail(`${name} is not emitted for any editor`);
  else if (f.contents !== IMPORT || f.merge !== 'import') fail(`${name} is not exactly ${JSON.stringify(IMPORT)}`);
}
console.log('OK     CLAUDE.md and GEMINI.md are exactly @AGENTS.md');

const agents = everyEditor.find((x) => x.path === 'AGENTS.md');
const body = agents?.contents ?? '';
if (!body.startsWith(CONTRACT_BEGIN) || !body.endsWith(CONTRACT_END)) {
  fail('the shipped contract is not wrapped in its markers');
}
// A bare `standards/x` in the shipped contract points at a folder a project no
// longer has. `standards/<path>` is the one deliberate mention: the sentence
// that says skills cite that form.
const bare = [...body.matchAll(/`(standards\/[^`]*)`/g)].map((m) => m[1]).filter((x) => x !== 'standards/<path>');
if (bare.length) fail(`shipped contract cites standards/ without .sws/: ${bare.join(', ')}`);
const cited = [...body.matchAll(/`\.sws\/(standards\/[^`<]+?)\/?`/g)].map((m) => m[1]);
const missing = cited.filter((x) => !existsSync(x));
if (missing.length) fail(`shipped contract cites paths that do not exist: ${missing.join(', ')}`);
if (!bare.length && !missing.length) console.log(`OK     shipped contract  between markers, ${cited.length} .sws/standards/ paths, all resolve`);

const emittedSkillFiles = [...emitted.keys()].filter((p) => /^\.(agents|claude)\/skills\/.+\/SKILL\.md$/.test(p)).length;
console.log(`\n${names.length} skills in ${SOURCE}/, ${emittedSkillFiles} files emitted across ${TARGETS.length} paths at USER scope`);
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
