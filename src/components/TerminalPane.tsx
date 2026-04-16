import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { useTabsStore } from '@/store/tabs'
import { useConfigStore } from '@/store/config'
import { useTerminalStore } from '@/store/terminal'
import { installXtermWheelScrollFix } from '@/lib/installXtermWheelScrollFix'

interface Props {
  tabId: string
  visible: boolean
}

export default function TerminalPane({ tabId, visible }: Props) {
  const updateTab     = useTabsStore(s => s.updateTab)
  const getTab        = () => useTabsStore.getState().tabs.find(t => t.id === tabId) ?? null
  const { fontSize, fontFamily, lineHeight } = useConfigStore()

  const containerRef    = useRef<HTMLDivElement>(null)
  const xtermRef        = useRef<XTerm | null>(null)
  const fitRef          = useRef<FitAddon | null>(null)
  const searchRef       = useRef<SearchAddon | null>(null)
  const ptyIdRef        = useRef<string | null>(null)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const searchInputRef  = useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [searchText, setSearchText]   = useState('')

  // ── Init xterm + PTY (once per tab) ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

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
      scrollSensitivity: 1,
      smoothScrollDuration: 0,
    })

    const fit = new FitAddon()
    const search = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.loadAddon(search)
    term.open(container)
    fit.fit()
    xtermRef.current  = term
    fitRef.current    = fit
    searchRef.current = search

    // Track whether user has scrolled away from bottom (used by onPtyData).
    let userScrolledUp = false
    const scrollSub = term.onScroll(() => {
      const b = term.buffer.active
      userScrolledUp = b.viewportY < b.baseY
    })

    const debugScroll =
      typeof localStorage !== 'undefined' && localStorage.getItem('claude-terminal:debugScroll') === '1'
    const disposeWheelFix = installXtermWheelScrollFix({
      term,
      container,
      getCellHeightPx: () =>
        Math.max(1, (term.options.fontSize ?? fontSize) * (term.options.lineHeight ?? lineHeight)),
      getScrollSensitivity: () => term.options.scrollSensitivity ?? 1,
      debugLog: debugScroll ? (msg) => console.info('[scroll]', msg) : undefined,
    })

    // Click on terminal → focus xterm so mouse selection and keyboard input work.
    const onPointerDown = () => term.focus()
    container.addEventListener('pointerdown', onPointerDown)

    // alive flag: prevents writing to a disposed terminal if component unmounts
    // before spawnPty() Promise resolves (B-2 race condition fix)
    let alive = true

    // T-1: Register onData BEFORE spawnPty to avoid losing first bytes.
    // ptyIdRef is null until PTY spawns, so writes are silently dropped until ready.
    // B-11: When user types, snap back to bottom and resume auto-scrolling.
    term.onData(d => {
      if (userScrolledUp) {
        userScrolledUp = false
        term.scrollToBottom()
      }
      if (ptyIdRef.current) window.electronAPI.ptyWrite(ptyIdRef.current, d)
    })

    const spawnPty = async () => {
      const { cols, rows } = term
      try {
        // U-3: Use real cwd from terminal store instead of hardcoded '~'
        const r = await window.electronAPI.ptyCreate({
          cols, rows,
          cwd: useTerminalStore.getState().cwd || '~',
          cmd: '/bin/zsh',
          args: [],
        })
        if (!alive) {
          // Component unmounted before PTY was ready — clean up immediately
          window.electronAPI.ptyDestroy(r.id).catch(() => {})
          return () => {}
        }
        ptyIdRef.current = r.id
        updateTab(tabId, { ptyId: r.id, status: 'running' })

        // Execute pending SSH connect command if this tab was opened for a session
        const pendingCmd = getTab()?.pendingCmd
        if (pendingCmd) {
          updateTab(tabId, { pendingCmd: null })
          // Small delay so the shell prompt is ready before injecting
          setTimeout(() => window.electronAPI.ptyWrite(r.id, pendingCmd).catch(() => {}), 300)
        }

        const offData = window.electronAPI.onPtyData(r.id, d => {
          if (!alive) return
          // B-11 follow-up: term.write() internally tracks the cursor and scrolls
          // the viewport to follow it — this overrides any manual scrollTop we set.
          // Fix: save scrollTop BEFORE write(), restore it AFTER if user scrolled up.
          const viewport = container.querySelector('.xterm-viewport') as HTMLElement | null
          const savedTop = userScrolledUp ? (viewport?.scrollTop ?? null) : null
          term.write(d)
          if (savedTop !== null && viewport) {
            viewport.scrollTop = savedTop
          } else if (!userScrolledUp) {
            term.scrollToBottom()
          }
        })
        const offExit = window.electronAPI.onPtyExit(r.id, () => {
          if (!alive) return
          updateTab(tabId, { status: 'exited', ptyId: null })
          term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
        })

        return () => { offData(); offExit() }
      } catch (e) {
        if (alive) {
          updateTab(tabId, { status: 'exited' })
          term.write(`\r\n\x1b[31m[Failed to start terminal: ${(e as Error).message}]\x1b[0m\r\n`)
        }
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
    ro.observe(container)

    return () => {
      alive = false
      scrollSub.dispose()
      disposeWheelFix()
      container?.removeEventListener('pointerdown', onPointerDown)
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

  // ── Cmd+F: SearchAddon UI overlay  /  Cmd+K: clear terminal ──────────────
  // Single listener per TerminalPane; only acts when this pane is visible.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!visibleRef.current) return
      if (e.metaKey && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(s => {
          if (!s) setTimeout(() => searchInputRef.current?.focus(), 50)
          return !s
        })
      }
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        xtermRef.current?.clear()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
      />
      {/* Search overlay — Cmd+F (U-1) */}
      {searchOpen && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: '#161622', border: '1px solid #2a2a40', borderRadius: 5, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
          <input
            ref={searchInputRef}
            value={searchText}
            onChange={e => {
              setSearchText(e.target.value)
              if (e.target.value) searchRef.current?.findNext(e.target.value, { caseSensitive: false })
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.shiftKey ? searchRef.current?.findPrevious(searchText, { caseSensitive: false }) : searchRef.current?.findNext(searchText, { caseSensitive: false }) }
              if (e.key === 'Escape') { setSearchOpen(false); setSearchText('') }
            }}
            placeholder="Search…"
            style={{ background: '#0d0d14', border: '1px solid #2a2a40', color: '#ddd', padding: '3px 7px', fontSize: 12, borderRadius: 3, outline: 'none', width: 180 }}
          />
          <button onClick={() => searchRef.current?.findPrevious(searchText, { caseSensitive: false })} style={S.srchBtn} title="Previous (⇧Enter)">↑</button>
          <button onClick={() => searchRef.current?.findNext(searchText, { caseSensitive: false })} style={S.srchBtn} title="Next (Enter)">↓</button>
          <button onClick={() => { setSearchOpen(false); setSearchText('') }} style={{ ...S.srchBtn, color: '#555' }} title="Close (Esc)">✕</button>
        </div>
      )}
    </div>
  )
}

const S = {
  srchBtn: { padding: '2px 7px', fontSize: 12, borderRadius: 3, border: '1px solid #2a2a40', background: '#0d0d14', color: '#8090b0', cursor: 'pointer' } as React.CSSProperties,
}
