import { useEffect } from 'react'
import { useTabsStore } from '@/store/tabs'
import TerminalPane from './TerminalPane'
import styles from './Terminal.module.css'

export default function Terminal() {
  const tabs        = useTabsStore(s => s.tabs)
  const activeTabId = useTabsStore(s => s.activeTabId)
  const addTab      = useTabsStore(s => s.addTab)

  // Ensure at least one tab exists on mount
  useEffect(() => {
    if (useTabsStore.getState().tabs.length === 0) {
      addTab({ title: 'Local' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.wrap}>
      {tabs.map(tab => (
        <TerminalPane
          key={tab.id}
          tabId={tab.id}
          visible={tab.id === activeTabId}
        />
      ))}
      {tabs.length === 0 && (
        <div className={styles.empty}>
          <span>No terminal sessions</span>
          <button className={styles.newBtn} onClick={() => addTab({ title: 'Local' })}>
            + New Session
          </button>
        </div>
      )}
    </div>
  )
}
