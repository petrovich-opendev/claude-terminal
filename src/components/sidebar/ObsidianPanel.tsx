import { useEffect, useState, useRef } from 'react'
import { useActivePtyId } from '@/store/tabs'

interface VaultNote {
  path: string
  name: string
}

interface SearchResult {
  filename: string
  score: number
  context: { match: { start: number; end: number }; context: string }[]
}

type Status = 'loading' | 'no-key' | 'connected' | 'error'

const KEYCHAIN_ACCOUNT = 'obsidian-api-key'
const DEFAULT_PORT = 27123

function obsidianUrl(port: number, path: string) {
  return `http://localhost:${port}${path}`
}

function obsidianHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` }
}

export default function ObsidianPanel() {
  const [status, setStatus]           = useState<Status>('loading')
  const [port, setPort]               = useState(DEFAULT_PORT)
  const [apiKey, setApiKey]           = useState('')
  const [keyInput, setKeyInput]       = useState('')
  const [portInput, setPortInput]     = useState(String(DEFAULT_PORT))
  const [vaultName, setVaultName]     = useState<string | null>(null)
  const [notes, setNotes]             = useState<VaultNote[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VaultNote[] | null>(null)
  const [searching, setSearching]     = useState(false)
  const [selectedNote, setSelectedNote] = useState<{ path: string; content: string } | null>(null)
  const [loadingNote, setLoadingNote] = useState(false)
  const [msg, setMsg]                 = useState<{ text: string; color: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const ptyId = useActivePtyId()

  function showMsg(text: string, color = '#22c55e', ms = 3000) {
    setMsg({ text, color })
    setTimeout(() => setMsg(null), ms)
  }

  async function connect(key: string, p: number) {
    setStatus('loading')
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch(obsidianUrl(p, '/'), {
        headers: obsidianHeaders(key),
        signal: AbortSignal.timeout(4000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { vault?: string; versions?: unknown }
      setVaultName(typeof data.vault === 'string' ? data.vault : null)
      setApiKey(key)
      setPort(p)
      setStatus('connected')
      loadRootNotes(key, p)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setStatus('error')
    }
  }

  async function loadRootNotes(key: string, p: number) {
    try {
      const res = await fetch(obsidianUrl(p, '/vault/'), { headers: obsidianHeaders(key) })
      const data = await res.json() as { files?: string[] }
      const mdFiles = (data.files ?? []).filter((f: string) => f.endsWith('.md'))
      setNotes(mdFiles.slice(0, 100).map(toNote))
    } catch {}
  }

  // Init: load key + port from storage
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await window.electronAPI.configGet() as { obsidianPort?: number }
        const p = cfg.obsidianPort ?? DEFAULT_PORT
        setPort(p)
        setPortInput(String(p))
        const key = await window.electronAPI.keychainGet(KEYCHAIN_ACCOUNT) as string | null
        if (cancelled) return
        if (!key) { setStatus('no-key'); return }
        setApiKey(key)
        await connect(key, p)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => { cancelled = true; abortRef.current?.abort() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveKey() {
    const key = keyInput.trim()
    if (!key) return
    const p = Math.max(1, Math.min(65535, Number(portInput) || DEFAULT_PORT))
    try {
      await window.electronAPI.keychainSet(KEYCHAIN_ACCOUNT, key)
      const cfg = await window.electronAPI.configGet() as object
      await window.electronAPI.configSet({ ...cfg, obsidianPort: p })
      await connect(key, p)
    } catch (e) {
      showMsg(`Error: ${(e as Error).message}`, '#ef4444', 4000)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    setSearching(true)
    try {
      const res = await fetch(
        obsidianUrl(port, `/search/simple/?query=${encodeURIComponent(searchQuery)}&contextLength=80`),
        { headers: obsidianHeaders(apiKey) }
      )
      const data = await res.json() as SearchResult[]
      setSearchResults((data ?? []).map(r => toNote(r.filename)))
    } catch {
      setSearchResults([])
      showMsg('Search failed', '#ef4444')
    } finally {
      setSearching(false)
    }
  }

  async function openNote(notePath: string) {
    if (selectedNote?.path === notePath) { setSelectedNote(null); return }
    setLoadingNote(true)
    try {
      const res = await fetch(
        obsidianUrl(port, `/vault/${encodeURIComponent(notePath)}`),
        { headers: obsidianHeaders(apiKey) }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const content = await res.text()
      setSelectedNote({ path: notePath, content })
    } catch (e) {
      showMsg(`Cannot open: ${(e as Error).message}`, '#ef4444')
    } finally {
      setLoadingNote(false)
    }
  }

  function sendToClaude(content: string, name: string) {
    if (!ptyId) return
    // Escape and truncate to 4k chars to avoid PTY overflow
    const safe = content.slice(0, 4000).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')
    window.electronAPI.ptyWrite(ptyId, `claude "Context from my Obsidian note '${name}':\\n\\n${safe}"\r`).catch(() => {})
    showMsg(`Sent "${name}" to Claude`)
  }

  function handleSaveSession() {
    if (!ptyId) return
    const date = new Date().toISOString().replace('T', ' ').slice(0, 16)
    window.electronAPI.ptyWrite(
      ptyId,
      `claude "Summarize this conversation as a Markdown note with title, key decisions, and action items. Format for Obsidian vault. Date: ${date}"\r`
    ).catch(() => {})
    showMsg('Summary requested — check terminal')
  }

  // ─── RENDER: NO KEY / ERROR ────────────────────────────────────────────────

  if (status === 'loading') {
    return <Wrap><Msg>Connecting…</Msg></Wrap>
  }

  if (status === 'no-key' || status === 'error') {
    return (
      <Wrap>
        <p style={{ margin: '0 0 8px', color: status === 'error' ? '#ef9a9a' : '#aaa', fontSize: 12, lineHeight: 1.6 }}>
          {status === 'error'
            ? '⚠ Cannot connect. Check that Obsidian is running with the plugin enabled.'
            : 'Connect to your Obsidian vault via Local REST API plugin.'}
        </p>
        <div style={{ fontSize: 11, color: '#666', lineHeight: 1.7, marginBottom: 12 }}>
          <strong style={{ color: '#e0c07a' }}>Setup:</strong><br />
          1. Open Obsidian → Community Plugins<br />
          2. Install <strong style={{ color: '#ddd' }}>Local REST API</strong><br />
          3. Copy the API key from plugin settings<br />
          4. Paste below and click Connect
        </div>
        <label style={S.label}>API Key</label>
        <input
          style={S.input}
          type="password"
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
          placeholder="Paste API key from plugin settings"
          autoComplete="off"
        />
        <label style={{ ...S.label, marginTop: 8 }}>Port (default: 27123)</label>
        <input
          style={S.input}
          type="number"
          value={portInput}
          onChange={e => setPortInput(e.target.value)}
          min={1}
          max={65535}
        />
        {msg && <div style={{ fontSize: 11, color: msg.color, marginTop: 6 }}>{msg.text}</div>}
        <button style={{ ...S.primaryBtn, marginTop: 12 }} onClick={handleSaveKey}>
          Connect
        </button>
        {status === 'error' && (
          <button style={{ ...S.secondaryBtn, marginTop: 6 }} onClick={() => connect(apiKey || keyInput, Number(portInput) || DEFAULT_PORT)}>
            ↻ Retry
          </button>
        )}
      </Wrap>
    )
  }

  // ─── RENDER: CONNECTED ─────────────────────────────────────────────────────

  const displayNotes = searchResults ?? notes

  return (
    <Wrap>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green, #22c55e)', boxShadow: '0 0 4px #22c55e55', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 12 }}>Obsidian</span>
        {vaultName && <span style={{ color: '#e0c07a', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }} title={vaultName}>{vaultName}</span>}
        <button onClick={() => connect(apiKey, port)} title="Reload vault" style={S.iconBtn}>↻</button>
        <button onClick={() => { setStatus('no-key'); setKeyInput('') }} title="Change API key" style={{ ...S.iconBtn, marginLeft: 'auto' }}>⚙</button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexShrink: 0 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null) }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search notes…"
        />
        <button style={S.primaryBtn} onClick={handleSearch} disabled={searching} title="Search">
          {searching ? '…' : '⌕'}
        </button>
      </div>

      {/* Save session */}
      <button
        style={{ ...S.secondaryBtn, marginBottom: 8, width: '100%', flexShrink: 0 }}
        onClick={handleSaveSession}
        disabled={!ptyId}
        title={ptyId ? 'Ask Claude to summarize this session for Obsidian' : 'No active terminal'}
      >
        ↓ Save session to Vault
      </button>

      {msg && <div style={{ fontSize: 11, color: msg.color, marginBottom: 6, flexShrink: 0 }}>{msg.text}</div>}

      {/* Notes list */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {displayNotes.length === 0 && !loadingNote && (
          <Msg>{searchResults !== null ? 'No results' : 'No .md notes in vault root'}</Msg>
        )}
        {displayNotes.map(note => (
          <div key={note.path}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 6px', borderRadius: 4, cursor: 'pointer',
                background: selectedNote?.path === note.path ? '#1e2a3a' : 'transparent',
                transition: 'background 0.1s',
              }}
              onClick={() => openNote(note.path)}
            >
              <span style={{ fontSize: 10, flexShrink: 0, color: '#666' }}>📝</span>
              <span style={{ fontSize: 11, flex: 1, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={note.path}>
                {note.name}
              </span>
              <button
                style={S.tinyBtn}
                onClick={e => { e.stopPropagation(); selectedNote?.path === note.path ? sendToClaude(selectedNote.content, note.name) : openNote(note.path) }}
                title={ptyId ? 'Send to Claude' : 'No active terminal'}
                disabled={!ptyId}
              >
                → Claude
              </button>
            </div>

            {/* Inline note preview */}
            {selectedNote?.path === note.path && (
              <div style={{ margin: '2px 0 4px 12px', padding: 8, background: '#0d1117', borderRadius: 4, borderLeft: '2px solid var(--amber, #f59e0b)' }}>
                <pre style={{ margin: 0, fontSize: 11, color: '#aaa', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', fontFamily: 'inherit' }}>
                  {selectedNote.content.slice(0, 3000)}
                  {selectedNote.content.length > 3000 && '\n\n…(truncated, first 3000 chars)'}
                </pre>
                <div style={{ marginTop: 8, display: 'flex', gap: 5 }}>
                  <button style={S.tinyBtn} onClick={() => sendToClaude(selectedNote.content, note.name)} disabled={!ptyId}>→ Claude</button>
                  <button style={{ ...S.tinyBtn, color: '#666' }} onClick={() => setSelectedNote(null)}>✕ Close</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loadingNote && <Msg>Loading…</Msg>}
      </div>
    </Wrap>
  )
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function toNote(path: string): VaultNote {
  return { path, name: path.split('/').pop()?.replace(/\.md$/, '') ?? path }
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 12, color: '#ccc', fontSize: 13, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function Msg({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#555', fontSize: 11, textAlign: 'center', padding: '16px 0' }}>{children}</div>
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const S = {
  label: { fontSize: 11, color: '#777', marginBottom: 3, display: 'block' } as React.CSSProperties,
  input: { padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #2a2a2a', background: '#111', color: '#ddd', outline: 'none', width: '100%', boxSizing: 'border-box' } as React.CSSProperties,
  primaryBtn: { padding: '5px 10px', fontSize: 11, borderRadius: 4, border: '1px solid #f59e0b55', background: '#1a1500', color: '#f59e0b', cursor: 'pointer' } as React.CSSProperties,
  secondaryBtn: { padding: '5px 10px', fontSize: 11, borderRadius: 4, border: '1px solid #2a2a3a', background: '#12121e', color: '#8090b0', cursor: 'pointer' } as React.CSSProperties,
  tinyBtn: { padding: '2px 5px', fontSize: 10, borderRadius: 3, border: '1px solid #2a2a3a', background: '#111', color: '#7090c0', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' } as React.CSSProperties,
  iconBtn: { padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #2a2a2a', background: 'transparent', color: '#666', cursor: 'pointer' } as React.CSSProperties,
}
