import { useEffect, useState, useCallback, useRef } from 'react'
import { useTerminalStore } from '@/store/terminal'
import { useSessionsStore } from '@/store/sessions'
import { useActivePtyId } from '@/store/tabs'
import styles from './FilesPanel.module.css'

interface Props {
  onFileSelect: (path: string) => void
}

interface FsNode {
  name: string
  path: string
  isDirectory: boolean
  extension?: string
  children?: FsNode[]
  expanded?: boolean
}

const EXT_ICONS: Record<string, string> = {
  ts:   '{}',
  tsx:  '{}',
  py:   'py',
  md:   '#',
  json: '{}',
  css:  '~',
  sh:   '$',
}

function getFileIcon(node: FsNode): string {
  if (node.isDirectory) return node.expanded ? '▼' : '▶'
  const ext = (node.extension ?? '').replace(/^\./, '')
  return EXT_ICONS[ext] ?? '·'
}

function updateNode(nodes: FsNode[], path: string, patch: Partial<FsNode>): FsNode[] {
  return nodes.map((n) => {
    if (n.path === path) return { ...n, ...patch }
    if (n.children) return { ...n, children: updateNode(n.children, path, patch) }
    return n
  })
}

function mapItems(
  items: Array<{ name: string; path: string; isDirectory: boolean; extension?: string }>
): FsNode[] {
  return items.map((item) => ({
    name: item.name,
    path: item.path,
    isDirectory: item.isDirectory,
    extension: item.extension,
    expanded: false,
  }))
}

function parentPath(p: string, isRemote: boolean): string {
  if (isRemote) {
    const parts = p.replace(/\/$/, '').split('/')
    if (parts.length <= 2) return '/'
    return parts.slice(0, -1).join('/') || '/'
  }
  const idx = p.replace(/\/$/, '').lastIndexOf('/')
  return idx > 0 ? p.slice(0, idx) : '/'
}

interface CtxMenuState { x: number; y: number; node: FsNode }

