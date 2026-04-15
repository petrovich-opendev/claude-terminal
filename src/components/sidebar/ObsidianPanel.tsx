import { useEffect, useState, useRef } from 'react'
import { useActivePtyId } from '@/store/tabs'

interface VaultNote {
  path: string
  name: string
}

type Status = 'loading' | 'disconnected' | 'connected' | 'error'

// MCP protocol version per SPEC
const MCP_VERSION = '2024-11-05'
const DEFAULT_PORT = 22360
const SSE_PATH = '/sse'

// ─── MCP SSE CLIENT ───────────────────────────────────────────────────────────

interface McpPending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
}

function makeClient() {
  let postUrl: string | null = null
  let reqId = 1
  const pending = new Map<number, McpPending>()

  function onMessage(raw: string) {
    let msg: { id?: number; result?: unknown; error?: { message: string } }
    try { msg = JSON.parse(raw) } catch { return }
    if (msg.id != null) {
      const p = pending.get(msg.id)
      if (p) {
        pending.delete(msg.id)
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
      }
    }
  }

  function call(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!postUrl) { reject(new Error('MCP not connected')); return }
      const id = reqId++
      pending.set(id, { resolve, reject })
      fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} }),
      }).catch(e => { pending.delete(id); reject(e) })
    })
  }

  function notify(method: string, params?: unknown) {
    if (!postUrl) return
    fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {} }),
    }).catch(() => {})
  }

  function setPostUrl(url: string) { postUrl = url }
  function clearPending() { pending.forEach(p => p.reject(new Error('Disconnected'))); pending.clear() }

  return { call, notify, onMessage, setPostUrl, clearPending }
}

// ─── TOOL MAP ─────────────────────────────────────────────────────────────────

interface ToolMap {
  list?: string
  read?: string
  search?: string
  info?: string
}

