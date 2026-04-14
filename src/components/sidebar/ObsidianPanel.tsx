import { useEffect, useState } from 'react'

interface HealthResponse {
  vault?: string
  [key: string]: unknown
}

type Status = 'checking' | 'connected' | 'disconnected'

export default function ObsidianPanel() {
  const [status, setStatus]     = useState<Status>('checking')
  const [vaultName, setVaultName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('http://localhost:22360/health', { signal: AbortSignal.timeout(2000) })
      .then(res => res.json() as Promise<HealthResponse>)
      .then(data => {
        if (cancelled) return
        setStatus('connected')
        if (typeof data.vault === 'string') setVaultName(data.vault)
      })
      .catch(() => {
        if (!cancelled) setStatus('disconnected')
      })
    return () => { cancelled = true }
  }, [])

  const writeToPty = (cmd: string) => {
    window.electronAPI.ptyWrite(cmd + '\r')
  }

  return (
    <div style={{
      padding: 16,
      color: '#ccc',
      fontSize: 13,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: status === 'connected' ? '#4caf50' : '#666',
          boxShadow: status === 'connected' ? '0 0 4px #4caf50' : 'none',
        }} />
        <span style={{ fontWeight: 600 }}>
          Obsidian MCP
        </span>
        <span style={{ color: '#888', fontSize: 11 }}>
          {status === 'checking' ? 'checking…' : status === 'connected' ? 'connected' : 'disconnected'}
        </span>
      </div>

      {status === 'connected' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vaultName && (
            <div style={{ color: '#aaa', fontSize: 12 }}>
              Vault: <span style={{ color: '#e0c07a' }}>{vaultName}</span>
            </div>
          )}
          <button
            onClick={() => writeToPty('claude "Search my Obsidian vault for: "')}
            style={btnStyle}
          >
            Search vault
          </button>
          <button
            onClick={() => writeToPty('claude "Save this session summary to my Obsidian vault"')}
            style={btnStyle}
          >
            Save session to Vault
          </button>
        </div>
      )}

      {status === 'disconnected' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, color: '#aaa', lineHeight: 1.5 }}>
            Obsidian is not connected. To enable integration:
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, color: '#888', lineHeight: 1.8 }}>
            <li>Open Obsidian</li>
            <li>Install the <strong style={{ color: '#e0c07a' }}>obsidian-claude-code-mcp</strong> plugin</li>
            <li>Enable the plugin (it starts an HTTP server on port <strong>22360</strong>)</li>
            <li>Reload this panel</li>
          </ol>
        </div>
      )}

      {status === 'checking' && (
        <div style={{ color: '#666', fontSize: 12 }}>Connecting to localhost:22360…</div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid #555',
  background: '#2a2a2a',
  color: '#e0c07a',
  cursor: 'pointer',
  textAlign: 'left',
}
