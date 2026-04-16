import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import {
  accumulatePixelsToScrollLineDelta,
  wheelEventPixelDelta,
  type WheelPixelAccum,
} from '@/lib/wheelXtermScroll'

type LabStats = {
  wheelEvents: number
  lastWheel: string
  bufType: string
  hasScrollback: boolean
  activeLineCount: number
  baseY: number
  viewportY: number
  /** Условие ветки xterm → ESC[A/B (история в shell). */
  xtermWouldEmitArrowHistory: boolean
  fixIntercepted: number
}

const initialStats: LabStats = {
  wheelEvents: 0,
  lastWheel: '—',
  bufType: 'normal',
  hasScrollback: false,
  activeLineCount: 0,
  baseY: 0,
  viewportY: 0,
  xtermWouldEmitArrowHistory: true,
  fixIntercepted: 0,
}

function randomLine(i: number): string {
  const noise = Math.random().toString(36).slice(2, 14)
  return `[${i.toString().padStart(5, '0')}] ${noise}  ${'█'.repeat((i % 40) + 1)}`
}

/** Минимальный доступ к ядру xterm для `hasScrollback` (публичный API это не отдаёт). */
type XtermCoreNormal = {
  _core?: {
    buffers?: {
      normal?: { hasScrollback: boolean }
    }
  }
}

/**
 * В типах `@xterm/xterm` у `term.buffer` нет `hasScrollback` — в лабе берём то же, что внутри xterm
 * (`Terminal.ts` ~808): флаг на **нормальном** буфере ядра. Fallback: длина буфера > числа строк окна.
 */
function readHasScrollback(term: XTerm): boolean {
  try {
    const normal = (term as unknown as XtermCoreNormal)._core?.buffers?.normal
    if (normal && typeof normal.hasScrollback === 'boolean') {
      return normal.hasScrollback
    }
  } catch {
    /* ignore */
  }
  const b = term.buffer.active
  return b.type === 'normal' && b.length > term.rows
}

function useInElectron(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as { electronAPI?: unknown }).electronAPI !== 'undefined'
}

