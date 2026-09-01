// Publishing the report where a reader will actually see it.
//
// Two destinations, chosen by how the change arrived, because pull requests are
// first-class here but never required:
//
//   push to main   one long-lived "Site health" issue, UPDATED IN PLACE
//   pull request   one collapsible comment, UPDATED IN PLACE
//
// "In place" is the whole design. A new comment per push turns a PR into a wall
// of bot noise that people mute, and a new issue per push is worse. Both are
// found by an `<!-- sws:... -->` marker, so a human can edit around them.
//
// NOTHING HERE MAY FAIL THE BUILD. Every function resolves to a result object
// describing what happened. A network blip must not turn an advisory report
// into a red build, because that is the fastest way to get the tool removed.
//
// No SDK, no dependency: Node's global fetch against the REST API.

import { readFileSync } from 'node:fs';

// Read at call time, not module load. Two reasons: GitHub Enterprise sets
// GITHUB_API_URL and a module-load read can happen before the caller sets it,
// and a load-time constant makes this module untestable against a stand-in.
const apiBase = () => process.env.GITHUB_API_URL || 'https://api.github.com';

export const PR_MARKER = '<!-- sws:report:pr -->';
export const ISSUE_MARKER = '<!-- sws:report:health -->';
export const ISSUE_TITLE = 'Site health';

/** What CI are we in, if any? Returns null outside Actions. */
export function context(env = process.env) {
  if (!env.GITHUB_REPOSITORY) return null;
  const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
  const token = env.GITHUB_TOKEN || env.GH_TOKEN || env.INPUT_GITHUB_TOKEN || null;

  // A PR number is only reliably available from the event payload.
  let pr = null;
  if (env.GITHUB_EVENT_NAME?.startsWith('pull_request') && env.GITHUB_EVENT_PATH) {
    try {
      const ev = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
      pr = ev?.pull_request?.number ?? ev?.number ?? null;
    } catch { /* fall through: no PR number, so no comment */ }
  }

  return {
    owner, repo, token, pr,
    event: env.GITHUB_EVENT_NAME ?? null,
    sha: env.GITHUB_SHA ?? null,
    ref: env.GITHUB_REF_NAME ?? env.GITHUB_REF ?? null,
    runId: env.GITHUB_RUN_ID ?? null,
    serverUrl: env.GITHUB_SERVER_URL || 'https://github.com',
    get runUrl() {
      return this.runId ? `${this.serverUrl}/${this.owner}/${this.repo}/actions/runs/${this.runId}` : null;
    },
  };
}

async function api(ctx, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${ctx.token}`,
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // 403 here is almost always a missing permission in the workflow, which is
    // worth naming rather than reporting as a generic failure.
    const hint = res.status === 403
      ? ' (check the workflow has `issues: write` and `pull-requests: write`)'
      : '';
    throw new Error(`${method} ${path} -> ${res.status}${hint} ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Upsert the PR comment. Resolves to { action, url } or { skipped } / { error }. */
export async function upsertPrComment(ctx, body) {
  if (!ctx?.token) return { skipped: 'no GITHUB_TOKEN' };
  if (!ctx.pr) return { skipped: 'not a pull request' };
  try {
    const comments = await api(ctx, `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.pr}/comments?per_page=100`);
    const mine = comments.find((c) => typeof c.body === 'string' && c.body.includes(PR_MARKER));
    const payload = { body: `${PR_MARKER}\n${body}` };
    const r = mine
      ? await api(ctx, `/repos/${ctx.owner}/${ctx.repo}/issues/comments/${mine.id}`, { method: 'PATCH', body: payload })
      : await api(ctx, `/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.pr}/comments`, { method: 'POST', body: payload });
    return { action: mine ? 'updated' : 'created', url: r.html_url };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Find the persistent Site health issue, if it exists. Separated from the
 * upsert so the caller can read its embedded history BEFORE composing the body
 * it is about to write.
 */
export async function findHealthIssue(ctx) {
  if (!ctx?.token) return { skipped: 'no GITHUB_TOKEN' };
  try {
    // List rather than use the search API. Search is eventually consistent, so
    // a just-created issue can be missing from results for a short window --
    // which for an upsert means creating a second one. Listing open issues
    // reads current state. (Reasoned, not observed: this code has never run
    // against a repo with an existing issue.)
    const issues = await api(ctx, `/repos/${ctx.owner}/${ctx.repo}/issues?state=open&per_page=100`);
    const found = issues.find((i) => !i.pull_request && typeof i.body === 'string' && i.body.includes(ISSUE_MARKER));
    return { issue: found ?? null };
  } catch (err) {
    return { error: err.message };
  }
}

/** Upsert the Site health issue in place. */
export async function upsertHealthIssue(ctx, body, existing) {
  if (!ctx?.token) return { skipped: 'no GITHUB_TOKEN' };
  try {
    const payload = { title: ISSUE_TITLE, body: `${ISSUE_MARKER}\n${body}` };
    const r = existing
      ? await api(ctx, `/repos/${ctx.owner}/${ctx.repo}/issues/${existing.number}`, { method: 'PATCH', body: payload })
      : await api(ctx, `/repos/${ctx.owner}/${ctx.repo}/issues`, { method: 'POST', body: payload });
    return { action: existing ? 'updated' : 'created', url: r.html_url, number: r.number };
  } catch (err) {
    return { error: err.message };
  }
}