export default function FilesPanel({ onFileSelect }: Props) {
  const cwd   = useTerminalStore(s => s.cwd)
  const ptyId = useActivePtyId()
  const { sessions, activeSessionId, setActive } = useSessionsStore()

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxMenu !== null])
  const activeSession = activeSessionId ? sessions.find(s => s.id === activeSessionId) ?? null : null
  const isSSH = activeSession !== null

  // Remote path state (SSH mode only)
  const [remotePath, setRemotePath] = useState<string>('~')
  const [pathInput, setPathInput]   = useState<string>('~')
  const [flashMsg, setFlashMsg]     = useState<string | null>(null)
  const pathInputRef = useRef<HTMLInputElement>(null)

  // Reset remote path when SSH session changes
  const prevSessionId = useRef<string | null>(null)
  useEffect(() => {
    if (activeSessionId !== prevSessionId.current) {
      prevSessionId.current = activeSessionId
      if (activeSessionId) {
        setRemotePath('~')
        setPathInput('~')
      }
    }
  }, [activeSessionId])

  const currentPath = isSSH ? remotePath : cwd

  // Upload state (SSH only)
  const [uploadProgress, setUploadProgress] = useState<{ file: string; percent: number } | null>(null)
  const [uploadError, setUploadError]       = useState<string | null>(null)
  const [isDragOver, setIsDragOver]         = useState(false)
  const dragCounterRef = useRef(0)

  useEffect(() => {
    if (!isSSH) return
    const off = window.electronAPI.onSftpProgress(p => {
      setUploadProgress(p)
      if (p.percent >= 100) setTimeout(() => setUploadProgress(null), 1500)
    })
    return off
  }, [isSSH])

  const uploadFiles = useCallback(async (localPaths: string[]) => {
    if (!activeSessionId || !localPaths.length) return
    setUploadError(null)
    try {
      await window.electronAPI.sftpUpload(activeSessionId, localPaths, remotePath)
    } catch (e) {
      setUploadError((e as Error).message ?? 'Upload failed')
      setTimeout(() => setUploadError(null), 4000)
    }
  }, [activeSessionId, remotePath])

  const handlePickUpload = useCallback(async () => {
    const paths = await window.electronAPI.fsPickFiles().catch(() => [] as string[])
    await uploadFiles(paths)
  }, [uploadFiles])

  const handlePanelDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (isSSH) setIsDragOver(true)
  }, [isSSH])

  const handlePanelDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [])

  const handlePanelDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    if (!isSSH) return
    const paths = Array.from(e.dataTransfer.files)
      .map((f: File & { path?: string }) => f.path ?? '')
      .filter(Boolean)
    await uploadFiles(paths)
  }, [isSSH, uploadFiles])

  const [nodes, setNodes]       = useState<FsNode[]>([])
  const [loading, setLoading]   = useState(true)
  const [rootError, setRootError] = useState<string | null>(null)

  const listDir = useCallback((dir: string): Promise<Array<{name:string;path:string;isDirectory:boolean;extension?:string}>> => {
    if (isSSH && activeSessionId) {
      return window.electronAPI.sftpList(activeSessionId, dir)
        .catch((err: Error) => {
          // If SFTP fails due to session issues — reset active session so user
          // is not stuck, and re-throw with the actual session ID in the message
          if (err.message.includes('Invalid session ID') || err.message.includes('Session not found')) {
            setActive(null)
          }
          throw new Error(`SFTP error (sessionId=${JSON.stringify(activeSessionId)}): ${err.message}`)
        })
    }
    return window.electronAPI.fsList(dir)
  }, [isSSH, activeSessionId, setActive])

  useEffect(() => {
    setLoading(true)
    setRootError(null)
    setNodes([])
    listDir(currentPath).then((items) => {
      setNodes(mapItems(items))
      setLoading(false)
    }).catch((e: Error) => {
      setRootError(e?.message ?? 'Cannot read directory')
      setLoading(false)
    })
  }, [currentPath, listDir])

  const navigateTo = useCallback((p: string) => {
    setRemotePath(p)
    setPathInput(p)
    setTimeout(() => pathInputRef.current?.focus(), 0)
  }, [])

  const handlePathSubmit = useCallback(() => {
    const p = pathInput.trim()
    if (p) {
      if (isSSH) navigateTo(p)
      else useTerminalStore.getState().setCwd(p)
    }
  }, [pathInput, isSSH, navigateTo])

  const handleGoUp = useCallback(() => {
    const up = parentPath(currentPath, isSSH)
    if (isSSH) navigateTo(up)
    else useTerminalStore.getState().setCwd(up)
  }, [currentPath, isSSH, navigateTo])

  const toggleDir = useCallback(async (node: FsNode) => {
    if (!node.isDirectory) return
    if (node.expanded) {
      setNodes((prev) => updateNode(prev, node.path, { expanded: false, children: undefined }))
      return
    }
    try {
      const items = await listDir(node.path)
      const children = mapItems(items)
      setNodes((prev) => updateNode(prev, node.path, { expanded: true, children }))
    } catch(e) {
      setNodes((prev) => updateNode(prev, node.path, { expanded: false, children: [{
        name: `⚠ ${(e as Error).message ?? 'Permission denied'}`,
        path: node.path + '/__error__',
        isDirectory: false,
      }]}))
    }
  }, [listDir])

  const handleFileSelect = useCallback((node: FsNode) => {
    if (isSSH) {
      if (ptyId) {
        window.electronAPI.ptyWrite(ptyId, `claude "Explain the code in ${node.path}"\r`).catch(() => {})
        setFlashMsg(`→ Claude: ${node.name}`)
        setTimeout(() => setFlashMsg(null), 2500)
      }
    } else {
      onFileSelect(node.path)
    }
  }, [isSSH, ptyId, onFileSelect])

  const explainFile = useCallback((node: FsNode) => {
    if (!ptyId || node.isDirectory) return
    const cmd = isSSH
      ? `claude "Explain the code in ${node.path}"\r`
      : `claude "Explain the code in ${node.name}"\r`
    window.electronAPI.ptyWrite(ptyId, cmd).catch(() => {})
  }, [ptyId, isSSH])

  return (
    <div
      className={styles.panel}
      onDragEnter={handlePanelDragEnter}
      onDragLeave={handlePanelDragLeave}
      onDragOver={e => e.preventDefault()}
      onDrop={handlePanelDrop}
    >
      {isDragOver && isSSH && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropOverlayInner}>
            <span className={styles.dropIcon}>⬆</span>
            <span>Drop to upload</span>
            <span className={styles.dropDest}>{remotePath}</span>
          </div>
        </div>
      )}
      {/* Path navigation bar */}
      <div className={styles.pathBar}>
        <button
          className={styles.upBtn}
          onClick={handleGoUp}
          title="Go to parent directory"
        >↑</button>
        <input
          ref={pathInputRef}
          className={styles.pathInput}
          value={pathInput}
          onChange={e => setPathInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handlePathSubmit() }}
          onBlur={() => setPathInput(currentPath)}
          title={isSSH ? `Remote: ${currentPath}` : currentPath}
          spellCheck={false}
        />
        <button
          className={styles.goBtn}
          onClick={handlePathSubmit}
          title="Navigate to path"
        >→</button>
        {isSSH && (
          <span className={styles.sshBadge} title={`${activeSession.user}@${activeSession.host}`}>
            {activeSession.name}
          </span>
        )}
      </div>

      {isSSH && (
        <div className={styles.uploadBar}>
          <button className={styles.uploadBtn} onClick={handlePickUpload} title="Select files to upload to current folder">
            ⬆ Upload to {remotePath}
          </button>
        </div>
      )}
      {uploadProgress && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${uploadProgress.percent}%` }} />
          <span className={styles.progressLabel}>{uploadProgress.file} {uploadProgress.percent}%</span>
        </div>
      )}
      {uploadError && <div className={styles.uploadError}>⚠ {uploadError}</div>}
      {flashMsg && <div className={styles.flashMsg}>{flashMsg}</div>}
      {loading && <div className={styles.loading}>Loading…</div>}
      {rootError && <div className={styles.rootError}>⚠ {rootError}</div>}
      {!loading && !rootError && nodes.length === 0 && (
        <div className={styles.empty}>Directory is empty</div>
      )}
      {!loading && !rootError && (
        <NodeList
          nodes={nodes}
          depth={0}
          isSSH={isSSH}
          onFileSelect={handleFileSelect}
          onToggleDir={toggleDir}
          onExplain={explainFile}
          onContextMenu={(x, y, node) => setCtxMenu({ x, y, node })}
        />
      )}
      {ctxMenu && (
        <div
          style={{ position:'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex:1000,
            background:'#161622', border:'1px solid #2a2a40', borderRadius:6,
            boxShadow:'0 4px 20px rgba(0,0,0,.7)', padding:'4px 0', minWidth:160 }}
          onMouseDown={e => e.stopPropagation()}
        >
          {!ctxMenu.node.isDirectory && (
            <CtxItem onClick={() => { handleFileSelect(ctxMenu.node); setCtxMenu(null) }}>Open</CtxItem>
          )}
          <CtxItem onClick={() => { navigator.clipboard.writeText(ctxMenu.node.path).catch(()=>{}); setCtxMenu(null) }}>Copy path</CtxItem>
          {!ctxMenu.node.isDirectory && ptyId && (
            <CtxItem onClick={() => { explainFile(ctxMenu.node); setCtxMenu(null) }}>Ask Claude</CtxItem>
          )}
        </div>
      )}
    </div>
  )
}

interface NodeListProps {
  nodes: FsNode[]
  depth: number
  isSSH: boolean
  onFileSelect: (node: FsNode) => void
  onToggleDir: (node: FsNode) => void
  onExplain: (node: FsNode) => void
  onContextMenu: (x: number, y: number, node: FsNode) => void
}

function NodeList({ nodes, depth, isSSH, onFileSelect, onToggleDir, onExplain, onContextMenu }: NodeListProps) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          <NodeRow
            node={node}
            depth={depth}
            isSSH={isSSH}
            onFileSelect={onFileSelect}
            onToggleDir={onToggleDir}
            onExplain={onExplain}
            onContextMenu={onContextMenu}
          />
          {node.expanded && node.children && (
            <NodeList
              nodes={node.children}
              depth={depth + 1}
              isSSH={isSSH}
              onFileSelect={onFileSelect}
              onToggleDir={onToggleDir}
              onExplain={onExplain}
              onContextMenu={onContextMenu}
            />
          )}
        </div>
      ))}
    </>
  )
}

interface NodeRowProps {
  node: FsNode
  depth: number
  isSSH: boolean
  onFileSelect: (node: FsNode) => void
  onToggleDir: (node: FsNode) => void
  onExplain: (node: FsNode) => void
  onContextMenu: (x: number, y: number, node: FsNode) => void
}

function NodeRow({ node, depth, isSSH, onFileSelect, onToggleDir, onExplain, onContextMenu }: NodeRowProps) {
  const [hovered, setHovered] = useState(false)

  const handleClick = () => {
    if (node.isDirectory) {
      onToggleDir(node)
    } else {
      onFileSelect(node)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu(e.clientX, e.clientY, node)
  }

  return (
    <div
      className={`${styles.row} ${node.isDirectory ? styles.dir : styles.file}`}
      style={{ paddingLeft: 10 + depth * 14 }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={node.path}
    >
      <span className={styles.icon}>{getFileIcon(node)}</span>
      <span className={styles.name}>{node.name}</span>
      {hovered && !node.isDirectory && (
        <button
          className={styles.explainBtn}
          onClick={(e) => { e.stopPropagation(); onExplain(node) }}
          title={isSSH ? 'Ask Claude about this file' : 'Explain with Claude'}
        >
          ?
        </button>
      )}
    </div>
  )
}

function CtxItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ padding:'6px 16px', fontSize:12, color:'#ccc', cursor:'pointer', whiteSpace:'nowrap' }}
      onMouseEnter={e => (e.currentTarget.style.background='#1e2a3a')}
      onMouseLeave={e => (e.currentTarget.style.background='transparent')}
    >
      {children}
    </div>
  )
}
