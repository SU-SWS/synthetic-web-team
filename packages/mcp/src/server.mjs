// The MCP server: a second entry point for agents, never a requirement.
//
// PROTOCOL VERSION, AND A DIVERGENCE FROM THE PLAN.
//
// PROJECT-PLAN.md section 7 specifies "spec 2026-07-28 (stateless,
// server/discover, Streamable HTTP plus stdio)". Checked against
// @modelcontextprotocol/sdk 1.30.0 on 2026-09-01:
//
//   LATEST_PROTOCOL_VERSION      2025-11-25
//   SUPPORTED_PROTOCOL_VERSIONS  2025-11-25, 2025-06-18, 2025-03-26,
//                                2024-11-05, 2024-10-07
//   "2026-07-28"                 appears nowhere in the SDK
//   "server/discover"            appears nowhere in the SDK
//
// So the plan named a spec that the official SDK does not implement, and
// therefore that real clients almost certainly do not speak. Building against it
// would have produced a server that works in no editor -- the opposite of this
// project's whole portability thesis. We build against the SDK's negotiated
// version instead, which is what Claude Code, Cursor and the rest are tested
// against. Revisit if and when the SDK ships 2026-07-28; the tool surface below
// does not depend on the transport.
//
// Using the SDK rather than hand-rolling JSON-RPC is also deliberate, and it is
// a real trade. It brings roughly fifteen transitive dependencies for a
// stdio-only server, and every dependency is a MinSec patching obligation this
// project takes seriously. It wins anyway because protocol correctness in real
// clients is the one thing that cannot be verified from here, and the SDK is
// what those clients are tested against. Hand-rolling becomes reasonable once
// the protocol stops moving.

import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { indexStandards, getStandard, footerHtml, check, decanterToken } from './tools.mjs';
import { scaffold } from './scaffold.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// Standards ship inside @su-sws/sws. Resolve that package, then fall back to the
// repository layout so this works from a checkout with no install.
const bundledStandards = (() => {
  try {
    const p = createRequire(import.meta.url).resolve('@su-sws/sws/package.json');
    const c = join(dirname(p), 'standards');
    if (existsSync(c)) return c;
  } catch { /* not installed */ }
  const dev = new URL('../../../standards', import.meta.url).pathname;
  return existsSync(dev) ? dev : null;
})();

