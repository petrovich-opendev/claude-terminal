import { describe, it, expect, beforeEach } from 'vitest'
import { useModesStore } from '../store/modes'
import { useCostStore } from '../store/cost'

describe('ModesStore', () => {
  beforeEach(() => {
    useModesStore.setState({ activeMode: 'coding', toolOverrides: {} })
  })

  it('defaults to coding mode', () => {
    expect(useModesStore.getState().activeMode).toBe('coding')
  })

  it('switches mode and resets overrides', () => {
    useModesStore.getState().toggleTool('Bash')
    expect(useModesStore.getState().toolOverrides.Bash).toBe(false)

    useModesStore.getState().setMode('reasoning')
    expect(useModesStore.getState().activeMode).toBe('reasoning')
    expect(useModesStore.getState().toolOverrides).toEqual({})
  })

  it('toggles tool override', () => {
    const store = useModesStore.getState()
    // Bash is true in coding mode
    store.toggleTool('Bash')
    expect(useModesStore.getState().toolOverrides.Bash).toBe(false)

    useModesStore.getState().toggleTool('Bash')
    expect(useModesStore.getState().toolOverrides.Bash).toBe(true)
  })

  it('resetTools clears overrides', () => {
    useModesStore.getState().toggleTool('Bash')
    useModesStore.getState().toggleTool('Edit')
    useModesStore.getState().resetTools()
    expect(useModesStore.getState().toolOverrides).toEqual({})
  })
})

describe('CostStore', () => {
  beforeEach(() => {
    useCostStore.setState({ current: null, history: [] })
  })

  it('starts with null current', () => {
    expect(useCostStore.getState().current).toBeNull()
  })

  it('updateCost creates current if null', () => {
    useCostStore.getState().updateCost({ inputTokens: 1000, outputTokens: 500 })
    const c = useCostStore.getState().current!
    expect(c).not.toBeNull()
    expect(c.inputTokens).toBe(1000)
    expect(c.outputTokens).toBe(500)
    expect(c.estimatedUSD).toBeGreaterThan(0)
    expect(c.updatedAt).toBeTruthy()
  })

  it('updateCost accumulates with existing', () => {
    useCostStore.getState().updateCost({ inputTokens: 1000 })
    useCostStore.getState().updateCost({ inputTokens: 2000 })
    expect(useCostStore.getState().current!.inputTokens).toBe(2000)
  })

  it('resetCurrent moves to history', () => {
    useCostStore.getState().updateCost({ inputTokens: 500 })
    useCostStore.getState().resetCurrent()
    expect(useCostStore.getState().current).toBeNull()
    expect(useCostStore.getState().history).toHaveLength(1)
  })

  it('resetCurrent does not add to history when current is null', () => {
    useCostStore.getState().resetCurrent()
    expect(useCostStore.getState().history).toHaveLength(0)
  })
})
