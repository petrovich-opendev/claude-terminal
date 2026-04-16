import { useEffect, useState } from 'react'
import { useActivePtyId } from '@/store/tabs'
import type { QuickCommand } from '@/lib/models'
import { DEFAULT_QUICK_COMMANDS } from '@/lib/defaultQuickCommands'
import { parseQuickCommands } from '@/lib/parseQuickCommands'
import { QUICK_COMMANDS_UPDATED } from '@/lib/quickCommandsEvents'
import styles from './QuickCommands.module.css'

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
  const ptyId = useActivePtyId()
  const [commands, setCommands] = useState<QuickCommand[]>(DEFAULT_QUICK_COMMANDS)

  useEffect(() => {
    function load() {
      window.electronAPI.configGet().then((raw) => {
        const cfg = raw as { quickCommands?: unknown }
        const parsed = cfg.quickCommands !== undefined ? parseQuickCommands(cfg.quickCommands) : null
        setCommands(parsed ?? DEFAULT_QUICK_COMMANDS)
      }).catch(() => { setCommands(DEFAULT_QUICK_COMMANDS) })
    }
    load()
    window.addEventListener(QUICK_COMMANDS_UPDATED, load)
    return () => window.removeEventListener(QUICK_COMMANDS_UPDATED, load)
  }, [])

  const send = (cmd: string) => {
    if (!ptyId) return
    window.electronAPI.ptyWrite(ptyId, cmd + '\r').catch(() => {})
  }

  return (
    <div data-testid="quickcmds" className={styles.bar}>
      <div className={styles.inner}>
        {CATEGORIES.map((cat) => {
          const cmds = commands.filter((c) => c.category === cat)
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
