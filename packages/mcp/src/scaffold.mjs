// sws_scaffold: drives the wizard programmatically.
//
// WHY IT DEFAULTS TO A DRY RUN. This is the only tool here that writes to disk,
// and it writes about 83 files. A model that calls it speculatively while
// exploring should get a plan back, not a modified project. So `write` is opt-in
// and the description says so.
//
// It shells out to the create-web-team binary for the same reason sws_check
// shells out to the CLI: one implementation, so the MCP path and the terminal
// path cannot diverge. The wizard is already agent-shaped -- non-interactive off
// a TTY, `--json`, `--answers`, and it preserves project state on a re-run.

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ok = (text) => ({ content: [{ type: 'text', text }] });
const problem = (text) => ({ content: [{ type: 'text', text }], isError: true });

function wizardPath() {
  try {
    return createRequire(import.meta.url).resolve('@su-sws/create-web-team/bin/create-web-team.mjs');
  } catch {
    const guess = new URL('../../create-web-team/bin/create-web-team.mjs', import.meta.url).pathname;
    return existsSync(guess) ? guess : null;
  }
}

export function scaffold(defaultRoot, { path, answers, editors, write = false, mode = 'new' } = {}) {
  const bin = wizardPath();
  if (!bin) return problem('Could not locate the wizard. Install @su-sws/create-web-team.');

  const root = path || defaultRoot;
  if (!existsSync(root)) return problem(`Path does not exist: ${root}`);

  // The wizard reads positionals as [mode, dir], so the mode must ALWAYS be
  // present. Passing only the directory made it the mode -- which fell through
  // to 'new' -- and left the directory undefined, so it planned against the
  // server's working directory instead of the target. Caught by a dry run that
  // reported the wrong path.
  const args = [bin, mode === 'add' ? 'add' : 'new', root, '--json'];
  if (!write) args.push('--dry-run');
  if (editors) args.push('--editors', Array.isArray(editors) ? editors.join(',') : String(editors));
  if (answers) args.push('--answers', typeof answers === 'string' ? answers : JSON.stringify(answers));

  let out;
  try {
    out = execFileSync('node', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (err) {
    // Exit 2 is bad input and still prints JSON on stdout, so prefer that to the
    // exception message.
    out = (err.stdout || '').toString();
    if (!out.trim()) {
      return problem(`Wizard failed: ${(err.stderr || err.message || '').toString().slice(0, 600)}`);
    }
  }

  let r;
  try { r = JSON.parse(out); }
  catch { return problem(`Wizard returned output that is not JSON:\n${out.slice(0, 600)}`); }

  if (!r.ok) {
    return problem(`Wizard rejected the request: ${r.error}${r.detail ? `\n${r.detail}` : ''}`);
  }

  const c = r.counts;
  const head = r.written
    ? (c.created === 0 && c.updated === 0
      ? `Already installed in ${r.root}. ${c.unchanged + (c.preserved ?? 0)} files, nothing to change.`
      : `Installed into ${r.root}. ${c.created} created, ${c.updated} updated, ${c.unchanged} unchanged` +
        (c.preserved ? `, ${c.preserved} preserved` : '') + '.')
    : `DRY RUN. Nothing was written. ${c.files} files would be installed into ${r.root}.`;

  const parts = [head, ''];

  parts.push(`Compliance tier: **${r.tier.tier}** — ${r.tier.because}`);
  if (r.tier.tier !== 'low') {
    parts.push(`This is above a basic static site. A Data Risk Assessment may be required`,
      `before deploy. See standards/policy/privacy.md and route via`,
      `standards/policy/escalation.md.`);
  }
  parts.push('');

  if (r.incomplete?.length) {
    parts.push(`## Placeholders, not answers`,
      `These fields in .sws/manifest.yml are unfilled:`,
      ...r.incomplete.map((f) => `- ${f}`),
      ``,
      `**Ask the user for these. Do not invent them.** MinWeb requires a named`,
      `business owner and technical administrator, both with valid Stanford email.`,
      `Re-run with \`answers\` to record them; the manifest is preserved on re-runs,`,
      `so editing it directly is also fine.`,
      ``);
  }

  parts.push(`## Next`, ...r.next.map((n) =>
    `- **${n.kind}**${n.path ? ` \`${n.path}\`` : ''}${n.command ? ` \`${n.command}\`` : ''}` +
    `${n.skill ? ` skill \`${n.skill}\`` : ''}\n    ${n.why}`));

  if (!r.written) {
    parts.push('', `To apply this, call again with \`write: true\`.`);
  }
  return ok(parts.join('\n'));
}
