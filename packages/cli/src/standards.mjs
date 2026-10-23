// Where the standards are, for a project at `root`.
//
// A project vendors them (the wizard copies them in), so the local lookups come
// first and win. The last candidate is the copy that ships alongside the CLI,
// which covers `npx -p @su-sws/synthetic-web-team sws doctor` in a project that
// never vendored them.
//
// `.sws/standards` comes first because a root `standards/` can be the team's
// own folder with nothing of ours in it. So every candidate must also carry the
// Global Footer contract, the one file every copy of ours has, before it wins.
// The root is still read because an older install keeps its standards there
// until `add .` can move them.
//
// Its own module so it can be tested: the CLI's CI calls all pass --standards,
// so nothing else exercises this.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function findStandards(root, { explicit = null, bundled = null } = {}) {
  if (explicit) return resolve(explicit);
  for (const c of [join(root, '.sws', 'standards'), join(root, 'standards'), bundled]) {
    if (c && existsSync(join(c, 'fragments', 'global-footer.yml'))) return c;
  }
  return null;
}
