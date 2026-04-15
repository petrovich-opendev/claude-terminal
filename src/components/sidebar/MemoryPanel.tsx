import { useEffect, useState } from 'react'
import { useCostStore } from '@/store/cost'
import { useActivePtyId } from '@/store/tabs'
import styles from './MemoryPanel.module.css'

interface Props {
  onFileSelect: (path: string) => void
}

interface MemoryEntry {
  path: string
  scope: 'global' | 'project' | 'local'
  label: string
  sizeBytes: number
  firstLine: string
  exists: boolean
}

const MEMORY_FILES: { path: string; scope: MemoryEntry['scope']; label: string }[] = [
  { path: '~/.claude/CLAUDE.md',               scope: 'global',  label: 'CLAUDE.md (global)' },
  { path: './CLAUDE.md',                        scope: 'project', label: 'CLAUDE.md (project)' },
  { path: './.claude/settings.local.json',      scope: 'local',   label: 'settings.local.json' },
]

const SCOPE_COLOR: Record<MemoryEntry['scope'], string> = {
  global:  '#5b5ef4',
  project: '#22c55e',
  local:   '#f59e0b',
}

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B'
  return (n / 1024).toFixed(1) + ' KB'
}

export default function MemoryPanel({ onFileSelect }: Props) {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const current = useCostStore((s) => s.current)
  const ptyId = useActivePtyId()

  useEffect(() => {
    Promise.all(
      MEMORY_FILES.map(async ({ path, scope, label }) => {
        try {
          const content = await window.electronAPI.fsRead(path)
          const lines = content.split('\n')
          const firstLine = lines.find((l) => l.trim().length > 0)?.trim() ?? ''
          return {
            path,
            scope,
            label,
            sizeBytes: new TextEncoder().encode(content).length,
            firstLine,
            exists: true,
          } satisfies MemoryEntry
        } catch {
          return { path, scope, label, sizeBytes: 0, firstLine: '', exists: false } satisfies MemoryEntry
        }
      })
    ).then(setEntries)
  }, [])

  const inputTokens = current?.inputTokens ?? 0
  const contextPct = Math.min(100, Math.round((inputTokens / 200000) * 100))
  const contextColor =
    contextPct >= 80 ? '#ef4444' :
    contextPct >= 50 ? '#f59e0b' :
    '#22c55e'

  const handleCompact = () => {
    if (!ptyId) return
    window.electronAPI.ptyWrite(ptyId, '/compact\r').catch(() => {})
  }

  return (
    <div className={styles.panel}>
      <div className={styles.files}>
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`${styles.fileRow} ${entry.exists ? '' : styles.missing}`}
          >
            <div className={styles.fileHeader}>
              <span
                className={styles.scopeBadge}
                style={{
                  background: SCOPE_COLOR[entry.scope] + '22',
                  color: SCOPE_COLOR[entry.scope],
                  borderColor: SCOPE_COLOR[entry.scope] + '55',
                }}
              >
                {entry.scope}
              </span>
              <span className={styles.fileName}>{entry.label}</span>
              {entry.exists && (
                <span className={styles.fileSize}>{formatBytes(entry.sizeBytes)}</span>
              )}
              {entry.exists && (
                <button
                  className={styles.editBtn}
                  onClick={() => onFileSelect(entry.path)}
                  title={`Edit ${entry.label}`}
                >
                  ✎
                </button>
              )}
            </div>
            {entry.exists ? (
              <div className={styles.preview}>{entry.firstLine || '(empty)'}</div>
            ) : (
              <div className={styles.absent}>not found</div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.contextSection}>
        <div className={styles.contextHeader}>
          <span className={styles.contextLabel}>Context Usage</span>
          <span className={styles.contextPct} style={{ color: contextColor }}>
            {contextPct}%
          </span>
          <span className={styles.contextTokens}>
            {inputTokens.toLocaleString()} / 200 000
          </span>
        </div>
        <div className={styles.contextBar}>
          <div
            className={styles.contextFill}
            style={{ width: contextPct + '%', background: contextColor }}
          />
        </div>
        <div style={{ fontSize:11, color:'var(--t3)', marginTop:6, textAlign:'center' }}>
          ~{Math.max(0, Math.floor((200000 - inputTokens) / 2000))} turns remaining
        </div>
        <button
          className={styles.compactBtn}
          onClick={handleCompact}
          disabled={!ptyId}
          title={ptyId ? 'Run /compact in terminal' : 'No active terminal'}
        >
          Compact now
        </button>
      </div>

      <div style={{ padding:'8px 12px', borderTop:'1px solid var(--b1)', display:'flex', flexDirection:'column', gap:4 }}>
        <button onClick={() => onFileSelect('~/.claude/CLAUDE.md')}
          style={{ padding:'5px 8px', fontSize:11, textAlign:'left', borderRadius:4, border:'1px solid var(--b2)', background:'transparent', color:'var(--t2)', cursor:'pointer' }}>
          ✎ Edit global memory
        </button>
        <button onClick={() => onFileSelect('./CLAUDE.md')}
          style={{ padding:'5px 8px', fontSize:11, textAlign:'left', borderRadius:4, border:'1px solid var(--b2)', background:'transparent', color:'var(--t2)', cursor:'pointer' }}>
          ✎ Edit project memory
        </button>
        <button onClick={() => onFileSelect('~/.claude/commands/custom.md')}
          style={{ padding:'5px 8px', fontSize:11, textAlign:'left', borderRadius:4, border:'1px solid var(--b2)', background:'transparent', color:'var(--t2)', cursor:'pointer' }}>
          + New custom command
        </button>
      </div>
    </div>
  )
}