function buildToolMap(tools: Array<{ name: string }>): ToolMap {
  const map: ToolMap = {}
  for (const t of tools) {
    const n = t.name.toLowerCase()
    if (!map.list   && (n.includes('list') || (n.includes('vault') && !n.includes('search')))) map.list = t.name
    if (!map.read   && (n.includes('read') || n.includes('get_note') || n.includes('content'))) map.read = t.name
    if (!map.search && n.includes('search')) map.search = t.name
    if (!map.info   && (n.includes('info') || n === 'get_vault' || n.includes('vault_name')))   map.info = t.name
  }
  return map
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function ObsidianPanel() {
  const [status, setStatus]               = useState<Status>('loading')
  const [port, setPort]                   = useState(DEFAULT_PORT)
  const [portInput, setPortInput]         = useState(String(DEFAULT_PORT))
  const [vaultName, setVaultName]         = useState<string | null>(null)
  const [notes, setNotes]                 = useState<VaultNote[]>([])
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<VaultNote[] | null>(null)
  const [searching, setSearching]         = useState(false)
  const [selectedNote, setSelectedNote]   = useState<{ path: string; content: string } | null>(null)
  const [loadingNote, setLoadingNote]     = useState(false)
  const [msg, setMsg]                     = useState<{ text: string; color: string } | null>(null)

  const evtSourceRef = useRef<EventSource | null>(null)
  const toolMapRef   = useRef<ToolMap>({})
  const clientRef    = useRef(makeClient())
  const ptyId = useActivePtyId()

  function showMsg(text: string, color = '#22c55e', ms = 3000) {
    setMsg({ text, color })
    setTimeout(() => setMsg(null), ms)
  }

  // ── MCP connect via HTTP/SSE (2024-11-05 spec) ────────────────────────────

  function connect(p: number) {
    evtSourceRef.current?.close()
    clientRef.current.clearPending()
    clientRef.current = makeClient()
    setStatus('loading')
    setVaultName(null)
    setNotes([])
    setSearchResults(null)
    setSelectedNote(null)

    const es = new EventSource(`http://localhost:${p}${SSE_PATH}`)
    evtSourceRef.current = es

    es.addEventListener('endpoint', async (e: MessageEvent) => {
      const endpointPath = (e.data as string).trim()
      clientRef.current.setPostUrl(`http://localhost:${p}${endpointPath}`)

      try {
        // MCP initialize handshake
        await clientRef.current.call('initialize', {
          protocolVersion: MCP_VERSION,
          capabilities: { roots: { listChanged: false }, sampling: {} },
          clientInfo: { name: 'claude-terminal', version: '1.0.0' },
        })
        clientRef.current.notify('notifications/initialized')

        // Discover available tools
        const toolsRes = await clientRef.current.call('tools/list') as { tools: Array<{ name: string }> }
        const tools = toolsRes.tools ?? []
        toolMapRef.current = buildToolMap(tools)

        // Fetch vault info if available
        if (toolMapRef.current.info) {
          try {
            const res = await clientRef.current.call('tools/call', { name: toolMapRef.current.info, arguments: {} }) as { content: Array<{ type: string; text: string }> }
            const text = res.content?.find(c => c.type === 'text')?.text ?? ''
            try {
              const parsed = JSON.parse(text)
              setVaultName(parsed.vault ?? parsed.name ?? text.slice(0, 40))
            } catch { setVaultName(text.slice(0, 40) || null) }
          } catch { /* vault name is optional */ }
        }

        setPort(p)
        setStatus('connected')
        void loadVaultNotes()
      } catch {
        setStatus('error')
      }
    })

    es.addEventListener('message', (e: MessageEvent) => {
      clientRef.current.onMessage(e.data as string)
    })

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus('error')
      }
    }
  }

  // ── Init: load port config, then connect ─────────────────────────────────

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await window.electronAPI.configGet() as { obsidianPort?: number }
        const p = cfg.obsidianPort ?? DEFAULT_PORT
        if (cancelled) return
        setPort(p)
        setPortInput(String(p))
        connect(p)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      evtSourceRef.current?.close()
      evtSourceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Vault operations ──────────────────────────────────────────────────────

  async function loadVaultNotes() {
    const toolName = toolMapRef.current.list
    if (!toolName) return
    try {
      const res = await clientRef.current.call('tools/call', { name: toolName, arguments: { path: '/' } }) as { content: Array<{ type: string; text: string }> }
      const text = res.content?.find(c => c.type === 'text')?.text ?? '[]'
      let files: string[] = []
      try {
        const parsed = JSON.parse(text)
        files = Array.isArray(parsed) ? parsed : (parsed.files ?? [])
      } catch {
        files = text.split('\n').map((s: string) => s.trim()).filter(Boolean)
      }
      setNotes(files.filter((f: string) => f.endsWith('.md')).slice(0, 100).map(toNote))
    } catch { /* non-critical */ }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const toolName = toolMapRef.current.search
    if (!toolName) { showMsg('Search not available for this plugin version', '#ef4444'); return }
    setSearching(true)
    try {
      const res = await clientRef.current.call('tools/call', {
        name: toolName,
        arguments: { query: searchQuery, limit: 20 },
      }) as { content: Array<{ type: string; text: string }> }
      const text = res.content?.find(c => c.type === 'text')?.text ?? '[]'
      let files: string[] = []
      try {
        const parsed = JSON.parse(text)
        files = Array.isArray(parsed)
          ? parsed.map((r: string | { path?: string; filename?: string }) =>
              typeof r === 'string' ? r : (r.path ?? r.filename ?? ''))
          : []
      } catch {
        files = text.split('\n').map((s: string) => s.trim()).filter(Boolean)
      }
      setSearchResults(files.filter(Boolean).map(toNote))
    } catch {
      setSearchResults([])
      showMsg('Search failed', '#ef4444')
    } finally {
      setSearching(false)
    }
  }

  async function openNote(notePath: string) {
    if (selectedNote?.path === notePath) { setSelectedNote(null); return }
    const toolName = toolMapRef.current.read
    if (!toolName) { showMsg('Read not available for this plugin version', '#ef4444'); return }
    setLoadingNote(true)
    try {
      const res = await clientRef.current.call('tools/call', {
        name: toolName,
        arguments: { path: notePath },
      }) as { content: Array<{ type: string; text: string }> }
      const content = res.content?.find(c => c.type === 'text')?.text ?? ''
      setSelectedNote({ path: notePath, content })
    } catch (e) {
      showMsg(`Cannot open: ${(e as Error).message}`, '#ef4444')
    } finally {
      setLoadingNote(false)
    }
  }

  function sendToClaude(content: string, name: string) {
    if (!ptyId) return
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

  async function handleSavePort() {
    const p = Math.max(1, Math.min(65535, Number(portInput) || DEFAULT_PORT))
    try {
      const cfg = await window.electronAPI.configGet() as object
      await window.electronAPI.configSet({ ...cfg, obsidianPort: p })
      connect(p)
    } catch (e) {
      showMsg(`Error: ${(e as Error).message}`, '#ef4444', 4000)
    }
  }

  // ─── RENDER: LOADING ──────────────────────────────────────────────────────

  if (status === 'loading') {
    return <Wrap><Msg>Connecting to Obsidian MCP…</Msg></Wrap>
  }

  // ─── RENDER: DISCONNECTED / ERROR ────────────────────────────────────────

  if (status === 'disconnected' || status === 'error') {
    return (
      <Wrap>
        <p style={{ margin: '0 0 8px', color: status === 'error' ? '#ef9a9a' : '#aaa', fontSize: 12, lineHeight: 1.6 }}>
          {status === 'error'
            ? '⚠ Cannot connect to Obsidian MCP plugin.'
            : 'Not connected to Obsidian.'}
        </p>
        <div style={{ fontSize: 11, color: '#666', lineHeight: 1.7, marginBottom: 12 }}>
          <strong style={{ color: '#e0c07a' }}>Setup:</strong><br />
          1. Open Obsidian → Community Plugins<br />
          2. Install <strong style={{ color: '#ddd' }}>obsidian-claude-code-mcp</strong><br />
          3. Enable the plugin (starts MCP server on port {DEFAULT_PORT})<br />
          4. Click Connect below
        </div>
        <label style={S.label}>Port (default: {DEFAULT_PORT})</label>
        <input
          style={S.input}
          type="number"
          value={portInput}
          onChange={e => setPortInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSavePort()}
          min={1}
          max={65535}
        />
        {msg && <div style={{ fontSize: 11, color: msg.color, marginTop: 6 }}>{msg.text}</div>}
        <button style={{ ...S.primaryBtn, marginTop: 12 }} onClick={handleSavePort}>
          Connect
        </button>
        {status === 'error' && (
          <button style={{ ...S.secondaryBtn, marginTop: 6 }} onClick={() => connect(port)}>
            ↻ Retry
          </button>
        )}
      </Wrap>
    )
  }

  // ─── RENDER: CONNECTED ────────────────────────────────────────────────────

  const displayNotes = searchResults ?? notes

  return (
    <Wrap>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green, #22c55e)', boxShadow: '0 0 4px #22c55e55', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 12 }}>Obsidian</span>
        {vaultName && <span style={{ color: '#e0c07a', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }} title={vaultName}>{vaultName}</span>}
        <button onClick={() => connect(port)} title="Reconnect" style={S.iconBtn}>↻</button>
        <button onClick={() => setStatus('disconnected')} title="Change port" style={{ ...S.iconBtn, marginLeft: 'auto' }}>⚙</button>
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
        <button style={S.primaryBtn} onClick={handleSearch} disabled={searching || !toolMapRef.current.search} title="Search">
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
          <Msg>{searchResults !== null ? 'No results' : 'No .md notes found'}</Msg>
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
                  {selectedNote.content.length > 3000 && '\n\n…(truncated)'}
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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

// ─── STYLES ──────────────────────────────────────────────────────────────────

const S = {
  label:        { fontSize: 11, color: '#777', marginBottom: 3, display: 'block' } as React.CSSProperties,
  input:        { padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #2a2a2a', background: '#111', color: '#ddd', outline: 'none', width: '100%', boxSizing: 'border-box' } as React.CSSProperties,
  primaryBtn:   { padding: '5px 10px', fontSize: 11, borderRadius: 4, border: '1px solid #f59e0b55', background: '#1a1500', color: '#f59e0b', cursor: 'pointer' } as React.CSSProperties,
  secondaryBtn: { padding: '5px 10px', fontSize: 11, borderRadius: 4, border: '1px solid #2a2a3a', background: '#12121e', color: '#8090b0', cursor: 'pointer' } as React.CSSProperties,
  tinyBtn:      { padding: '2px 5px', fontSize: 10, borderRadius: 3, border: '1px solid #2a2a3a', background: '#111', color: '#7090c0', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' } as React.CSSProperties,
  iconBtn:      { padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #2a2a2a', background: 'transparent', color: '#666', cursor: 'pointer' } as React.CSSProperties,
}
