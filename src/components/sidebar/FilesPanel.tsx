import { useEffect, useState, useCallback } from 'react'
import { useTerminalStore } from '@/store/terminal'
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

export default function FilesPanel({ onFileSelect }: Props) {
  const { cwd, ptyId } = useTerminalStore()
  const [nodes, setNodes] = useState<FsNode[]>([])
  const [loading, setLoading] = useState(true)
  const [rootError, setRootError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setRootError(null)
    window.electronAPI.fsList(cwd).then((items) => {
      setNodes(mapItems(items))
      setLoading(false)
    }).catch((e: Error) => {
      setRootError(e?.message ?? 'Cannot read directory')
      setLoading(false)
    })
  }, [cwd])

  const toggleDir = useCallback(async (node: FsNode) => {
    if (!node.isDirectory) return
    if (node.expanded) {
      setNodes((prev) => updateNode(prev, node.path, { expanded: false, children: undefined }))
      return
    }
    try {
      const items = await window.electronAPI.fsList(node.path)
      const children = mapItems(items)
      setNodes((prev) => updateNode(prev, node.path, { expanded: true, children }))
    } catch(e) {
      // Mark node with error indicator
      setNodes((prev) => updateNode(prev, node.path, { expanded: false, children: [{
        name: `⚠ ${(e as Error).message ?? 'Permission denied'}`,
        path: node.path + '/__error__',
        isDirectory: false,
      }]}))
    }
  }, [])

  const explainFile = useCallback((node: FsNode) => {
    if (!ptyId || node.isDirectory) return
    window.electronAPI.ptyWrite(ptyId, `claude "Explain the code in ${node.name}"\r`).catch(() => {})
  }, [ptyId])

  return (
    <div className={styles.panel}>
      {loading && <div className={styles.loading}>Loading…</div>}
      {rootError && <div className={styles.rootError}>⚠ {rootError}</div>}
      {!loading && !rootError && nodes.length === 0 && (
        <div className={styles.empty}>Directory is empty</div>
      )}
      {!loading && !rootError && (
        <NodeList
          nodes={nodes}
          depth={0}
          onFileSelect={onFileSelect}
          onToggleDir={toggleDir}
          onExplain={explainFile}
        />
      )}
    </div>
  )
}

interface NodeListProps {
  nodes: FsNode[]
  depth: number
  onFileSelect: (path: string) => void
  onToggleDir: (node: FsNode) => void
  onExplain: (node: FsNode) => void
}

function NodeList({ nodes, depth, onFileSelect, onToggleDir, onExplain }: NodeListProps) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          <NodeRow
            node={node}
            depth={depth}
            onFileSelect={onFileSelect}
            onToggleDir={onToggleDir}
            onExplain={onExplain}
          />
          {node.expanded && node.children && (
            <NodeList
              nodes={node.children}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              onToggleDir={onToggleDir}
              onExplain={onExplain}
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
  onFileSelect: (path: string) => void
  onToggleDir: (node: FsNode) => void
  onExplain: (node: FsNode) => void
}

function NodeRow({ node, depth, onFileSelect, onToggleDir, onExplain }: NodeRowProps) {
  const [hovered, setHovered] = useState(false)

  const handleClick = () => {
    if (node.isDirectory) {
      onToggleDir(node)
    } else {
      onFileSelect(node.path)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!node.isDirectory) onExplain(node)
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
          title="Explain with Claude"
        >
          ?
        </button>
      )}
    </div>
  )
}
