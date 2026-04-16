import type { QuickCommand } from './models'

/** Built-in quick commands — persisted copy lives in `~/.config/claude-terminal/config.json` → `quickCommands`. */
export const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  { id: 'start',    label: 'Start',    category: 'session', cmd: 'claude',              icon: '▶' },
  { id: 'continue', label: 'Continue', category: 'session', cmd: 'claude --continue',   icon: '↺' },
  { id: 'resume',   label: 'Resume',   category: 'session', cmd: 'claude --resume',     icon: '⏯' },
  { id: 'cost',     label: 'Cost',     category: 'session', cmd: '/cost',               icon: '$' },
  { id: 'compact',  label: 'Compact',  category: 'session', cmd: '/compact',            icon: '⊡' },
  { id: 'review',   label: 'Review',   category: 'code',    cmd: 'claude "Review this code for quality, bugs, and best practices"',    icon: '◉' },
  { id: 'fix',      label: 'Fix',      category: 'code',    cmd: 'claude "Fix the bug or issue in this code"',                         icon: '⚡' },
  { id: 'tests',    label: 'Tests',    category: 'code',    cmd: 'claude "Write comprehensive tests for this code"',                   icon: '✓' },
  { id: 'refactor', label: 'Refactor', category: 'code',    cmd: 'claude "Refactor this code for clarity and maintainability"',        icon: '↻' },
  { id: 'explain',  label: 'Explain',  category: 'code',    cmd: 'claude "Explain what this code does and how it works"',              icon: '?' },
  { id: 'pr',       label: 'PR',       category: 'git',     cmd: 'claude "Create a pull request for these changes"',                  icon: '⇡' },
  { id: 'commit',   label: 'Commit',   category: 'git',     cmd: 'claude "Commit these changes with a descriptive commit message"',   icon: '●' },
  { id: 'design',   label: 'Design',   category: 'arch',    cmd: 'claude "Design the architecture for this feature"',                 icon: '◇' },
  { id: 'adr',      label: 'ADR',      category: 'arch',    cmd: 'claude "Write an Architecture Decision Record for this decision"',  icon: '▣' },
]
