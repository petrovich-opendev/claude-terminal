import { useSessionsStore } from '@/store/sessions'
import { useModesStore } from '@/store/modes'
import { useConfigStore } from '@/store/config'
import { MODES } from '@/lib/modes'
import styles from './TitleBar.module.css'

interface Props {
  onOpenSettings: () => void
}

export default function TitleBar({ onOpenSettings }: Props) {
  const activeId = useSessionsStore(s => s.activeSessionId)
  const sessions = useSessionsStore(s => s.sessions)
  const session  = sessions.find(s => s.id === activeId)
  const modeId   = useModesStore(s => s.activeMode)
  const mode     = MODES[modeId]
  const { sidebarOpen, toggleSidebar } = useConfigStore()

  return (
    <div className={styles.bar}>
      <div className={styles.lights}>
        <span className={`${styles.tl} ${styles.r}`}/>
        <span className={`${styles.tl} ${styles.y}`}/>
        <span className={`${styles.tl} ${styles.g}`}/>
      </div>

      <button
        className={styles.iconBtn}
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Collapse sidebar (⌘B)' : 'Expand sidebar (⌘B)'}
      >
        {sidebarOpen ? '‹' : '›'}
      </button>

      <div className={styles.center}>
        <span className={styles.name}>CLAUDE TERMINAL</span>
        <span className={styles.dot}>·</span>
        <span className={styles.brand}>agentdata.pro</span>
        {session && <>
          <span className={styles.dot}>·</span>
          <span className={styles.session}>{session.name}</span>
        </>}
      </div>

      <div className={styles.right}>
        <span className={styles.badge} style={{ borderColor: mode.color, color: mode.color }}>
          {mode.icon} {mode.label}
        </span>
        <button
          className={styles.iconBtn}
          onClick={onOpenSettings}
          title="Settings (⌘,)"
        >⚙</button>
      </div>
    </div>
  )
}
