import { useTabsStore } from '@/store/tabs'
import styles from './TabBar.module.css'

export default function TabBar() {
  const tabs        = useTabsStore(s => s.tabs)
  const activeTabId = useTabsStore(s => s.activeTabId)
  const addTab      = useTabsStore(s => s.addTab)
  const removeTab   = useTabsStore(s => s.removeTab)
  const setActiveTab = useTabsStore(s => s.setActiveTab)

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeTab(id)
  }

  return (
    <div className={styles.bar}>
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.tmuxEnabled ? `tmux: ${tab.tmuxSessionName}` : tab.title}
          >
            <span className={`${styles.dot} ${styles[tab.status]}`} />
            <span className={styles.title}>{tab.title}</span>
            {tab.tmuxEnabled && <span className={styles.tmuxBadge}>tmux</span>}
            <button
              className={styles.close}
              onClick={e => handleClose(e, tab.id)}
              title="Close tab"
            >×</button>
          </div>
        ))}
      </div>
      <button
        className={styles.add}
        onClick={() => addTab({ title: 'Local' })}
        title="New terminal tab"
      >+</button>
    </div>
  )
}
