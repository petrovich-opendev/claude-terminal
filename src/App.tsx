import { useState, useEffect, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import ModeBar from './components/ModeBar'
import TabBar from './components/TabBar'
import Sidebar from './components/sidebar/Sidebar'
import Terminal from './components/Terminal'
import QuickCommands from './components/QuickCommands'
import StatusBar from './components/StatusBar'
import Settings from './components/Settings'
import FileEditor from './panels/FileEditor'
import { useConfigStore } from './store/config'
import styles from './App.module.css'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const { sidebarOpen, toggleSidebar } = useConfigStore()

  const handleFileSelect = (path: string) => {
    setSelectedFile(path)
    setRightPanelOpen(true)
  }

  const openSettings  = useCallback(() => setSettingsOpen(true),  [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') { e.preventDefault(); setSettingsOpen(s => !s) }
      if (e.metaKey && e.key === 'b') { e.preventDefault(); toggleSidebar() }
      if (e.metaKey && e.key === 'e') { e.preventDefault(); setRightPanelOpen(s => !s) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  return (
    <div className={styles.app}>
      <TitleBar onOpenSettings={openSettings} />
      <ModeBar />
      <div className={styles.main}>
        {/* Sidebar with CSS transition */}
        <div
          className={styles.sidebarWrap}
          style={{ width: sidebarOpen ? 'var(--sidebar-width, 260px)' : '0' }}
        >
          <Sidebar onFileSelect={handleFileSelect} />
        </div>

        <div className={styles.center}>
          <TabBar />
          <Terminal />
          <QuickCommands />
          <StatusBar />
        </div>

        {rightPanelOpen && selectedFile && (
          <FileEditor
            filePath={selectedFile}
            onClose={() => { setRightPanelOpen(false); setSelectedFile(null) }}
          />
        )}
      </div>

      {settingsOpen && <Settings onClose={closeSettings} />}
    </div>
  )
}
