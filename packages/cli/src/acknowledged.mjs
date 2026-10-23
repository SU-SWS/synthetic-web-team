// Accepted risks, from .sws/acknowledged.yml, and what each one covers.
//
// AN ACKNOWLEDGEMENT COVERS WHAT IT NAMES, NOT THE WHOLE CHECK. This used to
// match on the check id alone and ignore `path`, though the template showed
// one. For minweb.no-secrets, the one blocking check, that meant accepting a
// single false positive in a vendored README also hid every real credential
// committed afterwards, anywhere in the repository. Found on a pilot, where the
// team noticed the risk and rewrote their fixtures instead.
//
// So a finding that reports `locations` (today, minweb.no-secrets) is accepted
// only location by location:
//
//   path    required for a blocking check. An exact file, a directory ending in
//           `/`, or a glob (`*` within a segment, `**` across segments). A path
//           that matches everything, such as `**`, `**/*` or `**/*.*`, counts
//           as no path: it would bring back the check-wide acceptance this
//           exists to stop.
//   line    optional. Narrows the entry to that line, so an edit that moves the
//           match brings it back for a fresh look.
//   sha256  optional. Narrows the entry to one matched value, by the full
//           SHA-256 of that value. `sws digest <path>:<line>` prints it,
//           locally. It is never printed in a report: a hash of a human-chosen
//           password lets anyone holding the report check guesses offline.
//
// NOT `value`. An entry that names the matched text is ignored, loudly. The
// text would be copied into this tracked file, where a value found by the
// generic pattern no longer matches anything, so once it left its own file the
// only copy left would sit here unreported.
//
// Narrowing is only ever for a false positive. A real credential is rotated,
// not accepted.
//
// Any location no entry covers keeps the finding failing. A finding with no
// locations is accepted by check id as before, except that a blocking one
// never is: there is nothing to scope the acceptance to.

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import YAML from 'yaml';

export const ACKNOWLEDGED_PATH = join('.sws', 'acknowledged.yml');

export function loadAcknowledged(root) {
  const p = join(root, ACKNOWLEDGED_PATH);
  if (!existsSync(p)) return [];
  try {
    const y = YAML.parse(readFileSync(p, 'utf8'));
    return Array.isArray(y) ? y : (y?.accepted ?? []);
  } catch { return []; }
}

// The full hash of a matched value, for comparing against an entry in this
// process. Never serialised: the CLI strips it from every location before a
// report is rendered.
export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

// A path that names nothing: empty once its wildcards are taken away, or one
// that matches file names nobody would ever choose, which is how `**/*.*` and
// `*.*` give themselves away. A scoped pattern (`**/*.js`, `vendor/**`,
// `**/README.md`, `src/`) matches neither probe.
const PROBES = ['sws-probe.q7x', 'sws-probe-a/sws-probe-b/sws-probe.q7x'];
const namesNothing = (p) => !String(p ?? '').replace(/^\.\//, '').replace(/[*?/]/g, '')
  || PROBES.some((probe) => pathMatches(p, probe));

// `path:line looks like a <label>`, for up to `max` locations.
export function describeLocations(locations, max = 5) {
  const shown = locations.slice(0, max).map((l) =>
    `${l.path}${l.line ? `:${l.line}` : ''}${l.label ? ` looks like a ${l.label}` : ''}`);
  const more = locations.length - shown.length;
  return shown.join('; ') + (more > 0 ? `; and ${more} more` : '');
}

// `**/` is any number of directories, including none; any other `**` is
// anything at all, so `test/**.json` covers `test/a.json` and `test/b/c.json`,
// and `vendor/**` everything under vendor/. `*` and `?` stay within one segment.
export function pathMatches(pattern, path) {
  let p = String(pattern).replace(/^\.\//, '');
  if (p.endsWith('/')) {
    if (!/[*?]/.test(p)) return path.startsWith(p);
    p += '**';
  }
  if (!/[*?]/.test(p)) return path === p;
  const re = p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*');
  return new RegExp(`^${re}$`).test(path);
}

function covers(entry, loc) {
  if (!pathMatches(entry.path, loc.path)) return false;
  if (entry.line != null && Number(entry.line) !== loc.line) return false;
  if (entry.sha256 != null && String(entry.sha256).toLowerCase() !== loc.sha256) return false;
  return true;
}

function acceptedBy(entries, now) {
  const by = [...new Set(entries.map((a) => a.accepted_by ?? 'unknown'))].join(', ');
  const reasons = [...new Set(entries.map((a) => a.reason).filter(Boolean))];
  let note = `accepted by ${by}${reasons.length === 1 ? `: ${reasons[0]}` : ''}`;
  const overdue = entries.map((a) => a.review_by).filter((d) => d && new Date(d) < now).sort();
  if (overdue.length) note += `  [review overdue since ${overdue[0]}]`;
  return note;
}

/**
 * Apply the entries for one check to its finding.
 *
 * Returns the finding's new `state` and `detail`, plus `ignored`: entries that
 * were not applied because a blocking check was accepted with no path. Those
 * are said out loud in the detail, never dropped quietly, because someone
 * wrote them believing they worked.
 */
export function applyAcknowledgements(finding, entries, { blocking = false, now = new Date() } = {}) {
  const everywhere = blocking ? entries.filter((a) => namesNothing(a.path)) : [];
  const byValue = entries.filter((a) => a.value != null && !everywhere.includes(a));
  const ignored = [...everywhere, ...byValue];
  const usable = entries.filter((a) => !ignored.includes(a));
  const n = (k) => `${k} acknowledgement${k > 1 ? 's' : ''} ignored`;
  const warn = [
    everywhere.length && `  (${n(everywhere.length)}: an entry for ${finding.id} must name a file or directory, not every path, because accepting a blocking check everywhere would hide the next real one)`,
    byValue.length && `  (${n(byValue.length)}: \`value:\` would copy the matched text into ${ACKNOWLEDGED_PATH}; narrow by \`sha256:\` from \`sws digest <path>:<line>\` instead)`,
  ].filter(Boolean).join('');

  if (finding.state !== 'fail' || !usable.length) {
    return { state: finding.state, detail: finding.detail + warn, ignored };
  }

  const locations = finding.locations ?? [];
  if (!locations.length) {
    // Nothing to scope to. A non-blocking finding is accepted by id, as it always
    // was; a blocking one stays a failure.
    if (blocking) return { state: 'fail', detail: finding.detail + warn, ignored };
    return { state: 'acknowledged', detail: `${finding.detail}  (${acceptedBy(usable, now)})${warn}`, ignored };
  }

  const used = new Set();
  const open = locations.filter((loc) => {
    // A non-blocking entry without a path still covers the whole check.
    const hit = usable.find((a) => (!a.path && !blocking) || (a.path && covers(a, loc)));
    if (hit) used.add(hit);
    return !hit;
  });

  if (!open.length) {
    return { state: 'acknowledged', detail: `${finding.detail}  (${acceptedBy([...used], now)})${warn}`, ignored };
  }
  const accepted = locations.length - open.length;
  return {
    state: 'fail',
    detail: describeLocations(open) + (accepted ? `  (${accepted} other match${accepted > 1 ? 'es' : ''} accepted in ${ACKNOWLEDGED_PATH})` : '') + warn,
    locations: open,
    ignored,
  };
}