export default function ScrollLabApp() {
  const inElectron = useInElectron()
  const wrapRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const [fixCapture, setFixCapture] = useState(true)
  const [linesPumped, setLinesPumped] = useState(0)
  const [stats, setStats] = useState<LabStats>(initialStats)
  const [log, setLog] = useState<string[]>([])

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-40), `${new Date().toISOString().slice(11, 23)} ${line}`])
  }, [])

  const refreshStats = useCallback((term: XTerm) => {
    const b = term.buffer.active
    const hasScrollback = readHasScrollback(term)
    const wouldArrows = b.type === 'normal' && !hasScrollback
    setStats((s) => ({
      ...s,
      bufType: String(b.type),
      hasScrollback,
      activeLineCount: b.length,
      baseY: b.baseY,
      viewportY: b.viewportY,
      xtermWouldEmitArrowHistory: wouldArrows,
    }))
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const term = new XTerm({
      fontFamily: 'Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#08080a',
        foreground: '#e8e8f0',
        cursor: '#f59e0b',
      },
      allowProposedApi: true,
      scrollback: 10000,
      scrollSensitivity: 1,
      smoothScrollDuration: 0,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    const container = document.createElement('div')
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.touchAction = 'none'
    wrap.appendChild(container)
    term.open(container)
    fit.fit()
    termRef.current = term

    const wheelAccum: WheelPixelAccum = { px: 0 }
    const fontSize = 13
    const lineHeight = 1.2

    /** Считает любое wheel, цель — внутри лабораторного терминала (до stopPropagation). */
    const onWindowWheelCapture = (ev: WheelEvent) => {
      if (!container.contains(ev.target as Node)) return
      setStats((s) => ({
        ...s,
        wheelEvents: s.wheelEvents + 1,
        lastWheel: `win-cap δy=${ev.deltaY.toFixed(2)} δMode=${ev.deltaMode} phase=${ev.eventPhase}`,
      }))
      refreshStats(term)
    }

    const onWheelCaptureFix = (ev: WheelEvent) => {
      if (!fixCapture) return
      if (ev.shiftKey) return
      if (term.buffer.active.type !== 'normal') return
      ev.preventDefault()
      ev.stopPropagation()
      const cell = Math.max(1, fontSize * lineHeight)
      const sens = term.options.scrollSensitivity ?? 1
      const px = wheelEventPixelDelta(ev, cell, term.rows, sens)
      const disp = accumulatePixelsToScrollLineDelta(wheelAccum, px, cell)
      if (disp !== 0) term.scrollLines(disp)
      setStats((s) => ({
        ...s,
        fixIntercepted: s.fixIntercepted + 1,
        lastWheel: `${s.lastWheel} → fix disp=${disp}`,
      }))
      refreshStats(term)
    }

    window.addEventListener('wheel', onWindowWheelCapture, { capture: true, passive: true })
    if (fixCapture) {
      container.addEventListener('wheel', onWheelCaptureFix, { capture: true, passive: false })
    }

    const ro = new ResizeObserver(() => {
      fit.fit()
      refreshStats(term)
    })
    ro.observe(wrap)

    const sub = term.onScroll(() => refreshStats(term))

    refreshStats(term)
    term.writeln('\x1b[33mScroll Lab\x1b[0m — колесо/трекпад. Метрики справа; «Копировать JSON» для отчёта.')
    term.writeln(`Окружение: ${inElectron ? '\x1b[32mElectron — npm run electron:scroll-lab\x1b[0m' : '\x1b[33mтолько браузер — npm run scroll-lab\x1b[0m'}`)
    term.writeln('«Мало строк» → \x1b[31mxtermWouldEmitArrowHistory = true\x1b[0m у vanilla xterm.')
    refreshStats(term)

    return () => {
      sub.dispose()
      ro.disconnect()
      window.removeEventListener('wheel', onWindowWheelCapture, { capture: true } as AddEventListenerOptions)
      container.removeEventListener('wheel', onWheelCaptureFix, { capture: true } as AddEventListenerOptions)
      term.dispose()
      wrap.removeChild(container)
      termRef.current = null
    }
  }, [fixCapture, refreshStats, inElectron])

  const pump = (n: number) => {
    const term = termRef.current
    if (!term) return
    for (let i = 0; i < n; i++) term.writeln(randomLine(linesPumped + i))
    setLinesPumped((x) => x + n)
    refreshStats(term)
    pushLog(`pump +${n} lines`)
  }

  const clearTerm = () => {
    const term = termRef.current
    if (!term) return
    term.clear()
    setLinesPumped(0)
    refreshStats(term)
    pushLog('clear()')
  }

  const copySnapshot = () => {
    const snap = {
      fixCapture,
      linesPumped,
      stats,
      logTail: log.slice(-15),
      ua: navigator.userAgent,
      note: 'xtermWouldEmitArrowHistory ≈ ветка !hasScrollback → ESC[A/B в PTY',
    }
    void navigator.clipboard.writeText(JSON.stringify(snap, null, 2))
    pushLog('snapshot → clipboard')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#c9cfe0' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '8px 12px', background: '#12121c', borderBottom: '1px solid #2a2a40', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <strong style={{ marginRight: 8 }}>Scroll Lab</strong>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: inElectron ? '#1e3a2f' : '#3a2a1e',
              color: inElectron ? '#86efac' : '#fcd34d',
            }}
          >
            {inElectron ? 'Electron + preload' : 'только браузер (Vite)'}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={fixCapture} onChange={(e) => setFixCapture(e.target.checked)} />
            Фикс: capture + scrollLines (как TerminalPane)
          </label>
          <button type="button" onClick={() => pump(30)}>+30 строк</button>
          <button type="button" onClick={() => pump(2000)}>+2000 строк</button>
          <button type="button" onClick={() => pump(3)}>Мало строк (3)</button>
          <button type="button" onClick={clearTerm}>Очистить</button>
          <button type="button" onClick={copySnapshot}>Копировать JSON</button>
        </div>
        <div ref={wrapRef} style={{ flex: 1, minHeight: 0 }} />
      </div>
      <aside style={{ width: 320, flexShrink: 0, background: '#0f0f18', borderLeft: '1px solid #2a2a40', padding: 12, fontSize: 12, overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>Метрики</h3>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 8px' }}>
          <dt>wheel (в терминале)</dt><dd>{stats.wheelEvents}</dd>
          <dt>перехватов фикса</dt><dd>{stats.fixIntercepted}</dd>
          <dt>buf type</dt><dd>{stats.bufType}</dd>
          <dt>hasScrollback</dt><dd style={{ color: stats.hasScrollback ? '#22c55e' : '#f87171' }}>{String(stats.hasScrollback)}</dd>
          <dt>active.length</dt><dd>{stats.activeLineCount}</dd>
          <dt>baseY / viewportY</dt><dd>{stats.baseY} / {stats.viewportY}</dd>
          <dt style={{ gridColumn: '1 / -1', marginTop: 6, fontWeight: 700, color: stats.xtermWouldEmitArrowHistory ? '#f87171' : '#22c55e' }}>
            xtermWouldEmitArrowHistory
          </dt>
          <dd style={{ gridColumn: '1 / -1', margin: 0 }}>{String(stats.xtermWouldEmitArrowHistory)} — true ⇒ vanilla xterm шлёт ESC[A/B</dd>
        </dl>
        <p style={{ margin: '8px 0 0', fontSize: 10, opacity: 0.75, lineHeight: 1.35 }}>
          hasScrollback читается из ядра xterm (<code style={{ fontSize: 10 }}>_core.buffers.normal</code>), не из публичного <code style={{ fontSize: 10 }}>term.buffer</code> — раньше из‑за этого было undefined и ложный «риск стрелок».
        </p>
        <p style={{ margin: '12px 0 4px', opacity: 0.85 }}>Последнее колесо</p>
        <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 11 }}>{stats.lastWheel}</code>
        <h3 style={{ margin: '16px 0 8px', fontSize: 13 }}>Лог</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 10, opacity: 0.9 }}>{log.join('\n')}</pre>
      </aside>
    </div>
  )
}
