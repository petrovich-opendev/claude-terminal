import { create } from 'zustand'

interface TerminalState {
  cwd: string
  uploadProgress: { file: string; percent: number } | null
  setCwd:             (cwd: string) => void
  setUploadProgress:  (p: { file: string; percent: number } | null) => void
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  cwd: '~',
  uploadProgress: null,
  setCwd:            (cwd) => set({ cwd }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
}))
