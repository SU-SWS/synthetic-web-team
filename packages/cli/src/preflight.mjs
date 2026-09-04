// System preflight: is the machine equipped to build and deploy this project?
//
// Reads standards/stack/requirements.yml and runs each tool's detect command.
// Deliberately does NOT know how to install anything -- see the header of that
// file for why. The contract with the agent is: check, install however you
// like, check again.
//
// Design, matching the rest of this CLI:
//   - A tool that cannot be probed is `unknown`, never `pass`.
//   - Exits 0 unless --strict, because nothing here blocks by default.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

const SEMVER = /(\d+)\.(\d+)(?:\.(\d+))?/;

const parse = (s) => {
  const m = SEMVER.exec(s || '');
  return m ? [+m[1], +m[2], +(m[3] ?? 0)] : null;
};

const lt = (a, b) => {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
};

// Run a detect command without a shell, so a manifest entry cannot become
// shell injection. Splitting on whitespace is enough: every detect command in
// requirements.yml is a plain `binary --flag`.
function probe(cmd) {
  const [bin, ...args] = String(cmd).trim().split(/\s+/);
  try {
    const out = execFileSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20000,
    });
    return { ok: true, out: (out || '').trim() };
  } catch (e) {
    // ENOENT means not installed. A non-zero exit means present but unhappy,
    // which is a different problem and worth saying differently.
    const missing = e?.code === 'ENOENT';
    return {
      ok: false,
      missing,
      out: [e?.stdout, e?.stderr].filter(Boolean).join('\n').trim(),
      err: e?.message || String(e),
    };
  }
}

function whichPackageManager(root) {
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  return 'npm';
}

function applies(tool, ctx) {
  if (tool.required === 'always') return true;
  if (!tool.required_when) return false;
  // The only condition shape in the manifest today.
  const m = /^hosting\.provider\s*==\s*(\S+)$/.exec(tool.required_when.trim());
  if (m) return ctx.provider === m[1];
  return false;
}

export function loadRequirements(standardsDir) {
  const p = join(standardsDir, 'stack', 'requirements.yml');
  if (!existsSync(p)) return null;
  return YAML.parse(readFileSync(p, 'utf8'));
}

export function preflight({ standardsDir, root = process.cwd(), manifest = {} }) {
  const req = loadRequirements(standardsDir);
  if (!req) {
    return {
      results: [],
      error: `No requirements.yml under ${standardsDir}/stack/. Point --standards at the standards directory.`,
    };
  }

  const provider = manifest?.hosting?.provider ?? null;
  const pm = whichPackageManager(root);
  const ctx = { provider };
  const results = [];

  for (const tool of req.tools ?? []) {
    // npm vs yarn: report the one the project actually uses, and never nag
    // about converting. A yarn project does not need npm checked.
    if (tool.id === 'npm' && pm !== 'npm') {
      results.push({
        id: tool.id,
        name: `${pm} (this project's package manager)`,
        state: 'skip',
        detail: `${pm}.lock present, so ${pm} is the requirement here, not npm. Never convert a project.`,
        required: true,
      });
      continue;
    }

    const needed = applies(tool, ctx);
    if (!needed) {
      results.push({
        id: tool.id,
        name: tool.name,
        state: 'not_applicable',
        detail: tool.required_when
          ? `only needed when ${tool.required_when}` +
            (provider ? ` (this project: ${provider})` : ' (no hosting.provider recorded yet)')
          : 'not required for this project',
        required: false,
      });
      continue;
    }

    const r = probe(tool.detect);
    const entry = {
      id: tool.id,
      name: tool.name,
      required: !tool.optional,
      why: tool.why,
      blocks: tool.blocks,
      detect: tool.detect,
    };

    if (!r.ok) {
      results.push({
        ...entry,
        state: r.missing ? 'missing' : 'unknown',
        detail: r.missing
          ? `not installed (\`${tool.detect}\` not found)`
          : `installed but \`${tool.detect}\` failed: ${(r.out || r.err).split('\n')[0]}`,
      });
      continue;
    }

    const found = parse(r.out);
    const floor = tool.version_min ? parse(tool.version_min) : null;
    if (floor && found && lt(found, floor)) {
      results.push({
        ...entry,
        state: 'too_old',
        found: found.join('.'),
        detail: `found ${found.join('.')}, needs >= ${tool.version_min}`,
      });
      continue;
    }

    results.push({
      ...entry,
      state: 'pass',
      found: found ? found.join('.') : r.out.split('\n')[0],
      detail: found ? found.join('.') : r.out.split('\n')[0],
    });

    // Secondary probe, e.g. gh installed vs gh authenticated. Reported
    // separately because they are different failures with different fixes.
    if (tool.also_check?.detect) {
      const a = probe(tool.also_check.detect);
      results.push({
        id: `${tool.id}.auth`,
        name: `${tool.name}: ${tool.also_check.what || 'secondary check'}`,
        required: !tool.optional,
        detect: tool.also_check.detect,
        state: a.ok ? 'pass' : 'missing',
        detail: a.ok
          ? 'authenticated'
          : `\`${tool.also_check.detect}\` failed. ${tool.also_check.note ? tool.also_check.note.split('\n')[0] : ''}`.trim(),
      });
    }
  }

  return { results, notRequired: req.not_required ?? [], packageManager: pm, provider };
}

export function summarise(results) {
  const blocking = results.filter((r) => r.required && ['missing', 'too_old'].includes(r.state));
  const unknown = results.filter((r) => r.state === 'unknown');
  const optional = results.filter((r) => !r.required && ['missing', 'too_old'].includes(r.state));
  return { blocking, unknown, optional, ready: blocking.length === 0 };
}
