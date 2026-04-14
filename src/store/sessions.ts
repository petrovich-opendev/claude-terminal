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
  }),
  { name: 'claude-terminal-sessions' }
))
