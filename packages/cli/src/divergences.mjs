// Divergences that cover checks.
//
// A divergence in .sws/manifest.yml records a deliberate departure from the
// recipe. Naming the checks it explains, in `checks:`, moves those findings out
// of the nag and into a "Divergences" section of the report, with the reason
// beside them. Without that, a choice made on purpose and written down still
// read as "Should fix" on every run, and the only way to quiet it was an
// accepted risk with a review date, which says "fix later" about something that
// will never change.
//
// A divergence covers a preference, never a requirement. Checks whose criterion
// carries a policy (accessibility, brand, MinWeb, MinSec, MinPriv) are what the
// sws-diverge skill calls "what never bends": a person can still decline one,
// in .sws/acknowledged.yml, where it stays an accepted risk with a review date.
// So an entry naming one is ignored, and the report says so.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

/** Policies a divergence may cover: SWS's own conventions, and unclassified criteria. */
const PREFERENCE = new Set(['patterns', null, undefined]);

/** The manifest's divergences that name at least one check, with `checks` as an array. */
export function loadDivergences(root) {
  const p = join(root, '.sws', 'manifest.yml');
  if (!existsSync(p)) return [];
  let m;
  try { m = YAML.parse(readFileSync(p, 'utf8')) || {}; } catch { return []; }
  const divs = Array.isArray(m.divergences) ? m.divergences : [];
  return divs
    .map((d) => ({ ...d, checks: [].concat(d?.checks ?? []).filter((c) => typeof c === 'string') }))
    .filter((d) => d.checks.length);
}

/**
 * Applies the divergences that name a failing finding.
 *
 * Returns null when none names it or the finding is not a failure. Otherwise
 * `{ state, detail, ignored }`: `diverged` with the reason when an entry covers
 * it, or the finding's own state with a note when every entry naming it was
 * ignored because the check is a requirement.
 */
export function applyDivergences(finding, divergences, { blocking, policy }) {
  if (finding.state !== 'fail') return null;
  const entries = divergences.filter((d) => d.checks.includes(finding.id));
  if (!entries.length) return null;

  if (blocking || !PREFERENCE.has(policy)) {
    const why = blocking ? 'it is the blocking check' : `it is a ${policy} requirement`;
    return {
      state: finding.state,
      detail: `${finding.detail}  (divergence ignored: ${why}, so a divergence cannot cover it; ` +
        'accept the risk in .sws/acknowledged.yml instead)',
      ignored: entries,
    };
  }

  const reasons = [...new Set(entries.map((d) => d.reason).filter(Boolean))];
  const what = [...new Set(entries.map((d) => d.changed).filter(Boolean))];
  const note = reasons.length === 1 ? `: ${String(reasons[0]).trim().replace(/\s+/g, ' ')}` : '';
  const label = what.length === 1 ? String(what[0]).trim().replace(/\s+/g, ' ') : 'recorded in .sws/manifest.yml';
  return {
    state: 'diverged',
    detail: `${finding.detail}  (divergence: ${label}${note})`,
    ignored: [],
  };
}
