import type { ClaudeMode, ClaudeModeId } from './models'

export const MODES: Record<ClaudeModeId, ClaudeMode> = {
  coding: {
    id: 'coding',
    label: 'Coding',
    icon: '{ }',
    color: '#60a5fa',
    model: 'sonnet',
    tools: { Bash: true, Edit: true, Write: true, Glob: true, Grep: true, WebSearch: false, WebFetch: false, Notebook: false },
    permissionsMode: 'auto',
    extendedThinking: false,
    thinkingBudget: 0,
    cliFlags: ['--continue'],
    description: 'Full tool access. Sonnet — best speed/quality balance.',
  },
  reasoning: {
    id: 'reasoning',
    label: 'Reasoning',
    icon: '◈',
    color: '#a78bfa',
    model: 'opus',
    tools: { Bash: false, Edit: false, Write: false, Glob: true, Grep: true, WebSearch: true, WebFetch: true, Notebook: false },
    permissionsMode: 'manual',
    extendedThinking: true,
    thinkingBudget: 10000,
    cliFlags: [],
    description: 'Read-only + extended thinking. Opus for architecture decisions.',
  },
  design: {
    id: 'design',
    label: 'Design',
    icon: '◇',
    color: '#f472b6',
    model: 'sonnet',
    tools: { Bash: false, Edit: false, Write: true, Glob: true, Grep: false, WebSearch: true, WebFetch: true, Notebook: false },
    permissionsMode: 'auto',
    extendedThinking: false,
    thinkingBudget: 0,
    cliFlags: [],
    description: 'UI, docs, web research. File write allowed.',
  },
  research: {
    id: 'research',
    label: 'Research',
    icon: '◎',
    color: '#34d399',
    model: 'haiku',
    tools: { Bash: false, Edit: false, Write: false, Glob: false, Grep: true, WebSearch: true, WebFetch: true, Notebook: false },
    permissionsMode: 'skip',
    extendedThinking: false,
    thinkingBudget: 0,
    cliFlags: ['--dangerously-skip-permissions'],
    description: 'Read-only + web. Haiku — cheapest mode.',
  },
}

export const MODEL_IDS: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
}

/**
 * Build the CLI command string for a given mode + tool overrides.
 * NEVER constructs shell strings from user input — only from validated config.
 */
export function buildCliCommand(
  mode: ClaudeMode,
  toolOverrides?: Partial<ClaudeMode['tools']>
): string {
  const tools = { ...mode.tools, ...toolOverrides }
  const enabledTools = Object.entries(tools)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(',')
  const modelId = MODEL_IDS[mode.model] ?? mode.model
  const parts = ['claude', '--model', modelId]
  if (enabledTools) parts.push('--allowedTools', enabledTools)
  if (mode.permissionsMode === 'skip') parts.push('--dangerously-skip-permissions')
  if (mode.extendedThinking) {
    parts.push('--thinking')
    if (mode.thinkingBudget > 0) parts.push('--thinking-budget', String(mode.thinkingBudget))
  }
  for (const flag of mode.cliFlags) {
    if (flag !== '--dangerously-skip-permissions') parts.push(flag)
  }
  return parts.join(' ')
}
