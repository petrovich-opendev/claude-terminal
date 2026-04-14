import { useState } from 'react'
import SSHPanel from './SSHPanel'
import FilesPanel from './FilesPanel'
import ToolsPanel from './ToolsPanel'
import MemoryPanel from './MemoryPanel'
import ObsidianPanel from './ObsidianPanel'

interface Props {
  onFileSelect: (path: string) => void
}

type TabId = 'ssh' | 'files' | 'tools' | 'memory' | 'obsidian'

interface Tab {
  id: TabId
  icon: string
  title: string
}

const TABS: Tab[] = [
  { id: 'ssh',      icon: '>_', title: 'SSH' },
  { id: 'files',    icon: '≡',  title: 'Files' },
  { id: 'tools',    icon: '⚙',  title: 'Tools' },
  { id: 'memory',   icon: '◉',  title: 'Memory' },
  { id: 'obsidian', icon: '◆',  title: 'Obsidian' },
]

export default function Sidebar({ onFileSelect }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('ssh')

  return (
    <div
      data-testid="sidebar"
      style={{
        width: 'var(--sidebar-width, 260px)',
        background: 'var(--p1, #1e1e1e)',
        borderRight: '1px solid var(--b1, #333)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--b1, #333)',
        background: 'var(--p2, #252526)',
        flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              title={tab.title}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '8px 0 6px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #f0c040' : '2px solid transparent',
                color: isActive ? '#f0c040' : '#888',
                cursor: 'pointer',
                fontSize: 14,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.icon}
            </button>
          )
        })}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'ssh'      && <SSHPanel />}
        {activeTab === 'files'    && <FilesPanel onFileSelect={onFileSelect} />}
        {activeTab === 'tools'    && <ToolsPanel />}
        {activeTab === 'memory'   && <MemoryPanel onFileSelect={onFileSelect} />}
        {activeTab === 'obsidian' && <ObsidianPanel />}
      </div>
    </div>
  )
}
