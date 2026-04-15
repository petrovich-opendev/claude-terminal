import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const FONT_FAMILIES = [
  '"JetBrains Mono", monospace',
  '"Cascadia Code", monospace',
  '"Fira Code", monospace',
  'Monaco, monospace',
  'Menlo, monospace',
] as const

interface ConfigState {
  sidebarOpen: boolean
  fontSize: number        // 10–20
  fontFamily: string
  lineHeight: number      // 1.0–1.6
  costAlertUSD: number
  contextAlertPct: number
  scrollback: number         // xterm scrollback lines
  obsidianPort: number       // Obsidian MCP port
  wordWrap: boolean          // Monaco word wrap
  readOnlyDefault: boolean   // Monaco read-only default

  toggleSidebar: () => void
  setSidebarOpen: (v: boolean) => void
  setFontSize: (v: number) => void
  setFontFamily: (v: string) => void
  setLineHeight: (v: number) => void
  setCostAlertUSD: (v: number) => void
  setContextAlertPct: (v: number) => void
  setScrollback: (v: number) => void
  setObsidianPort: (v: number) => void
  setWordWrap: (v: boolean) => void
  setReadOnlyDefault: (v: boolean) => void
}

export const useConfigStore = create<ConfigState>()(persist(
  (set) => ({
    sidebarOpen: true,
    fontSize: 13,
    fontFamily: '"JetBrains Mono", monospace',
    lineHeight: 1.2,
    costAlertUSD: 0.5,
    contextAlertPct: 70,
    scrollback: 10000,
    obsidianPort: 22360,
    wordWrap: false,
    readOnlyDefault: false,

    toggleSidebar:      () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebarOpen:     (v) => set({ sidebarOpen: v }),
    setFontSize:        (v) => set({ fontSize: Math.max(10, Math.min(20, v)) }),
    setFontFamily:      (v) => set({ fontFamily: v }),
    setLineHeight:      (v) => set({ lineHeight: Math.max(1.0, Math.min(1.6, v)) }),
    setCostAlertUSD:    (v) => set({ costAlertUSD: Math.max(0.1, v) }),
    setContextAlertPct: (v) => set({ contextAlertPct: Math.max(10, Math.min(99, v)) }),
    setScrollback:      (v) => set({ scrollback: Math.max(1000, Math.min(100000, v)) }),
    setObsidianPort:    (v) => set({ obsidianPort: Math.max(1, Math.min(65535, v)) }),
    setWordWrap:        (v) => set({ wordWrap: v }),
    setReadOnlyDefault: (v) => set({ readOnlyDefault: v }),
  }),
  { name: 'claude-terminal-config' }
))
