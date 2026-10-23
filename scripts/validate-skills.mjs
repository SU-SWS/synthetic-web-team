#!/usr/bin/env node
// Enforce the portability constraints on every skill. These are not style
// preferences: each one is a real limit in at least one target editor.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { contract } from '../packages/wizard/src/emit.mjs';

const SOURCE = 'skills';
const MAX_BODY_WORDS = 2000;   // Anthropic guidance: 1500-2000, hard ceiling ~5k
const MIN_DESC_CHARS = 60;     // a thin description will not trigger reliably
const AGENTS_MAX_LINES = 150;  // community consensus for real effect
const AGENTS_MAX_BYTES = 32768; // Codex truncates project docs at 32 KiB

let failures = 0;
const fail = (msg) => { console.log(`FAIL  ${msg}`); failures++; };

// --- skills -----------------------------------------------------------------
const dirs = readdirSync(SOURCE).filter((d) =>
  existsSync(join(SOURCE, d, 'SKILL.md'))
);

const rows = [];
for (const dir of dirs.sort()) {
  const p = join(SOURCE, dir, 'SKILL.md');
  const raw = readFileSync(p, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { fail(`${p}: no YAML frontmatter`); continue; }

  // Deliberately a minimal parser: only two keys are portable, so anything
  // more complex than "key: value" is itself the problem.
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
    else if (/^\s+\S/.test(line) && Object.keys(fm).length) {
      const last = Object.keys(fm).pop();
      fm[last] += ' ' + line.trim();
    }
  }

  const body = m[2];
  const words = body.split(/\s+/).filter(Boolean).length;
  const keys = Object.keys(fm).sort();

  if (keys.join(',') !== 'description,name') {
    fail(`${dir}: frontmatter keys are [${keys}], must be exactly [description, name]. Anything else is not portable across editors.`);
  }
  if (fm.name !== dir) fail(`${dir}: name "${fm.name}" does not match directory`);
  if (words > MAX_BODY_WORDS) fail(`${dir}: body ${words} words exceeds ${MAX_BODY_WORDS}`);
  if ((fm.description || '').length < MIN_DESC_CHARS) {
    fail(`${dir}: description too thin (${(fm.description || '').length} chars) to trigger reliably`);
  }
  rows.push({ dir, words, desc: (fm.description || '').length });
}

console.log(`${'skill'.padEnd(30)}${'words'.padStart(7)}${'desc'.padStart(6)}`);
console.log('-'.repeat(43));
for (const r of rows) {
  console.log(`${r.dir.padEnd(30)}${String(r.words).padStart(7)}${String(r.desc).padStart(6)}`);
}

// --- AGENTS.md --------------------------------------------------------------
//
// The line budget is for the contract AS IT SHIPS: the block between the
// markers, which is what lands in a project next to its own rules. The rest of
// this repository's AGENTS.md is about the package and stays here. The byte cap
// is checked on both, because Codex truncates whichever file it is reading.
const a = readFileSync('AGENTS.md', 'utf8');
const block = contract('.');
const lines = block.split('\n').length;
const bytes = Buffer.byteLength(block);
if (lines > AGENTS_MAX_LINES) fail(`AGENTS.md contract block ${lines} lines exceeds ${AGENTS_MAX_LINES}`);
for (const [what, n] of [['contract block', bytes], ['file', Buffer.byteLength(a)]]) {
  if (n > AGENTS_MAX_BYTES) fail(`AGENTS.md ${what} ${n} bytes exceeds Codex's ${AGENTS_MAX_BYTES} cap`);
}

// --- referenced paths resolve ----------------------------------------------
//
// Skills cite `standards/<path>`; the contract cites `.sws/standards/<path>`,
// which is where a project keeps them. Both resolve against standards/ here.
const refs = new Set();
for (const f of [...dirs.map((d) => join(SOURCE, d, 'SKILL.md')), 'AGENTS.md']) {
  for (const mm of readFileSync(f, 'utf8').matchAll(/`(?:\.sws\/)?(standards\/[^`<]+?)`/g)) {
    refs.add(mm[1].replace(/\/$/, ''));
  }
}
for (const r of [...refs].sort()) {
  if (!existsSync(r)) fail(`referenced path does not exist: ${r}`);
}

console.log(`\nAGENTS.md contract block: ${lines} lines, ${bytes} bytes`);
console.log(`${rows.length} skills, ${refs.size} referenced standards paths`);
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
