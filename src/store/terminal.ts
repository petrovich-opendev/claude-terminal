import { create } from 'zustand'

type PtyStatus = 'idle' | 'running' | 'exited'

interface TerminalState {
  ptyId: string | null
  status: PtyStatus
  cwd: string
  uploadProgress: { file: string; percent: number } | null
  setPtyId: (id: string | null) => void
  setStatus: (s: PtyStatus) => void
  setCwd: (cwd: string) => void
  setUploadProgress: (p: { file: string; percent: number } | null) => void
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  ptyId: null,
  status: 'idle',
  cwd: '~',
  uploadProgress: null,
  setPtyId: (id) => set({ ptyId: id }),
  setStatus: (status) => set({ status }),
  setCwd: (cwd) => set({ cwd }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
}))
