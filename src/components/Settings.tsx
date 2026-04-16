import { useEffect, useRef, useState } from 'react'
import { useConfigStore, FONT_FAMILIES } from '@/store/config'
import { DEFAULT_QUICK_COMMANDS } from '@/lib/defaultQuickCommands'
import { parseQuickCommands } from '@/lib/parseQuickCommands'
import { notifyQuickCommandsUpdated } from '@/lib/quickCommandsEvents'
import styles from './Settings.module.css'

interface Props {
  onClose: () => void
}

const FONT_LABELS: Record<string, string> = {
  '"JetBrains Mono", monospace': 'JetBrains Mono',
  '"Cascadia Code", monospace':  'Cascadia Code',
  '"Fira Code", monospace':      'Fira Code',
  'Monaco, monospace':           'Monaco',
  'Menlo, monospace':            'Menlo',
}

export default function Settings({ onClose }: Props) {
  const cfg = useConfigStore()
  const [qcJson, setQcJson] = useState('')
  const [qcMsg, setQcMsg] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.configGet().then((raw) => {
      const c = raw as { quickCommands?: unknown }
      const cmds = parseQuickCommands(c.quickCommands) ?? DEFAULT_QUICK_COMMANDS
      setQcJson(JSON.stringify(cmds, null, 2))
    }).catch(() => {
      setQcJson(JSON.stringify(DEFAULT_QUICK_COMMANDS, null, 2))
    })
  }, [])

  async function saveQuickCommands() {
    setQcMsg(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(qcJson)
    } catch {
      setQcMsg('Неверный JSON')
      return
    }
    const cmds = parseQuickCommands(parsed)
    if (!cmds) {
      setQcMsg('Нужен непустой массив команд с полями id, label, category, cmd, icon')
      return
    }
    try {
      const full = (await window.electronAPI.configGet()) as Record<string, unknown>
      await window.electronAPI.configSet({ ...full, quickCommands: cmds })
      notifyQuickCommandsUpdated()
      setQcMsg('Сохранено')
      setTimeout(() => setQcMsg(null), 2500)
    } catch {
      setQcMsg('Не удалось сохранить')
    }
  }

  // Keep a ref to the latest onClose so the listener never accumulates
  // (single listener registered once on mount, always calls the current callback)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Cmd+, or Escape → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === ',' && e.metaKey)) {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // mount/unmount only — guaranteed single listener

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          {/* Terminal section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Terminal</h3>

            <label className={styles.label}>Font family</label>
            <select
              className={styles.select}
              value={cfg.fontFamily}
              onChange={e => cfg.setFontFamily(e.target.value)}
            >
              {FONT_FAMILIES.map(f => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {FONT_LABELS[f] ?? f}
                </option>
              ))}
            </select>

            <label className={styles.label}>
              Font size
              <span className={styles.value}>{cfg.fontSize}px</span>
            </label>
            <input
              type="range" min={10} max={20} step={1}
              value={cfg.fontSize}
              onChange={e => cfg.setFontSize(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.rangeTicks}>
              <span>10</span><span>15</span><span>20</span>
            </div>

            <label className={styles.label}>
              Line height
              <span className={styles.value}>{cfg.lineHeight.toFixed(1)}</span>
            </label>
            <input
              type="range" min={1.0} max={1.6} step={0.1}
              value={cfg.lineHeight}
              onChange={e => cfg.setLineHeight(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.rangeTicks}>
              <span>1.0</span><span>1.3</span><span>1.6</span>
            </div>
          </section>

          {/* Claude Code section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Claude Code Alerts</h3>

            <label className={styles.label}>
              Compact suggestion threshold — cost
              <span className={styles.value}>${cfg.costAlertUSD.toFixed(2)}</span>
            </label>
            <input
              type="range" min={0.1} max={5.0} step={0.1}
              value={cfg.costAlertUSD}
              onChange={e => cfg.setCostAlertUSD(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.rangeTicks}>
              <span>$0.10</span><span>$2.50</span><span>$5.00</span>
            </div>

            <label className={styles.label}>
              Compact suggestion threshold — context
              <span className={styles.value}>{cfg.contextAlertPct}%</span>
            </label>
            <input
              type="range" min={10} max={99} step={1}
              value={cfg.contextAlertPct}
              onChange={e => cfg.setContextAlertPct(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.rangeTicks}>
              <span>10%</span><span>55%</span><span>99%</span>
            </div>
          </section>

          {/* Advanced section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Advanced</h3>

            <label className={styles.label}>
              Terminal scrollback
              <span className={styles.value}>{cfg.scrollback.toLocaleString()} lines</span>
            </label>
            <input
              type="range" min={1000} max={50000} step={1000}
              value={cfg.scrollback}
              onChange={e => cfg.setScrollback(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.rangeTicks}>
              <span>1 000</span><span>25 000</span><span>50 000</span>
            </div>

            <label className={styles.label}>
              Obsidian MCP port
              <span className={styles.value}>{cfg.obsidianPort}</span>
            </label>
            <input
              type="number" min={1} max={65535}
              value={cfg.obsidianPort}
              onChange={e => cfg.setObsidianPort(Number(e.target.value))}
              className={styles.select}
            />

            <label className={styles.label} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input
                type="checkbox"
                checked={cfg.wordWrap}
                onChange={e => cfg.setWordWrap(e.target.checked)}
              />
              Editor word wrap
            </label>

            <label className={styles.label} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input
                type="checkbox"
                checked={cfg.readOnlyDefault}
                onChange={e => cfg.setReadOnlyDefault(e.target.checked)}
              />
              Open files read-only by default
            </label>
          </section>

          {/* Quick commands — stored in ~/.config/claude-terminal/config.json */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Quick commands</h3>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7e82a8' }}>
              JSON-массив; поле <code style={{ color: '#c9cfe0' }}>category</code>: session | code | git | arch
            </p>
            <textarea
              className={styles.select}
              style={{ width: '100%', minHeight: 200, fontFamily: 'ui-monospace, monospace', fontSize: 11, resize: 'vertical', boxSizing: 'border-box' }}
              value={qcJson}
              onChange={e => setQcJson(e.target.value)}
              spellCheck={false}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={styles.select}
                style={{ cursor: 'pointer', padding: '6px 12px' }}
                onClick={saveQuickCommands}
              >
                Save quick commands
              </button>
              <button
                type="button"
                className={styles.select}
                style={{ cursor: 'pointer', padding: '6px 12px' }}
                onClick={() => {
                  setQcJson(JSON.stringify(DEFAULT_QUICK_COMMANDS, null, 2))
                  setQcMsg(null)
                }}
              >
                Reset to defaults
              </button>
              {qcMsg && <span style={{ fontSize: 12, color: qcMsg === 'Сохранено' ? '#22c55e' : '#f87171' }}>{qcMsg}</span>}
            </div>
          </section>

          {/* Preview */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Preview</h3>
            <div
              className={styles.preview}
              style={{
                fontFamily: cfg.fontFamily,
                fontSize: cfg.fontSize,
                lineHeight: cfg.lineHeight,
              }}
            >
              <span style={{ color: '#22c55e' }}>❯</span> claude --model sonnet-4-6<br />
              <span style={{ color: '#60a5fa' }}>✓</span> Task completed in 3 steps<br />
              <span style={{ color: '#f59e0b' }}>$</span> git commit -m "feat: add feature"
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
