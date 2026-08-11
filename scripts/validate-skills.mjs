#!/usr/bin/env node
// Enforce the portability constraints on every skill. These are not style
// preferences: each one is a real limit in at least one target editor.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

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
const a = readFileSync('AGENTS.md', 'utf8');
const lines = a.split('\n').length;
const bytes = Buffer.byteLength(a);
if (lines > AGENTS_MAX_LINES) fail(`AGENTS.md ${lines} lines exceeds ${AGENTS_MAX_LINES}`);
if (bytes > AGENTS_MAX_BYTES) fail(`AGENTS.md ${bytes} bytes exceeds Codex's ${AGENTS_MAX_BYTES} cap`);

// --- referenced paths resolve ----------------------------------------------
const refs = new Set();
for (const f of [...dirs.map((d) => join(SOURCE, d, 'SKILL.md')), 'AGENTS.md']) {
  for (const mm of readFileSync(f, 'utf8').matchAll(/`(standards\/[^`<]+?)`/g)) {
    refs.add(mm[1].replace(/\/$/, ''));
  }
}
for (const r of [...refs].sort()) {
  if (!existsSync(r)) fail(`referenced path does not exist: ${r}`);
}

console.log(`\nAGENTS.md: ${lines} lines, ${bytes} bytes`);
console.log(`${rows.length} skills, ${refs.size} referenced standards paths`);
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