export function build({ root = process.cwd(), standards = bundledStandards } = {}) {
  const server = new McpServer(
    { name: 'sws', version: pkg.version },
    {
      instructions: [
        'Stanford Web Services standards for building Stanford websites.',
        '',
        'Read the behavioral contract first: call sws_get_standard with no topic to',
        'list everything, or fetch AGENTS.md from the project if it is installed.',
        '',
        'Three rules that govern every answer you give from these tools:',
        '- Everything is advisory except committed credentials. Report findings,',
        '  explain the policy, offer a fix, and move on. Do not block or lecture.',
        '- Automated accessibility testing covers roughly 30% of issues per ODA',
        '  guidance. Never call a site accessible on the strength of a passing check.',
        '- You cannot grant an exception, approve a subdomain, sign off a launch, or',
        '  interpret Stanford policy. Name the responsible office and stop.',
      ].join('\n'),
    },
  );

  const index = indexStandards(standards);

  // ---- documents ---------------------------------------------------------

  server.registerTool('sws_get_standard', {
    title: 'Get a Stanford standard',
    description:
      'Fetch a Stanford Web Services standard: policy (MinWeb, MinSec, accessibility, ' +
      'privacy, brand, identity, procurement, escalation), patterns (Decanter, components, ' +
      'content, IA, forms, discoverability), a build recipe, or a normative fragment. ' +
      'Call with no topic to list every available topic. Accepts common synonyms such as ' +
      '"footer", "wcag", "sso", "cookies", "tokens".',
    inputSchema: { topic: z.string().optional().describe('Topic or path, e.g. "minweb", "accessibility", "footer", "astro-static". Omit to list all.') },
  }, async ({ topic }) => getStandard(index, topic));

  // Resources too, for clients that support them. Same content, addressed as
  // sws://standard/<path>. Tools are the portable surface; resources are the
  // idiomatic one, and supporting both costs almost nothing.
  for (const entry of index) {
    server.registerResource(
      entry.path, `sws://standard/${entry.path}`,
      { title: entry.path, description: `Stanford ${entry.area} standard`, mimeType: entry.path.endsWith('.md') ? 'text/markdown' : 'application/yaml' },
      async () => ({ contents: [{ uri: `sws://standard/${entry.path}`, text: readFileSync(entry.abs, 'utf8') }] }),
    );
  }

  // ---- the footer, which justifies the server on its own -----------------

  server.registerTool('sws_footer_html', {
    title: 'Stanford Global Footer markup',
    description:
      'Return correct, current Stanford Global Footer HTML, generated from the byte-exact ' +
      'contract rather than from memory. The footer is immutable: its links may not be ' +
      'altered, reordered, or added to. Use this instead of writing footer markup yourself — ' +
      'two of its ten URLs are commonly gotten wrong.',
    inputSchema: { unit: z.string().optional().describe('Unit name, only so the response can tell you where unit links actually belong. The Global Footer takes no unit content.') },
  }, async ({ unit }) => footerHtml(standards, { unit }));

  // ---- the advisory report ----------------------------------------------

  server.registerTool('sws_check', {
    title: 'Run the Stanford compliance report',
    description:
      'Run the advisory compliance checks against a project and return structured findings ' +
      'with a score out of 100. Covers the Global Footer, Identity Bar, Decanter 8, ' +
      'accessibility, SEO, MinWeb ownership, secrets, and the performance budget. ' +
      'Never fails: a check that cannot run reports "unknown" and withholds its points ' +
      'rather than passing. Build the site first, and run sws a11y and sws perf, for a ' +
      'complete result.',
    inputSchema: {
      path: z.string().optional().describe('Project directory. Defaults to the server working directory.'),
      standards: z.string().optional().describe('Standards directory, if the project does not vendor one.'),
    },
  }, async ({ path, standards: std }) => check(root, { path, standards: std }));

  // ---- Decanter tokens, read from the installed package ------------------

  server.registerTool('sws_decanter_token', {
    title: 'Resolve a Decanter token',
    description:
      'Look up Decanter design tokens by name or value, read from the CSS of the Decanter ' +
      'actually installed in the project — so the answer matches the version in use rather ' +
      'than documentation that may describe v7. Query colours ("cardinal"), spacing, type, ' +
      'breakpoints, or a hex value to find which token defines it.',
    inputSchema: {
      query: z.string().optional().describe('Token fragment or value, e.g. "cardinal", "fog", "#8C1515", "font-size".'),
      path: z.string().optional().describe('Project directory containing node_modules/decanter.'),
    },
  }, async ({ query, path }) => decanterToken(root, { query, path }));

  // ---- scaffolding, dry by default --------------------------------------

  server.registerTool('sws_scaffold', {
    title: 'Install the Stanford agent team into a project',
    description:
      'Install the behavioral contract, the role skills, and the standards into a project, ' +
      'and derive its compliance tier. DEFAULTS TO A DRY RUN: pass write=true to actually ' +
      'write files. Re-running is safe — .sws/manifest.yml and .sws/acknowledged.yml are ' +
      'project state and are preserved. Supply answers so the manifest records real values ' +
      'instead of placeholders.',
    inputSchema: {
      path: z.string().optional().describe('Target project directory. Defaults to the server working directory.'),
      write: z.boolean().optional().describe('false (default) reports the plan; true writes the files.'),
      mode: z.enum(['new', 'add']).optional().describe('"add" for an existing project.'),
      editors: z.array(z.string()).optional().describe('Editor ids, e.g. ["claude-code","cursor"]. Omit to auto-detect.'),
      answers: z.object({
        siteName: z.string().optional(), unit: z.string().optional(),
        purpose: z.string().optional(), url: z.string().optional(),
        recipe: z.string().optional(),
        businessOwnerName: z.string().optional(), businessOwnerEmail: z.string().optional(),
        techAdminName: z.string().optional(), techAdminEmail: z.string().optional(),
        collectsPersonalData: z.boolean().optional(), authenticates: z.boolean().optional(),
        payments: z.boolean().optional(), regulated: z.boolean().optional(),
      }).optional().describe('Project facts. The four booleans derive the compliance tier. Ask the user for owner names and emails; never invent them.'),
    },
  }, async (args) => scaffold(root, args));

  return { server, index, contentRoot: standards };
}
