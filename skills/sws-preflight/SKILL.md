---
name: sws-preflight
description: Check whether this machine has the tools needed to build and deploy a Stanford site, install whatever is missing, and verify it worked. Use at the start of work on a new machine, before a first deploy, when a build or test fails in a way that smells like a missing tool, or when someone asks what they need installed.
---

# Check the machine before you build on it

```bash
npx sws preflight
```

One command. It reads `standards/stack/requirements.yml`, probes for each tool,
and tells you what is missing and why it matters. Use `--format json` if you are
acting on the result programmatically.

**It does not install anything, and it deliberately does not tell you how to.**
That part is yours: you know what platform you are on and what package manager
exists, and a hardcoded install matrix would be a guess about someone else's
machine that is wrong on a good fraction of them.

## The loop

1. **Check.** `npx sws preflight`.
2. **Install what it names**, however you normally would on this machine.
3. **Check again.** This is the step people skip, and it is the whole reason the
   command exists. An installer that printed success without putting the binary
   on `PATH` is the common failure, and it stays invisible until something
   unrelated breaks with a confusing error.

Do not report a machine as ready on the strength of an install command exiting
0. Report it ready when the check says so.

## Reading the result

| State | Means |
|---|---|
| `ok` | Present, and new enough |
| `MISSING` | Not installed. Install it |
| `TOO OLD` | Installed below the version floor. Upgrade it |
| `unknown` | Present but the probe failed. **Not a pass** — investigate rather than assuming it is fine |
| `-` | Not needed for this project, usually because of the recorded host |

`unknown` deserves attention. It means the binary exists and did not answer as
expected, which is a different problem from absence and usually has a different
cause: a broken install, a shim, a PATH collision, or a wrapper that swallowed
the flag.

## What it checks, and what it will not

The list lives in `standards/stack/requirements.yml`, which is the single source
of truth — read that rather than trusting a list here, because this file will
drift and that one is executed.

Two things worth knowing without opening it:

- **`git` is the one with no substitute.** No API and no MCP server replaces it:
  the GitHub API can create a repo and write single files, but it cannot init a
  repo, commit locally, add a remote, or push a working tree.
- **Playwright's browser is a separate download from its npm packages.** The
  packages can be installed and the browser absent, and the failure then looks
  like a broken test rather than a missing binary. A missing browser must never
  read as a clean accessibility result: a check that did not run is `unknown`,
  not a pass.

Some checks are **conditional on the recorded host**, from `hosting.provider` in
`.sws/manifest.yml`. If that is not set yet, host-specific tools report `-` and
say so. Record the host and re-run to get a real answer for it.

The file also lists what is **deliberately not required** — Docker, Homebrew,
any particular package manager, a GitHub MCP server — so their absence is not
mistaken for an oversight. **Do not install Homebrew to obtain one binary.**

## Two courtesies

**Warn before running `git --version` on macOS.** If the Command Line Tools are
absent, it pops a GUI installer dialog. A person has to click that; you cannot.
Say it is about to happen rather than letting a box appear from nowhere.

**Never convert a project's package manager.** If there is a `yarn.lock`, yarn is
the requirement and npm is not. The check reports whichever the project actually
uses, and both are in production at SWS.

## Exit codes

Exits `0` even when tools are missing, because nothing in this toolchain blocks
by default. Pass `--strict` to exit non-zero when a required tool is missing,
which is what you want in CI or in a scripted install-then-verify loop.
