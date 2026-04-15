import { create } from 'zustand'

export interface TerminalTab {
  id: string
  title: string
  ptyId: string | null
  sshSessionId: string | null
  tmuxEnabled: boolean
  tmuxSessionName: string | null   // e.g. "ct-abc123"
  status: 'idle' | 'running' | 'exited'
  pendingCmd: string | null        // written to PTY once it starts, then cleared
}

interface TabsState {
  tabs: TerminalTab[]
  activeTabId: string | null

  addTab:       (override?: Partial<TerminalTab>) => string
  removeTab:    (id: string) => void
  setActiveTab: (id: string) => void
  updateTab:    (id: string, patch: Partial<TerminalTab>) => void
}

function makeTab(override: Partial<TerminalTab> = {}): TerminalTab {
  const id = crypto.randomUUID()
  const shortId = id.slice(0, 8)
  return {
    id,
    title: 'Local',
    ptyId: null,
    sshSessionId: null,
    tmuxEnabled: false,
    tmuxSessionName: `ct-${shortId}`,
    status: 'idle',
    pendingCmd: null,
    ...override,
  }
}

export const useTabsStore = create<TabsState>()((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (override = {}) => {
    const tab = makeTab(override)
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    return tab.id
  },

  removeTab: (id) => set(s => {
    const remaining = s.tabs.filter(t => t.id !== id)
    const nextActive = s.activeTabId === id
      ? (remaining[remaining.length - 1]?.id ?? null)
      : s.activeTabId
    return { tabs: remaining, activeTabId: nextActive }
  }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, patch) => set(s => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, ...patch } : t),
  })),
}))

// Convenience selectors
export const useActiveTab  = () => useTabsStore(s => s.tabs.find(t => t.id === s.activeTabId) ?? null)
export const useActivePtyId = () => useTabsStore(s => s.tabs.find(t => t.id === s.activeTabId)?.ptyId ?? null)
export const useActiveTabStatus = () => useTabsStore(s => s.tabs.find(t => t.id === s.activeTabId)?.status ?? 'idle')
