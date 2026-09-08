// Editor detection. Deliberately generous about what counts as evidence, and
// deliberately never authoritative: everything detected is a PRE-CHECKED
// SUGGESTION the person can override. Guessing wrong and writing config for an
// editor somebody does not use is a small harm; failing to offer one they do
// use is a bigger one.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// `emits` lists the files this editor needs BEYOND the universal core.
// Skills come from .agents/skills and .claude/skills, which every entry shares.
export const EDITORS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    localSigns: ['.claude', 'CLAUDE.md'],
    homeSigns: ['.claude'],
    emits: ['CLAUDE.md', '.mcp.json'],
    note: 'reads .claude/skills natively',
  },
  {
    id: 'vscode',
    label: 'VS Code + Copilot',
    localSigns: ['.vscode', '.github/copilot-instructions.md'],
    homeSigns: [],
    emits: ['.github/copilot-instructions.md', '.vscode/mcp.json'],
    note: 'reads .claude/skills by default, so no extra skill copy needed',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    localSigns: ['.cursor'],
    homeSigns: ['.cursor'],
    emits: ['.cursor/rules/sws.mdc', '.cursor/mcp.json'],
    note: 'reads .agents/skills; rules file must be .mdc, not .md',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    localSigns: ['.codex'],
    homeSigns: ['.codex'],
    emits: ['.codex/config.toml'],
    note: 'reads AGENTS.md and .agents/skills already',
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    localSigns: ['.agents/rules', 'GEMINI.md'],
    homeSigns: ['.gemini'],
    emits: ['GEMINI.md', '.agents/mcp_config.json'],
    note: 'ranks GEMINI.md above AGENTS.md, so it needs its own pointer',
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    localSigns: ['.gemini'],
    homeSigns: ['.gemini'],
    emits: ['GEMINI.md'],
    note: 'does not read AGENTS.md natively',
  },
  {
    id: 'zed',
    label: 'Zed',
    localSigns: ['.zed'],
    homeSigns: ['.config/zed'],
    emits: [],
    note: 'reads AGENTS.md and .agents/skills; nothing extra needed',
  },
  {
    id: 'windsurf',
    label: 'Windsurf / Devin',
    localSigns: ['.windsurf', '.devin'],
    homeSigns: ['.codeium'],
    emits: ['.devin/rules/sws.md'],
    note: 'rules extension is .md, not .mdc',
  },
];

export function detect(root = process.cwd()) {
  const home = homedir();
  return EDITORS.map((e) => {
    const local = e.localSigns.filter((s) => existsSync(join(root, s)));
    const global = e.homeSigns.filter((s) => existsSync(join(home, s)));
    return {
      ...e,
      detected: local.length > 0 || global.length > 0,
      evidence: [
        ...local.map((s) => `./${s}`),
        ...global.map((s) => `~/${s}`),
      ],
    };
  });
}

// Tier derivation. The person is asked about the WORLD, never about MinSec.
// Nobody should have to read a security matrix to start a website.
export function deriveTier({ collectsPersonalData, authenticates, payments, regulated }) {
  if (payments || regulated) {
    return {
      tier: 'high',
      because: payments ? 'the site handles payments' : 'the site handles regulated data',
      adds: [
        'Data Risk Assessment before deployment',
        'administrative access only from a privileged access workstation',
        'PCI DSS, HIPAA, FISMA, or export controls as applicable',
        'everything in the moderate tier',
      ],
    };
  }
  if (collectsPersonalData || authenticates) {
    return {
      tier: 'moderate',
      because: authenticates ? 'the site authenticates users' : 'the site collects personal information',
      adds: [
        'Duo two-step for all users and administrators',
        'centralised logging',
        'secure SDLC: security as a design requirement, code review, static analysis',
        'annual developer training',
        'weekly encrypted backups',
      ],
    };
  }
  return {
    tier: 'low',
    because: 'the site shows public information only',
    adds: [
      'patch high-severity findings within 7 days, others within 90',
      'monthly vulnerability scanning',
      'quarterly inventory with risk class',
      'quarterly account and privilege review',
      'least-privilege administrative accounts',
    ],
  };
}
