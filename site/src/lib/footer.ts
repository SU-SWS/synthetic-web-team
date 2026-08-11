// The site's own Global Footer is GENERATED from the contract at build time.
//
// This is deliberate dogfooding. The contract is the single source of truth for
// every Stanford site, including this one, and two of its ten URLs were wrong in
// this project's first draft precisely because they were typed from memory.
// Generating rather than transcribing removes that whole class of error.
//
// If standards/fragments/global-footer.yml changes, this site changes with it.

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import YAML from 'yaml';

// Do NOT resolve from import.meta.url: Astro bundles this module, so at build
// time that points at dist/.prerender/ rather than at source. Walk up from the
// working directory instead, which also means this keeps working if the site
// directory moves.
const REL = join('standards', 'fragments', 'global-footer.yml');

function findContract(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, REL);
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(
    `Could not find ${REL} above ${process.cwd()}. This site generates its Global ` +
    `Footer from that contract on purpose; it will not fall back to a hardcoded copy, ` +
    `because a hardcoded footer is exactly the failure the contract exists to prevent.`
  );
}

const CONTRACT = findContract();

type Link = { label: string; href: string; title?: string };

const contract = YAML.parse(readFileSync(CONTRACT, 'utf8')) as {
  resource_links: Link[];
  policy_links: Link[];
  copyright: { lines: string[] };
  extracted: string;
};

export const resourceLinks = contract.resource_links;
export const policyLinks = contract.policy_links;
export const copyrightLines = contract.copyright.lines;
export const contractExtracted = contract.extracted;
