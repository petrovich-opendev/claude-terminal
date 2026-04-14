import { useEffect, useRef, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useActivePtyId } from '@/store/tabs'

interface Props {
  filePath: string
  onClose: () => void
}

/** Track whether editor content has been modified since last save/load */

type AskClaudeAction = 'explain' | 'refactor' | 'tests' | 'fixbugs'

const ASK_CLAUDE_ACTIONS: { value: AskClaudeAction; label: string }[] = [
  { value: 'explain',  label: 'Explain' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'tests',    label: 'Write tests' },
  { value: 'fixbugs',  label: 'Fix bugs' },
]

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'ts':   return 'typescript'
    case 'tsx':  return 'typescript'
    case 'js':   return 'javascript'
    case 'jsx':  return 'javascript'
    case 'py':   return 'python'
    case 'rs':   return 'rust'
    case 'json': return 'json'
    case 'md':   return 'markdown'
    case 'css':  return 'css'
    case 'html': return 'html'
    case 'yml':  case 'yaml': return 'yaml'
    case 'toml': return 'ini'
    case 'sh':   case 'bash': case 'zsh': return 'shell'
    case 'sql':  return 'sql'
    default:     return 'plaintext'
  }
}

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

export default function FileEditor({ filePath, onClose }: Props) {
  const [content, setContent]     = useState<string>('')
  const [savedContent, setSavedContent] = useState<string>('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [readOnly, setReadOnly]   = useState(true)
  const [saved, setSaved]         = useState(false)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const ptyId = useActivePtyId()

  const isDirty = !readOnly && content !== savedContent

  /** Close with unsaved-changes guard */
  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Close anyway?')) return
    }
    onClose()
  }, [isDirty, onClose])

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electronAPI.fsRead(filePath)
      .then((data: string) => {
        setContent(data)
        setSavedContent(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err?.message ?? 'Failed to read file')
        setLoading(false)
      })
  }, [filePath])

  const handleSave = useCallback(async () => {
    if (readOnly) return
    const value = editorRef.current?.getValue() ?? content
    try {
      await window.electronAPI.fsWrite(filePath, value)
      setSavedContent(value)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to save file')
    }
  }, [readOnly, content, filePath])

  // Cmd+S / Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleAskClaude = (action: AskClaudeAction) => {
    if (!ptyId) return
    const name = basename(filePath)
    const commands: Record<AskClaudeAction, string> = {
      explain:  `claude "Explain the file ${filePath}"\r`,
      refactor: `claude "Refactor ${filePath} for readability and maintainability"\r`,
      tests:    `claude "Write tests for ${name}"\r`,
      fixbugs:  `claude "Find and fix bugs in ${filePath}"\r`,
    }
    window.electronAPI.ptyWrite(ptyId, commands[action]).catch(() => {})
  }

  const language = detectLanguage(filePath)
  const name = basename(filePath)

  return (
    <div
      data-testid="file-editor"
      style={{
        width: 'var(--right-panel-width, 480px)',
        background: 'var(--p1, #1e1e1e)',
        borderLeft: '1px solid var(--b1, #333)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderBottom: '1px solid var(--b1, #333)',
        background: 'var(--p2, #252526)',
        flexShrink: 0,
        minHeight: 36,
      }}>
        <span style={{ flex: 1, fontSize: 13, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={filePath}>
          {isDirty ? '\u25cf ' : ''}{name}
        </span>

        {/* Read/Write toggle */}
        <button
          onClick={() => setReadOnly(ro => !ro)}
          title={readOnly ? 'Switch to write mode' : 'Switch to read-only mode'}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            borderRadius: 4,
            border: '1px solid',
            cursor: 'pointer',
            background: readOnly ? '#2a2a2a' : '#1a3a1a',
            color: readOnly ? '#888' : '#6fcf6f',
            borderColor: readOnly ? '#444' : '#4a8a4a',
          }}
        >
          {readOnly ? 'Read' : 'Write'}
        </button>

        {/* Ask Claude dropdown */}
        <select
          onChange={e => { if (e.target.value) { handleAskClaude(e.target.value as AskClaudeAction); e.target.value = '' } }}
          defaultValue=""
          disabled={!ptyId}
          title={ptyId ? 'Ask Claude about this file' : 'No active terminal session'}
          style={{
            padding: '2px 6px',
            fontSize: 11,
            borderRadius: 4,
            border: '1px solid #555',
            background: '#2a2a2a',
            color: ptyId ? '#f0c040' : '#555',
            cursor: ptyId ? 'pointer' : 'not-allowed',
            opacity: ptyId ? 1 : 0.5,
          }}
        >
          <option value="" disabled>Ask Claude…</option>
          {ASK_CLAUDE_ACTIONS.map(a => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        {saved && (
          <span style={{ fontSize: 11, color: '#6fcf6f' }}>Saved</span>
        )}

        {/* Close */}
        <button
          onClick={handleClose}
          title="Close"
          style={{
            background: 'none',
            border: 'none',
            color: '#aaa',
            fontSize: 16,
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          &#x2715;
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#888', fontSize: 13,
          }}>
            Loading…
          </div>
        )}

        {error && !loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#e57373', fontSize: 13, padding: 16, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <Editor
            height="100%"
            language={language}
            value={content}
            theme="vs-dark"
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              renderWhitespace: 'none',
            }}
            onMount={(editor) => { editorRef.current = editor }}
            onChange={(val) => { if (!readOnly) setContent(val ?? '') }}
          />
        )}
      </div>
    </div>
  )
}
