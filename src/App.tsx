import { useState } from 'react'
import TitleBar from './components/TitleBar'
import ModeBar from './components/ModeBar'
import Sidebar from './components/sidebar/Sidebar'
import Terminal from './components/Terminal'
import QuickCommands from './components/QuickCommands'
import StatusBar from './components/StatusBar'
import FileEditor from './panels/FileEditor'
import styles from './App.module.css'

export default function App() {
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const handleFileSelect = (path: string) => {
    setSelectedFile(path)
    setRightPanelOpen(true)
  }

  const handleRightPanelClose = () => {
    setRightPanelOpen(false)
    setSelectedFile(null)
  }

  return (
    <div className={styles.app}>
      <TitleBar />
      <ModeBar />
      <div className={styles.main}>
        <Sidebar onFileSelect={handleFileSelect} />
        <div className={styles.center}>
          <Terminal />
          <QuickCommands />
          <StatusBar />
        </div>
        {rightPanelOpen && selectedFile && (
          <FileEditor filePath={selectedFile} onClose={handleRightPanelClose} />
        )}
      </div>
    </div>
  )
}
