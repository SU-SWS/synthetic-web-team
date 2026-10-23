#!/usr/bin/env node
// The project install, run for real against scratch directories.
//
// validate-emit.mjs checks what plan() says it will write. This checks what
// write() actually does to a repository that already has things in it, which
// is where every data-loss bug in the install so far has lived:
//
//   - a project's own AGENTS.md, with a Next.js block and its own rules, was
//     replaced and reported as `updated`
//   - its CLAUDE.md, exactly `@AGENTS.md` as Next.js writes it, was rewritten
//     for no difference in behaviour
//   - 45 files went into a `standards/` folder at the root, and re-running the
//     install after moving them by hand would have written them there again
//
// Every scenario runs twice where it matters, because "a second run reports
// unchanged" is the property that makes re-running the install safe.

import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync,
  symlinkSync, lstatSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { plan, write, contract, STANDARDS_DIR, IMPORT, CONTRACT_BEGIN, CONTRACT_END, INSTALLED_PATH } from '../packages/wizard/src/emit.mjs';
import { EDITORS } from '../packages/wizard/src/detect.mjs';
import { findStandards } from '../packages/cli/src/standards.mjs';

const SOURCE = resolve('.');
const WIZARD = resolve('packages/wizard/bin/wizard.mjs');
const BLOCK = contract(SOURCE);
const CLAUDE_CODE = EDITORS.filter((e) => e.id === 'claude-code');

let failures = 0;
let passes = 0;
const check = (cond, msg) => {
  if (cond) passes++;
  else { console.log(`::error::${msg}`); console.log(`FAIL  ${msg}`); failures++; }
};
const scenario = (name) => console.log(`\n${name}`);

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);
const scratch = [];
const fresh = () => { const d = mkdtempSync(join(tmpdir(), 'sws-install-')); scratch.push(d); return d; };
const put = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
const get = (root, rel) => readFileSync(join(root, rel), 'utf8');
const count = (hay, needle) => hay.split(needle).length - 1;
const status = (r, path) => r.results.find((x) => x.path === path)?.status;

const answers = { recipe: 'astro-static', siteName: 'validate-install', unit: 'SWS' };
const tier = { tier: 'low', because: 'test', adds: [] };
const files = plan({ root: '.', source: SOURCE, editors: CLAUDE_CODE, answers, tier });
const allFiles = plan({ root: '.', source: SOURCE, editors: EDITORS, answers, tier });
const standards = files.filter((f) => f.path.startsWith(`${STANDARDS_DIR}/`));
const run = (root, opts) => write(root, files, { version: 'test', ...opts });
const runAll = (root, opts) => write(root, allFiles, { version: 'test', ...opts });
const json = (root, rel) => JSON.parse(get(root, rel));
const SWS = { command: 'npx', args: ['-y', '@su-sws/synthetic-web-team-mcp'] };
const record = (root, files) => put(root, INSTALLED_PATH, JSON.stringify({ scope: 'project', version: '0.1.2', files }));

