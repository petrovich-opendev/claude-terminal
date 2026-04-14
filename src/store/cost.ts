import { create } from 'zustand'
import { calcCostUSD } from '@/lib/pricing'
import type { SessionCost } from '@/lib/models'

interface CostState {
  current: SessionCost | null
  history: SessionCost[]
  updateCost: (patch: Partial<Omit<SessionCost, 'estimatedUSD'>>) => void
  resetCurrent: () => void
}

const EMPTY: Omit<SessionCost, 'estimatedUSD' | 'updatedAt'> = {
  sessionId: '',
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  model: 'claude-sonnet-4-6',
}

export const useCostStore = create<CostState>()((set) => ({
  current: null,
  history: [],
  updateCost: (patch) => set((state) => {
    const prev = state.current ?? { ...EMPTY, estimatedUSD: 0, updatedAt: '' }
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() }
    next.estimatedUSD = calcCostUSD(
      next.inputTokens, next.outputTokens,
      next.cacheReadTokens, next.cacheWriteTokens,
      next.model
    )
    return { current: next }
  }),
  resetCurrent: () => set((state) => ({
    history: state.current ? [...state.history, state.current] : state.history,
    current: null,
  })),
}))
