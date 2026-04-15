import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { useTabsStore } from '@/store/tabs'
import { useConfigStore } from '@/store/config'

interface Props {
  tabId: string
  visible: boolean
}

export default function TerminalPane({ tabId, visible }: Props) {
  const updateTab     = useTabsStore(s => s.updateTab)
  const { fontSize, fontFamily, lineHeight } = useConfigStore()

  const containerRef  = useRef<HTMLDivElement>(null)
  const xtermRef      = useRef<XTerm | null>(null)
  const fitRef        = useRef<FitAddon | null>(null)
  const searchRef     = useRef<SearchAddon | null>(null)
  const ptyIdRef      = useRef<string | null>(null)

  // ── Init xterm + PTY (once per tab) ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      fontFamily,
      fontSize,
      lineHeight,
      theme: {
        background: '#08080a', foreground: '#e8e8f0', cursor: '#f59e0b',
        cursorAccent: '#000000', selectionBackground: 'rgba(245,158,11,0.2)',
        black: '#1c1c28', brightBlack: '#363650',
        red: '#ef4444',   brightRed: '#f87171',
        green: '#22c55e', brightGreen: '#4ade80',
        yellow: '#f59e0b', brightYellow: '#fcd34d',
        blue: '#60a5fa',  brightBlue: '#93c5fd',
        magenta: '#a78bfa', brightMagenta: '#c4b5fd',
        cyan: '#34d399',  brightCyan: '#6ee7b7',
        white: '#a0a0b8', brightWhite: '#e8e8f0',
      },
      allowProposedApi: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      scrollback: 10000,
      cursorBlink: true,
    })

    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(search)
    term.open(containerRef.current)
    fit.fit()
    xtermRef.current  = term
    fitRef.current    = fit
    searchRef.current = search

    const spawnPty = async () => {
      const { cols, rows } = term
      try {
        // NOTE: process.env is not available in renderer; pass ~ and let
        // the main process resolve HOME and SHELL via its own env.
        const r = await window.electronAPI.ptyCreate({
          cols, rows,
          cwd: '~',
          cmd: '/bin/zsh',
          args: [],
        })
        ptyIdRef.current = r.id
        updateTab(tabId, { ptyId: r.id, status: 'running' })

        const offData = window.electronAPI.onPtyData(r.id, d => {
          const atBottom = term.buffer.active.viewportY + term.rows >= term.buffer.active.length - 1
          term.write(d)
          if (atBottom) term.scrollToBottom()
        })
        const offExit = window.electronAPI.onPtyExit(r.id, () => {
          updateTab(tabId, { status: 'exited', ptyId: null })
          term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        })

        term.onData(d => {
          if (ptyIdRef.current) window.electronAPI.ptyWrite(ptyIdRef.current, d)
        })

        return () => { offData(); offExit() }
      } catch (e) {
        updateTab(tabId, { status: 'exited' })
        term.write(`\r\n\x1b[31m[Failed to start terminal: ${(e as Error).message}]\x1b[0m\r\n`)
        return () => {}
      }
    }

    const cleanupPty = spawnPty()

    const ro = new ResizeObserver(() => {
      fit.fit()
      if (ptyIdRef.current) {
        window.electronAPI.ptyResize(ptyIdRef.current, term.cols, term.rows).catch(() => {})
      }
    })
    ro.observe(containerRef.current)

    // Cmd+F search in terminal output
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault()
        const query = window.prompt('Search terminal output:')
        if (query && searchRef.current) {
          searchRef.current.findNext(query, { caseSensitive: false })
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      ro.disconnect()
      cleanupPty.then(off => off?.())
      if (ptyIdRef.current) window.electronAPI.ptyDestroy(ptyIdRef.current)
      term.dispose()
      updateTab(tabId, { ptyId: null, status: 'idle' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  // ── Live font/size update ─────────────────────────────────────────────────
  useEffect(() => {
    const term = xtermRef.current
    if (!term) return
    term.options.fontSize   = fontSize
    term.options.fontFamily = fontFamily
    term.options.lineHeight = lineHeight
    fitRef.current?.fit()
  }, [fontSize, fontFamily, lineHeight])

  // ── Re-fit when tab becomes visible ──────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Double rAF: first frame applies display:flex, second frame has final layout dimensions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitRef.current?.fit()
          if (ptyIdRef.current) {
            const term = xtermRef.current
            if (term) window.electronAPI.ptyResize(ptyIdRef.current, term.cols, term.rows).catch(() => {})
          }
        })
      })
    }
  }, [visible])

  return (
    <div
      style={{ display: visible ? 'flex' : 'none', flex: 1, overflow: 'hidden', position: 'relative' }}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