function wizard(root, extra = []) {
  const out = execFileSync('node', [WIZARD, 'add', root, '--json', '--editors', 'claude-code',
    '--answers', JSON.stringify(answers), ...extra], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(out);
}

const NEXT_AGENTS = `<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

Read the guide in node_modules/next/dist/docs/.

<!-- END:nextjs-agent-rules -->

# Our site

Our own rules. \`npm run lint\` before pushing.
`;

// The contract as 0.1.x wrote it: the whole file, no markers.
const OLD_CONTRACT = `${BLOCK.slice(CONTRACT_BEGIN.length + 1, BLOCK.lastIndexOf('\n'))}\n`;
const OLD_POINTER = `<!--
  Stanford Web Services agent team.

  This file is a POINTER, not content. The behavioral contract is AGENTS.md,
  and the team is in .agents/skills/ and .claude/skills/.

  Editing this file will not change how the agent behaves. Edit AGENTS.md.
-->

@AGENTS.md
`;

// Lay a project out the way 0.1.x left it: standards/ at the root, the whole-
// file contract, the commented pointer, and an install record for all of it.
function oldLayout(root, { agents = OLD_CONTRACT } = {}) {
  const rec = {};
  for (const f of standards) {
    const rel = f.path.slice('.sws/'.length);
    put(root, rel, f.contents);
    rec[rel] = hash(f.contents);
  }
  put(root, 'AGENTS.md', agents);
  rec['AGENTS.md'] = hash(OLD_CONTRACT);
  put(root, 'CLAUDE.md', OLD_POINTER);
  rec['CLAUDE.md'] = hash(OLD_POINTER);
  put(root, INSTALLED_PATH, JSON.stringify({ scope: 'project', version: '0.1.2', files: rec }));
}

// ---------------------------------------------------------------------------
scenario('fresh project, through the wizard binary');
{
  const root = fresh();
  const first = wizard(root);
  const top = readdirSync(root).sort();
  check(JSON.stringify(top) === JSON.stringify(['.mcp.json', '.sws', 'AGENTS.md', 'CLAUDE.md']),
    `root holds only AGENTS.md, CLAUDE.md, .mcp.json and .sws, got ${top.join(', ')}`);
  check(get(root, 'CLAUDE.md') === IMPORT, 'CLAUDE.md is exactly @AGENTS.md');
  check(get(root, 'AGENTS.md') === `${BLOCK}\n`, 'AGENTS.md is the contract block');
  check(existsSync(join(root, STANDARDS_DIR, 'fragments', 'global-footer.yml')), 'standards are under .sws/standards');
  check(first.counts.created === files.length, `first run creates every file (${first.counts.created}/${files.length})`);

  const second = wizard(root);
  const c = second.counts;
  check(c.created === 0 && c.updated === 0 && c.merged === 0 && c.moved === 0 && c.conflicts === 0,
    `second run changes nothing: ${JSON.stringify(c)}`);
  check(second.files.every((f) => f.status === 'unchanged' || f.status === 'preserved'), 'second run is all unchanged or preserved');
}

scenario('existing AGENTS.md and CLAUDE.md, as Next.js writes them');
{
  const root = fresh();
  put(root, 'AGENTS.md', NEXT_AGENTS);
  put(root, 'CLAUDE.md', IMPORT);
  const r = wizard(root);
  const agents = get(root, 'AGENTS.md');
  check(agents.startsWith(NEXT_AGENTS), 'their AGENTS.md content is kept, byte for byte, ahead of ours');
  check(count(agents, CONTRACT_BEGIN) === 1 && agents.endsWith(`${BLOCK}\n`), 'the contract is added once, between markers');
  check(r.files.find((f) => f.path === 'AGENTS.md')?.status === 'merged', 'AGENTS.md reports merged, not updated');
  check(get(root, 'CLAUDE.md') === IMPORT, 'CLAUDE.md is left as @AGENTS.md');
  check(r.files.find((f) => f.path === 'CLAUDE.md')?.status === 'unchanged', 'CLAUDE.md reports unchanged');
  const again = wizard(root);
  check(again.counts.merged === 0 && again.counts.updated === 0 && get(root, 'AGENTS.md') === agents,
    'a second run leaves AGENTS.md alone');
}

scenario('AGENTS.md prose that quotes the markers');
{
  const root = fresh();
  const prose = '# Our rules\n\nThe SWS contract lives between `<!-- BEGIN:sws-agent-contract -->` and `<!-- END:sws-agent-contract -->`.\n';
  put(root, 'AGENTS.md', prose);
  const r = run(root);
  const text = get(root, 'AGENTS.md');
  check(status(r, 'AGENTS.md') === 'merged' && text.startsWith(prose) && text.endsWith(`${BLOCK}\n`),
    'a marker quoted inline is not the block: the prose is untouched and the contract appended');
  check(status(run(root), 'AGENTS.md') === 'unchanged', 'and a second run finds the real block');
}

scenario('their own CLAUDE.md, with no import');
{
  const root = fresh();
  const own = '# Claude notes\n\nUse the staging API.\n';
  put(root, 'CLAUDE.md', own);
  const r = run(root);
  const text = get(root, 'CLAUDE.md');
  check(status(r, 'CLAUDE.md') === 'merged' && text.startsWith(own) && /^@AGENTS\.md$/m.test(text),
    'the import is added and their content kept');
  check(status(run(root), 'CLAUDE.md') === 'unchanged', 'a second run leaves it alone');
}

scenario('an earlier version\'s layout: standards/ at the root, one of them edited');
{
  const root = fresh();
  oldLayout(root);
  const edited = standards[3].path.slice('.sws/'.length);
  put(root, edited, `${get(root, edited)}\nour local note\n`);
  put(root, 'standards/team-notes.md', 'ours, not theirs\n');

  const r = run(root);
  check(r.moved.length === standards.length, `every recorded standard moves (${r.moved.length}/${standards.length})`);
  check(readdirSync(join(root, 'standards')).join() === 'team-notes.md', 'only the team\'s own file is left in standards/');
  const at = `.sws/${edited}`;
  check(get(root, at).endsWith('our local note\n'), 'the edit came along with the move');
  check(status(r, at) === 'conflict', 'and is still reported as a conflict at its new path');
  check(get(root, 'AGENTS.md') === `${BLOCK}\n` && status(r, 'AGENTS.md') === 'updated',
    'an unedited whole-file contract becomes the marked block');
  check(get(root, 'CLAUDE.md') === IMPORT, 'the old pointer comment, which named .claude/skills/, is gone');

  const again = run(root);
  check(again.moved.length === 0 && again.created === 0 && again.updated === 0 && again.merged === 0,
    'a second run moves and changes nothing');
  check(again.conflicts.length === 1 && again.conflicts[0] === at, 'the edited file is still the one conflict');
}

scenario('an earlier layout whose own code reads the standards at standards/');
{
  // The way this package's own site reads the footer, and the way the recipe
  // tells a site to: moving the file out from under it fails the next build.
  const READER = "const REL = join('standards', 'fragments', 'global-footer.yml');\n";
  const root = fresh();
  oldLayout(root);
  put(root, 'src/lib/footer.ts', READER);
  put(root, '.github/workflows/ci.yml', 'jobs:\n  c:\n    steps:\n      - run: npx sws check --standards standards\n');
  put(root, 'astro.config.mjs', "import f from './standards/fragments/global-footer.yml';\n");
  put(root, 'README.md', 'See standards/policy/brand.md.\n');

  const out = wizard(root);
  const d = out.deferred;
  const files = (d?.references ?? []).map((x) => x.file).sort().join(', ');
  check(out.counts.moved === 0 && existsSync(join(root, 'standards/fragments/global-footer.yml')),
    'the move waits, and the footer stays where the code reads it');
  check(files === '.github/workflows/ci.yml, astro.config.mjs, src/lib/footer.ts',
    `every reference is reported, prose is not: got ${files}`);
  check(out.next.some((n) => n.kind === 'update-references' && n.references.length === 3),
    'next[] says what to change, as data');
  check(!existsSync(join(root, STANDARDS_DIR)), 'nothing is written to .sws/standards/ meanwhile');
  check(out.files.filter((f) => f.path.startsWith('standards/')).every((f) => f.status === 'unchanged'),
    'and the standards are kept current where they are');

  put(root, 'src/lib/footer.ts', READER.replace("join('standards'", "join('.sws', 'standards'"));
  put(root, '.github/workflows/ci.yml', 'jobs:\n  c:\n    steps:\n      - run: npx sws check --standards .sws/standards\n');
  put(root, 'astro.config.mjs', "import f from './.sws/standards/fragments/global-footer.yml';\n");
  const after = wizard(root);
  check(after.counts.moved === standards.length && !after.deferred, 'once the references point at .sws/standards/, the files move');

  const forced = fresh();
  oldLayout(forced);
  put(forced, 'src/lib/footer.ts', READER);
  check(run(forced, { force: true }).moved.length === standards.length, '--force moves them regardless');
}

scenario('moved by hand, with the contract pasted under the project\'s own rules');
{
  const root = fresh();
  oldLayout(root, { agents: `${NEXT_AGENTS}\n---\n\n${OLD_CONTRACT.replace('`standards/scope.md`', '`.sws/standards/scope.md`')}` });
  for (const f of standards) {
    const rel = f.path.slice('.sws/'.length);
    put(root, f.path, get(root, rel));
    rmSync(join(root, rel));
  }
  const before = get(root, 'AGENTS.md');

  const r = run(root);
  check(r.moved.length === 0, 'nothing left to move');
  check(standards.every((f) => status(r, f.path) === 'unchanged'), 'the hand-moved standards are recognised as ours');
  check(status(r, 'AGENTS.md') === 'conflict' && r.results.find((x) => x.path === 'AGENTS.md').reason === 'legacy-contract',
    'the unmarked contract copy is a conflict, with the reason');
  check(get(root, 'AGENTS.md') === before, 'and the file is not touched');

  run(root, { force: true });
  const after = get(root, 'AGENTS.md');
  check(after.startsWith(`${NEXT_AGENTS}\n---\n\n`), '--force keeps everything ahead of the old contract');
  check(count(after, '# Stanford Web Services: agent contract') === 1 && after.endsWith(`${BLOCK}\n`),
    '--force leaves exactly one contract, the marked one');
  check(status(run(root), 'AGENTS.md') === 'unchanged', 'and a run after that is unchanged');
}

scenario('CLAUDE.md is a symbolic link to AGENTS.md');
{
  const root = fresh();
  put(root, 'AGENTS.md', NEXT_AGENTS);
  symlinkSync('AGENTS.md', join(root, 'CLAUDE.md'));
  const r = run(root);
  check(lstatSync(join(root, 'CLAUDE.md')).isSymbolicLink(), 'the link is still a link');
  check(status(r, 'CLAUDE.md') === 'unchanged', 'and reports unchanged, since it already reads AGENTS.md');
  const agents = get(root, 'AGENTS.md');
  check(agents.startsWith(NEXT_AGENTS) && count(agents, CONTRACT_BEGIN) === 1 && !/^@AGENTS\.md$/m.test(agents),
    'AGENTS.md gets the contract and nothing written through the link');
}

scenario('AGENTS.md is a symbolic link to CLAUDE.md');
{
  const root = fresh();
  const own = '# Team rules\n\nUse the staging API.\n';
  put(root, 'CLAUDE.md', own);
  symlinkSync('CLAUDE.md', join(root, 'AGENTS.md'));
  const r = run(root);
  const text = get(root, 'CLAUDE.md');
  check(lstatSync(join(root, 'AGENTS.md')).isSymbolicLink(), 'the link is still a link');
  check(text.startsWith(own) && count(text, CONTRACT_BEGIN) === 1, 'the contract lands in the file both names share');
  check(!/^@AGENTS\.md$/m.test(text) && status(r, 'CLAUDE.md') === 'unchanged', 'and no import that would import itself');
  check(status(run(root), 'AGENTS.md') === 'unchanged', 'a second run is unchanged');

  const outside = fresh();
  const elsewhere = fresh();
  put(elsewhere, 'AGENTS.md', '# shared\n');
  symlinkSync(join(elsewhere, 'AGENTS.md'), join(outside, 'AGENTS.md'));
  const o = run(outside);
  check(status(o, 'AGENTS.md') === 'conflict' && get(elsewhere, 'AGENTS.md') === '# shared\n',
    'a link that leaves the project is not written through');
}

scenario('markers inside a fenced example in AGENTS.md');
{
  for (const fence of ['```', '~~~']) {
    const root = fresh();
    const example = `# Our rules\n\nThe install adds a block like this:\n\n${fence}markdown\n${CONTRACT_BEGIN}\n(the contract)\n${CONTRACT_END}\n${fence}\n`;
    put(root, 'AGENTS.md', example);
    const r = run(root);
    const text = get(root, 'AGENTS.md');
    check(status(r, 'AGENTS.md') === 'merged' && text.startsWith(example) && text.endsWith(`${BLOCK}\n`),
      `${fence} fence: the example is left alone and the contract appended after it`);
    check(status(run(root), 'AGENTS.md') === 'unchanged' && get(root, 'AGENTS.md') === text,
      `${fence} fence: a second run finds the real block, not the example`);
  }
}

scenario('the CLI finds the standards');
{
  const bundled = resolve('standards');
  const ours = (root, rel) => put(root, `${rel}/fragments/global-footer.yml`, 'x\n');
  const a = fresh(); ours(a, '.sws/standards');
  check(findStandards(a, { bundled }) === join(a, '.sws/standards'), 'a project with .sws/standards/ uses it');
  const b = fresh(); ours(b, 'standards');
  check(findStandards(b, { bundled }) === join(b, 'standards'), 'an older project with standards/ at the root uses that');
  const c = fresh(); ours(c, '.sws/standards'); put(c, 'standards/README.md', 'the team\'s own\n');
  check(findStandards(c, { bundled }) === join(c, '.sws/standards'), 'a team\'s own standards/ is passed over for ours');
  const e = fresh(); put(e, 'standards/README.md', 'the team\'s own\n');
  check(findStandards(e, { bundled }) === bundled, 'with neither, the copy beside the CLI');
}

scenario('a standards/ folder of the team\'s own, with no install record');
{
  const root = fresh();
  put(root, 'standards/fragments/global-footer.yml', 'not ours\n');
  const r = run(root);
  check(r.moved.length === 0 && get(root, 'standards/fragments/global-footer.yml') === 'not ours\n',
    'nothing without a record behind it is moved');
}

scenario('CRLF line endings');
{
  const root = fresh();
  const crlf = NEXT_AGENTS.replace(/\n/g, '\r\n');
  put(root, 'AGENTS.md', crlf);
  run(root);
  const text = get(root, 'AGENTS.md');
  check(text.startsWith(crlf) && !/[^\r]\n/.test(text), 'the merged file keeps CRLF throughout');
  check(status(run(root), 'AGENTS.md') === 'unchanged', 'and a second run is unchanged');
}

scenario('an edit inside the markers');
{
  const root = fresh();
  run(root);
  const edited = get(root, 'AGENTS.md').replace('Read it once, follow it throughout.', 'Read it twice.');
  put(root, 'AGENTS.md', edited);
  const r = run(root);
  check(status(r, 'AGENTS.md') === 'conflict' && get(root, 'AGENTS.md') === edited, 'is a conflict, and left alone');
  run(root, { force: true });
  check(get(root, 'AGENTS.md') === `${BLOCK}\n`, '--force puts the contract back');
}

scenario('every editor at once, twice');
{
  const root = fresh();
  const first = runAll(root);
  check(first.created === allFiles.length, `every file is created (${first.created}/${allFiles.length})`);
  check(JSON.stringify(json(root, '.vscode/mcp.json')) === JSON.stringify({ servers: { sws: { type: 'stdio', ...SWS } } }),
    'VS Code gets `servers`, the key it actually reads');
  const again = runAll(root);
  check(again.created + again.updated + again.merged === 0 && again.conflicts.length === 0, 'a second run changes nothing');
}

// The pilot's real .mcp.json, as 0.1.2 left it once the team added their own.
const PILOT_MCP = `{
  "mcpServers": {
    "sws": {
      "command": "npx",
      "args": [
        "-y",
        "@su-sws/synthetic-web-team-mcp"
      ]
    },
    "storyblok": {
      "type": "http",
      "url": "https://mcp.storyblok.com/mcp",
      "headersHelper": "node scripts/storyblok-mcp-headers.mjs"
    }
  }
}
`;

scenario('.mcp.json with the project\'s own servers');
{
  const root = fresh();
  record(root, { '.mcp.json': hash(`${JSON.stringify({ mcpServers: { sws: SWS } }, null, 2)}\n`) });
  put(root, '.mcp.json', PILOT_MCP);
  const r = run(root);
  check(status(r, '.mcp.json') === 'unchanged' && get(root, '.mcp.json') === PILOT_MCP,
    'our entry already there, theirs beside it: unchanged and not rewritten (was a conflict on every run)');

  const own = fresh();
  const theirs = '{\n    "mcpServers": {\n        "storyblok": { "type": "http", "url": "https://mcp.storyblok.com/mcp" }\n    }\n}\n';
  put(own, '.mcp.json', theirs);
  const m = run(own);
  const after = json(own, '.mcp.json');
  check(status(m, '.mcp.json') === 'merged' && after.mcpServers.storyblok.url === 'https://mcp.storyblok.com/mcp'
    && JSON.stringify(after.mcpServers.sws) === JSON.stringify(SWS), 'ours is added next to theirs');
  check(/\n {8}"sws"/.test(get(own, '.mcp.json')), 'their four-space indentation is kept');
  check(status(run(own), '.mcp.json') === 'unchanged', 'a second run leaves it alone');

  const { sws: _removed, ...rest } = after.mcpServers;
  put(own, '.mcp.json', `${JSON.stringify({ mcpServers: rest }, null, 4)}\n`);
  const kept = get(own, '.mcp.json');
  const r2 = run(own);
  check(status(r2, '.mcp.json') === 'unchanged' && get(own, '.mcp.json') === kept,
    'an entry they removed is not put back on the next update');
  run(own, { force: true });
  check(json(own, '.mcp.json').mcpServers.sws !== undefined, '--force puts it back');

  rmSync(join(own, '.mcp.json'));
  const r3 = run(own);
  check(status(r3, '.mcp.json') === 'unchanged' && !existsSync(join(own, '.mcp.json')),
    'a .mcp.json they deleted is not made again');
  run(own, { force: true });
  check(existsSync(join(own, '.mcp.json')), '--force makes it again');
}

scenario('.mcp.json that is not plain JSON, or that customises our entry');
{
  const root = fresh();
  const jsonc = '{\n  // our servers\n  "mcpServers": {}\n}\n';
  put(root, '.mcp.json', jsonc);
  const r = run(root);
  check(status(r, '.mcp.json') === 'conflict' && r.results.find((x) => x.path === '.mcp.json').reason === 'unparseable'
    && get(root, '.mcp.json') === jsonc, 'comments: reported, and the file is not touched');
  put(root, '.mcp.json', '{\n  "mcpServers": {}\n}\n');
  check(status(run(root), '.mcp.json') === 'merged' && json(root, '.mcp.json').mcpServers.sws !== undefined,
    'once the comments are gone, the next run adds the server (a failed merge recorded nothing)');

  const pinned = fresh();
  const text = `${JSON.stringify({ mcpServers: { sws: { command: 'npx', args: ['-y', '@su-sws/synthetic-web-team-mcp@0.1.0'] } } }, null, 2)}\n`;
  put(pinned, '.mcp.json', text);
  check(status(run(pinned), '.mcp.json') === 'conflict' && get(pinned, '.mcp.json') === text,
    'a pinned sws entry of their own is kept, with no record to say otherwise');
}

scenario('.vscode/mcp.json as earlier versions wrote it, under the key VS Code ignores');
{
  const old = `${JSON.stringify({ mcpServers: { sws: SWS } }, null, 2)}\n`;
  const root = fresh();
  record(root, { '.vscode/mcp.json': hash(old) });
  put(root, '.vscode/mcp.json', old);
  runAll(root);
  check(JSON.stringify(json(root, '.vscode/mcp.json')) === JSON.stringify({ servers: { sws: { type: 'stdio', ...SWS } } }),
    'an unedited old file takes the new shape');

  const grown = fresh();
  put(grown, '.vscode/mcp.json', `${JSON.stringify({ servers: { github: { url: 'https://api.githubcopilot.com/mcp/' } }, mcpServers: { sws: SWS } }, null, 2)}\n`);
  runAll(grown);
  const v = json(grown, '.vscode/mcp.json');
  check(v.mcpServers === undefined && v.servers.github && v.servers.sws?.type === 'stdio',
    'our old entry moves across to `servers`, and theirs stays');
}

scenario('copilot-instructions.md and codex config.toml the project already has');
{
  const root = fresh();
  const copilot = '# Review rules\n\nPrefer small pull requests.\n';
  const codex = 'model = "o4"\napproval_policy = "on-request"\n';
  put(root, '.github/copilot-instructions.md', copilot);
  put(root, '.codex/config.toml', codex);
  const r = runAll(root);
  for (const [rel, own] of [['.github/copilot-instructions.md', copilot], ['.codex/config.toml', codex]]) {
    const text = get(root, rel);
    check(status(r, rel) === 'merged' && text.startsWith(own) && count(text, 'BEGIN:sws-pointer') === 1,
      `${rel}: their content kept, our pointer added once between markers`);
  }
  check(status(runAll(root), '.codex/config.toml') === 'unchanged', 'a second run leaves them alone');

  // The whole file 0.1.x wrote, with the team's own rules added under it.
  const OLD_COPILOT = `<!-- Pointer. The contract is AGENTS.md; skills are in .claude/skills/. -->

Follow the Stanford Web Services agent contract in \`AGENTS.md\` at the repository
root, and the standards in \`standards/\`.

Non-negotiables: WCAG 2.1 AA, the Global Footer is immutable
(\`standards/fragments/global-footer.yml\`), never commit credentials.
`;
  const grown = fresh();
  const ours = '\n## Our review rules\n\nPrefer small pull requests.\n';
  put(grown, '.github/copilot-instructions.md', OLD_COPILOT + ours);
  const g = runAll(grown);
  const text = get(grown, '.github/copilot-instructions.md');
  check(status(g, '.github/copilot-instructions.md') === 'updated' && text.endsWith(ours)
    && !text.includes('.claude/skills') && count(text, 'BEGIN:sws-pointer') === 1,
    'the old pointer is replaced in place, and the rules added under it stay');
}

for (const d of scratch) rmSync(d, { recursive: true, force: true });
console.log(`\n${passes} passed`);
console.log(failures ? `${failures} failure(s)` : 'All checks passed.');
process.exit(failures ? 1 : 0);
