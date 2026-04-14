import { useState, useCallback } from 'react'
import { useModesStore } from '@/store/modes'
import { MODES, buildCliCommand } from '@/lib/modes'
import type { ClaudeMode } from '@/lib/models'
import styles from './ToolsPanel.module.css'

const TOOLS = {
  Bash:      { icon: '>_', risk: 'high' as const, desc: 'Run shell commands' },
  Edit:      { icon: '✎',  risk: 'med'  as const, desc: 'Edit files' },
  Write:     { icon: '+',  risk: 'med'  as const, desc: 'Create files' },
  Glob:      { icon: '**', risk: 'none' as const, desc: 'Find files' },
  Grep:      { icon: '/',  risk: 'none' as const, desc: 'Search content' },
  WebSearch: { icon: '⌖',  risk: 'none' as const, desc: 'Web search' },
  WebFetch:  { icon: '↓',  risk: 'low'  as const, desc: 'Fetch URLs' },
  Notebook:  { icon: '◻',  risk: 'med'  as const, desc: 'Jupyter notebooks' },
} as const

type ToolName = keyof typeof TOOLS
type RiskLevel = 'none' | 'low' | 'med' | 'high'

const RISK_LABEL: Record<RiskLevel, string> = {
  none: 'safe',
  low:  'low',
  med:  'med',
  high: 'high',
}

export default function ToolsPanel() {
  const { activeMode, toolOverrides, toggleTool } = useModesStore()
  const mode = MODES[activeMode]
  const isOpus = mode.model === 'opus'

  const [thinking, setThinking] = useState(mode.extendedThinking)
  const [budget, setBudget] = useState(mode.thinkingBudget || 10000)

  const effectiveMode: ClaudeMode = isOpus
    ? { ...mode, extendedThinking: thinking, thinkingBudget: budget }
    : mode

  const cmd = buildCliCommand(effectiveMode, toolOverrides)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(cmd).catch(() => {})
  }, [cmd])

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        {(Object.keys(TOOLS) as ToolName[]).map((name) => {
          const info = TOOLS[name]
          const base = mode.tools[name]
          const enabled = toolOverrides[name] ?? base
          return (
            <div key={name} className={styles.toolRow}>
              <span className={styles.toolIcon}>{info.icon}</span>
              <div className={styles.toolInfo}>
                <span className={styles.toolName}>{name}</span>
                <span className={`${styles.risk} ${styles['risk_' + info.risk]}`}>
                  {RISK_LABEL[info.risk]}
                </span>
                <span className={styles.toolDesc}>{info.desc}</span>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={!!enabled}
                  onChange={() => toggleTool(name)}
                  aria-label={`Toggle ${name}`}
                />
                <span className={styles.slider} />
              </label>
            </div>
          )
        })}
      </div>

      {isOpus && (
        <div className={styles.section}>
          <div className={styles.thinkingRow}>
            <span className={styles.thinkingLabel}>Extended Thinking</span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={thinking}
                onChange={(e) => setThinking(e.target.checked)}
                aria-label="Toggle extended thinking"
              />
              <span className={styles.slider} />
            </label>
          </div>
          {thinking && (
            <div className={styles.budgetRow}>
              <span className={styles.budgetLabel}>
                Budget: {budget.toLocaleString()} tok
              </span>
              <input
                type="range"
                min={0}
                max={30000}
                step={1000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className={styles.budgetSlider}
                aria-label="Thinking budget"
              />
            </div>
          )}
        </div>
      )}

      <div className={styles.cmdSection}>
        <div className={styles.cmdHeader}>
          <span className={styles.cmdLabel}>CLI Command</span>
          <button className={styles.copyBtn} onClick={copy} title="Copy to clipboard">
            ⎘
          </button>
        </div>
        <textarea
          className={styles.cmdTextarea}
          value={cmd}
          readOnly
          rows={3}
          aria-label="CLI command"
        />
      </div>
    </div>
  )
}
