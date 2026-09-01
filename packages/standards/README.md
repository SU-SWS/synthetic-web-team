# @su-sws/standards

Stanford Web Services standards and agent team. **Content only: Markdown, YAML,
and one tiny path resolver. No application code, no templates, no design system
fork.**

| Path | What |
|---|---|
| `standards/policy/` | Stanford requirements: MinSec, MinWeb, accessibility, privacy, brand, identity, procurement, escalation |
| `standards/patterns/` | How SWS builds: Decanter, components, content, IA, forms, discoverability, conventions |
| `standards/recipes/` | Build contracts with machine-checkable acceptance criteria |
| `standards/fragments/` | Byte-exact compliance content. The Global Footer lives here |
| `standards/prior-art/` | Existing SWS work, with era, lineage, and judgment attached |
| `standards/stack/` | Reference versions and the performance budget. Advisory |
| `skills/` | 25 `SKILL.md` files: 8 built roles, 11 honest stubs, 6 shared |
| `AGENTS.md` | The behavioral contract, read natively by every supported tool |

## You probably do not need to install this

Most people should run the wizard, which installs the content into a project and
wires up whichever editors it finds:

```bash
npx @su-sws/create-web-team
```

Install this package directly only if you are building tooling on top of the
standards and want the paths programmatically:

```js
import { standardsDir, skillsDir, agentsPath, contentRoot, isComplete } from '@su-sws/standards';
```

Every export is an absolute path, or `null` when the content is unavailable.
`isComplete` is the one-line check.

## A note for contributors

In this repository the content lives at the **repository root**, not in this
directory. `scripts/stage.mjs` copies it in at pack time and removes it again
afterwards, because npm cannot include files from outside a package directory and
the root is where every other reader expects them — the skill validator, the sync
script, and the docs site all cite root-relative paths.

`index.mjs` resolves both layouts, so `npm install` at the root works for
development with no build step.

If you find `standards/`, `skills/` or `AGENTS.md` sitting in this directory, a
pack run was interrupted. They are gitignored, and `node scripts/stage.mjs
--clean` removes them.

## Licence

GPL-3.0-or-later, matching [Decanter](https://github.com/SU-SWS/decanter).
