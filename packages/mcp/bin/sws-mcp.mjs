#!/usr/bin/env node
// stdio entry point. stdio is the transport every MCP client supports, and this
// server is stateless per call, so nothing here needs a session.
//
// NOTHING MAY BE WRITTEN TO STDOUT except protocol frames. stdout IS the
// transport: a stray console.log corrupts the stream and the client reports a
// parse error with no clue where it came from. All diagnostics go to stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { build } from '../src/server.mjs';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };

if (args.includes('--help') || args.includes('-h')) {
  console.error(`
  sws-mcp — Stanford Web Services MCP server (stdio)

  --root <dir>       Default project directory for sws_check and sws_scaffold.
                     Defaults to the working directory.
  --standards <dir>  Standards directory. Defaults to the copy bundled in @su-sws/sws.

  Add to an MCP client config:

    { "mcpServers": { "sws": { "command": "npx",
        "args": ["-y", "@su-sws/mcp"] } } }

  Tools: sws_get_standard, sws_footer_html, sws_check, sws_decanter_token,
         sws_scaffold.
`);
  process.exit(0);
}

const { server, index, contentRoot } = build({
  root: flag('--root') ?? process.cwd(),
  standards: flag('--standards') ?? undefined,
});

if (!index.length) {
  console.error('sws-mcp: warning — no standards found, so sws_get_standard and');
  console.error('sws_footer_html will report an error. Pass --standards <dir>, or');
  console.error('install @su-sws/sws.');
} else {
  console.error(`sws-mcp: ${index.length} standards indexed from ${contentRoot ?? 'unknown'}`);
}

await server.connect(new StdioServerTransport());
