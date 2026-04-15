import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '../store/config'

describe('ConfigStore', () => {
  beforeEach(() => {
    useConfigStore.setState({
      sidebarOpen: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", monospace',
      lineHeight: 1.2,
      costAlertUSD: 0.5,
      contextAlertPct: 70,
    })
  })

  it('has correct defaults', () => {
    const s = useConfigStore.getState()
    expect(s.fontSize).toBe(13)
    expect(s.lineHeight).toBe(1.2)
    expect(s.sidebarOpen).toBe(true)
  })

  it('toggleSidebar flips open state', () => {
    useConfigStore.getState().toggleSidebar()
    expect(useConfigStore.getState().sidebarOpen).toBe(false)
    useConfigStore.getState().toggleSidebar()
    expect(useConfigStore.getState().sidebarOpen).toBe(true)
  })

  it('setFontSize clamps to 10-20', () => {
    useConfigStore.getState().setFontSize(5)
    expect(useConfigStore.getState().fontSize).toBe(10)

    useConfigStore.getState().setFontSize(25)
    expect(useConfigStore.getState().fontSize).toBe(20)

    useConfigStore.getState().setFontSize(16)
    expect(useConfigStore.getState().fontSize).toBe(16)
  })

  it('setLineHeight clamps to 1.0-1.6', () => {
    useConfigStore.getState().setLineHeight(0.5)
    expect(useConfigStore.getState().lineHeight).toBe(1.0)

    useConfigStore.getState().setLineHeight(3.0)
    expect(useConfigStore.getState().lineHeight).toBe(1.6)

    useConfigStore.getState().setLineHeight(1.4)
    expect(useConfigStore.getState().lineHeight).toBe(1.4)
  })

  it('setCostAlertUSD has minimum 0.1', () => {
    useConfigStore.getState().setCostAlertUSD(0.01)
    expect(useConfigStore.getState().costAlertUSD).toBe(0.1)
  })

  it('setContextAlertPct clamps to 10-99', () => {
    useConfigStore.getState().setContextAlertPct(5)
    expect(useConfigStore.getState().contextAlertPct).toBe(10)

    useConfigStore.getState().setContextAlertPct(150)
    expect(useConfigStore.getState().contextAlertPct).toBe(99)
  })
})
