import { create } from 'zustand'
import { MODES } from '@/lib/modes'
import type { ClaudeModeId, ClaudeMode } from '@/lib/models'

interface ModesState {
  activeMode: ClaudeModeId
  toolOverrides: Partial<ClaudeMode['tools']>
  setMode: (id: ClaudeModeId) => void
  toggleTool: (name: keyof ClaudeMode['tools']) => void
  resetTools: () => void
}

export const useModesStore = create<ModesState>()((set) => ({
  activeMode: 'coding',
  toolOverrides: {},
  setMode: (id) => set({ activeMode: id, toolOverrides: {} }),
  toggleTool: (name) => set((state) => {
    const baseTool = MODES[state.activeMode].tools[name]
    const current = state.toolOverrides[name] ?? baseTool
    return { toolOverrides: { ...state.toolOverrides, [name]: !current } }
  }),
  resetTools: () => set({ toolOverrides: {} }),
}))
