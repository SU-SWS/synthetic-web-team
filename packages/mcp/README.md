# @su-sws/mcp

MCP server exposing Stanford Web Services standards to any MCP client.

**A second entry point, never a requirement.** Everything this server exposes is
also a plain file under `standards/` that an agent can read directly. If the
server will not start, nothing else stops working.

## Add it to a client

```json
{ "mcpServers": { "sws": { "command": "npx", "args": ["-y", "@su-sws/mcp"] } } }
```

`npx @su-sws/create-web-team` writes this for you into `.mcp.json` and
`.cursor/mcp.json`.

## Tools

| Tool | What it is for |
|---|---|
| `sws_get_standard` | Fetch a policy, pattern, recipe, or fragment. Accepts synonyms: `footer`, `wcag`, `sso`, `cookies`, `tokens`. Call with no topic to list everything |
| `sws_footer_html` | Correct Stanford Global Footer markup, generated from the byte-exact contract |
| `sws_check` | The advisory compliance report, structured, with a score out of 100 |
| `sws_decanter_token` | Resolve a Decanter token from the CSS of the version actually installed |
| `sws_scaffold` | Install the agent team into a project. **Dry run by default** |

Documents are also exposed as resources at `sws://standard/<path>`, for clients
that support them. Tools are the portable surface; resources are the idiomatic
one, and supporting both costs almost nothing.

### Why `sws_footer_html` exists

The Global Footer is immutable, frequently gotten wrong, and mechanically
generable. This project typed two of its ten URLs wrong from memory in its own
first draft. Generating from the contract means that cannot happen again.

### Why `sws_decanter_token` reads local CSS

Decanter 8 is CSS-first, so its tokens are plain custom properties in files we
can read. The tool parses `node_modules/decanter/src/css/**`, which makes it
**version-accurate by construction** rather than by staying in sync with a
separate service. That is also why this project does not depend on
`decanter-mcp` for v8 work.

## Design notes

**`sws_check` and `sws_scaffold` shell out** to `@su-sws/sws-cli` and
`@su-sws/create-web-team` rather than reimplementing them. One implementation
means the MCP result and the terminal result can never disagree, which is the
drift this project is organised against. The cost is a process spawn.

**Nothing is written to stdout except protocol frames.** stdout *is* the
transport; a stray `console.log` corrupts the stream and the client reports a
parse error with no clue where it came from. Diagnostics go to stderr.

**Tools never throw.** A thrown error hands the calling model a stack trace,
which it then tries to reason about. Every failure returns text saying what went
wrong and what to do about it.

## Protocol version

Built against the version `@modelcontextprotocol/sdk` negotiates — `2025-11-25`
latest, down to `2024-11-05`.

`PROJECT-PLAN.md` section 7 specified spec `2026-07-28` (stateless,
`server/discover`). Checked against SDK 1.30.0 on 2026-09-01: that string appears
nowhere in the SDK, `server/discover` appears nowhere in the SDK, and
`LATEST_PROTOCOL_VERSION` is `2025-11-25`. Building against a spec no SDK
implements would have produced a server that works in no editor, which is the
opposite of this project's portability thesis. Revisit when the SDK ships it; the
tool surface does not depend on the transport.

## Licence

GPL-3.0-or-later, matching [Decanter](https://github.com/SU-SWS/decanter).
