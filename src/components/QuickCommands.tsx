import { useTerminalStore } from '@/store/terminal'
import type { QuickCommand } from '@/lib/models'
import styles from './QuickCommands.module.css'

const COMMANDS: QuickCommand[] = [
  // session
  { id: 'start',    label: 'Start',    category: 'session', cmd: 'claude',              icon: '▶' },
  { id: 'continue', label: 'Continue', category: 'session', cmd: 'claude --continue',   icon: '↺' },
  { id: 'resume',   label: 'Resume',   category: 'session', cmd: 'claude --resume',     icon: '⏯' },
  { id: 'cost',     label: 'Cost',     category: 'session', cmd: '/cost',               icon: '$' },
  { id: 'compact',  label: 'Compact',  category: 'session', cmd: '/compact',            icon: '⊡' },
  // code
  { id: 'review',   label: 'Review',   category: 'code',    cmd: '/review',             icon: '◉' },
  { id: 'fix',      label: 'Fix',      category: 'code',    cmd: '/fix',                icon: '⚡' },
  { id: 'tests',    label: 'Tests',    category: 'code',    cmd: '/tests',              icon: '✓' },
  { id: 'refactor', label: 'Refactor', category: 'code',    cmd: '/refactor',           icon: '↻' },
  { id: 'explain',  label: 'Explain',  category: 'code',    cmd: '/explain',            icon: '?' },
  // git
  { id: 'pr',       label: 'PR',       category: 'git',     cmd: '/pr',                 icon: '⇡' },
  { id: 'commit',   label: 'Commit',   category: 'git',     cmd: '/commit',             icon: '●' },
  // arch
  { id: 'design',   label: 'Design',   category: 'arch',    cmd: '/design',             icon: '◇' },
  { id: 'adr',      label: 'ADR',      category: 'arch',    cmd: '/adr',                icon: '▣' },
]

const CATEGORY_LABELS: Record<QuickCommand['category'], string> = {
  session: 'Session',
  code:    'Code',
  git:     'Git',
  arch:    'Arch',
}

const CATEGORY_COLORS: Record<QuickCommand['category'], string> = {
  session: '#5b5ef4',
  code:    '#22c55e',
  git:     '#f59e0b',
  arch:    '#a78bfa',
}

const CATEGORIES: QuickCommand['category'][] = ['session', 'code', 'git', 'arch']

export default function QuickCommands() {
  const { ptyId } = useTerminalStore()

  const send = (cmd: string) => {
    if (!ptyId) return
    window.electronAPI.ptyWrite(ptyId, cmd + '\r').catch(() => {})
  }

  return (
    <div data-testid="quickcmds" className={styles.bar}>
      <div className={styles.inner}>
        {CATEGORIES.map((cat) => {
          const cmds = COMMANDS.filter((c) => c.category === cat)
          return (
            <div key={cat} className={styles.group}>
              <span
                className={styles.catLabel}
                style={{ color: CATEGORY_COLORS[cat] }}
              >
                {CATEGORY_LABELS[cat]}
              </span>
              {cmds.map((c) => (
                <button
                  key={c.id}
                  className={styles.chip}
                  onClick={() => send(c.cmd)}
                  title={c.cmd}
                  disabled={!ptyId}
                >
                  <span className={styles.chipIcon}>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
