import { describe, it, expect, beforeEach } from 'vitest'
import { useTabsStore } from '../store/tabs'

describe('TabsStore', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('addTab creates a tab with UUID id', () => {
    const id = useTabsStore.getState().addTab({ title: 'Test' })
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('addTab sets the new tab as active', () => {
    const id = useTabsStore.getState().addTab({ title: 'Test' })
    expect(useTabsStore.getState().activeTabId).toBe(id)
  })

  it('addTab creates tab with default values', () => {
    const id = useTabsStore.getState().addTab()
    const tab = useTabsStore.getState().tabs.find(t => t.id === id)!
    expect(tab.title).toBe('Local')
    expect(tab.ptyId).toBeNull()
    expect(tab.sshSessionId).toBeNull()
    expect(tab.tmuxEnabled).toBe(false)
    expect(tab.tmuxSessionName).toMatch(/^ct-[0-9a-f]{8}$/)
    expect(tab.status).toBe('idle')
  })

  it('removeTab removes and selects last remaining', () => {
    const id1 = useTabsStore.getState().addTab({ title: 'Tab1' })
    const id2 = useTabsStore.getState().addTab({ title: 'Tab2' })
    useTabsStore.getState().setActiveTab(id2)

    useTabsStore.getState().removeTab(id2)
    expect(useTabsStore.getState().tabs).toHaveLength(1)
    expect(useTabsStore.getState().activeTabId).toBe(id1)
  })

  it('removeTab sets activeTabId to null when all tabs removed', () => {
    const id = useTabsStore.getState().addTab({ title: 'Only' })
    useTabsStore.getState().removeTab(id)
    expect(useTabsStore.getState().tabs).toHaveLength(0)
    expect(useTabsStore.getState().activeTabId).toBeNull()
  })

  it('updateTab patches specific tab', () => {
    const id = useTabsStore.getState().addTab({ title: 'Before' })
    useTabsStore.getState().updateTab(id, { title: 'After', status: 'running' })
    const tab = useTabsStore.getState().tabs.find(t => t.id === id)!
    expect(tab.title).toBe('After')
    expect(tab.status).toBe('running')
  })

  it('setActiveTab changes active tab', () => {
    const id1 = useTabsStore.getState().addTab({ title: 'Tab1' })
    useTabsStore.getState().addTab({ title: 'Tab2' })
    useTabsStore.getState().setActiveTab(id1)
    expect(useTabsStore.getState().activeTabId).toBe(id1)
  })
})
