import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SSHSession } from '@/lib/models'

interface SessionsState {
  sessions: SSHSession[]
  activeSessionId: string | null
  addSession: (s: SSHSession) => void
  updateSession: (id: string, patch: Partial<SSHSession>) => void
  removeSession: (id: string) => void
  setActive: (id: string | null) => void
  /** Reorder two sessions in the same group (updates flat `sessions` order). */
  reorderInGroup: (fromId: string, toId: string) => void
}

export const useSessionsStore = create<SessionsState>()(persist(
  (set) => ({
    sessions: [],
    activeSessionId: null,
    addSession: (s) => set((state) => ({ sessions: [...state.sessions, s] })),
    updateSession: (id, patch) => set((state) => ({
      sessions: state.sessions.map((s) => s.id === id ? { ...s, ...patch } : s)
    })),
    removeSession: (id) => set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    })),
    setActive: (id) => set({ activeSessionId: id }),
    reorderInGroup: (fromId, toId) => set((state) => {
      const sessions = [...state.sessions]
      const iFrom = sessions.findIndex((s) => s.id === fromId)
      const iTo = sessions.findIndex((s) => s.id === toId)
      if (iFrom < 0 || iTo < 0) return state
      if (sessions[iFrom].group !== sessions[iTo].group) return state
      const [item] = sessions.splice(iFrom, 1)
      sessions.splice(iTo, 0, item)
      return { sessions }
    }),
  }),
  { name: 'claude-terminal-sessions' }
))
