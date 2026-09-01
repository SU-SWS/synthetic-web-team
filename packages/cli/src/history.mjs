// Score history, which is what makes the number a trend rather than a reading.
//
// THE STORAGE PROBLEM, and why there are two answers.
//
// A trend needs prior state, and this project deliberately has no database, no
// service, and nothing committed that a build regenerates. Four options were
// considered:
//
//   committed file    commit noise on every build, merge conflicts on every PR
//   Actions artifact  expires (90 days default), so the trend silently dies
//   Actions cache     evictable, so the trend is unreliable rather than absent
//   the issue body    needs a marker convention, and nothing else
//
// So: the shared history lives in the body of the persistent "Site health"
// issue, in a fenced JSON block. It costs no new storage, survives
// indefinitely, is human-readable, and reuses the mechanism section 9 of the
// plan already chose for "the report finds the reader."
//
// Separately, `sws doctor` shows a local "delta since last run". That is a
// per-developer convenience, not shared state, so it lives in a gitignored file
// and is never reconciled with the shared history. Conflating the two would put
// one person's local runs into the project's trend.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeResults } from './browser.mjs';

export const LOCAL_PATH = join('.sws', 'score-history.json');

// Enough to see a direction without turning the issue body into a database.
const LOCAL_CAP = 30;
const SHARED_CAP = 50;

const MARKER_START = '<!-- sws:history';
const MARKER_END = 'sws:history -->';

// --- local, for `sws doctor` -------------------------------------------------

export function readLocal(root) {
  const p = join(root, LOCAL_PATH);
  if (!existsSync(p)) return [];
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return Array.isArray(j?.entries) ? j.entries : [];
  } catch {
    // A corrupt history is not worth a warning, let alone a failure. It is a
    // convenience file; start again.
    return [];
  }
}

export function appendLocal(root, entry) {
  const entries = [...readLocal(root), entry].slice(-LOCAL_CAP);
  writeResults(root, LOCAL_PATH, {
    note: 'Local only, gitignored. `sws doctor` reads this for the delta since your last run. The project trend lives in the Site health issue.',
    entries,
  });
  return entries;
}

// --- shared, embedded in the Site health issue body -------------------------

/** Pull the history out of an issue body. Returns [] for a body without one. */
export function parseFromBody(body) {
  if (!body) return [];
  const i = body.indexOf(MARKER_START);
  const j = body.indexOf(MARKER_END, i);
  if (i === -1 || j === -1) return [];
  const block = body.slice(i + MARKER_START.length, j);
  try {
    const j2 = JSON.parse(block.replace(/```/g, '').trim());
    return Array.isArray(j2) ? j2 : [];
  } catch {
    return [];
  }
}

/**
 * Append to the issue's history and return the block to embed. Kept as an HTML
 * comment so it is invisible in the rendered issue: the body is something a
 * person reads, and a wall of JSON in it would defeat the purpose.
 */
export function embedInBody(history) {
  const trimmed = history.slice(-SHARED_CAP);
  return `${MARKER_START}\n${JSON.stringify(trimmed)}\n${MARKER_END}`;
}

// --- the bit everyone actually reads ----------------------------------------

/**
 * "94, up from 91". Returns null when there is nothing to compare against,
 * because "94, up from nothing" is worse than saying only 94.
 */
export function trend(current, history) {
  const prior = history.filter((h) => typeof h?.score === 'number');
  if (!prior.length) return null;
  const previous = prior[prior.length - 1];
  const delta = current - previous.score;
  const when = previous.sha ? ` (${String(previous.sha).slice(0, 7)})` : '';

  if (delta === 0) return { delta, text: `unchanged from ${previous.score}${when}` };
  return {
    delta,
    text: delta > 0
      ? `up from ${previous.score}${when}`
      : `down from ${previous.score}${when}`,
  };
}

/** A tiny sparkline, for the issue body. Cheap and surprisingly readable. */
export function sparkline(history) {
  const vals = history.map((h) => h?.score).filter((v) => typeof v === 'number');
  if (vals.length < 2) return null;
  const blocks = '▁▂▃▄▅▆▇█';
  // Fixed 0-100 domain, not min/max: a normalised sparkline makes a wobble
  // between 98 and 100 look like a cliff, which is exactly the false alarm this
  // project keeps trying to avoid.
  return vals.slice(-24)
    .map((v) => blocks[Math.min(blocks.length - 1, Math.floor((Math.max(0, v) / 100) * blocks.length))])
    .join('');
}

export function entryFor({ score, findings, sha, ref, runId }) {
  return {
    at: new Date().toISOString(),
    score,
    sha: sha ?? null,
    ref: ref ?? null,
    runId: runId ?? null,
    counts: {
      pass: findings.filter((f) => f.state === 'pass').length,
      fail: findings.filter((f) => f.state === 'fail').length,
      unknown: findings.filter((f) => f.state === 'unknown').length,
      acknowledged: findings.filter((f) => f.state === 'acknowledged').length,
    },
  };
}
