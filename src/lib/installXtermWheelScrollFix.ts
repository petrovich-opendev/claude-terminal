import type { Terminal } from '@xterm/xterm'
import {
  accumulatePixelsToScrollLineDelta,
  wheelEventPixelDelta,
  wheelPointerOverContainer,
  type WheelPixelAccum,
} from '@/lib/wheelXtermScroll'

export type XtermWheelScrollFixParams = {
  term: Terminal
  container: HTMLElement
  getCellHeightPx: () => number
  getScrollSensitivity: () => number
  /** optional: localStorage `claude-terminal:debugScroll=1` */
  debugLog?: (msg: string) => void
}

/**
 * xterm.js (Terminal.ts ~800): при `!buffer.hasScrollback` колесо превращается в ESC [ A/B →
 * история в shell. Перехватываем в три слоя: window (до всех), container capture (до xterm),
 * attachCustomWheelEventHandler (до ветки ESC внутри xterm).
 * Custom handler для normal buffer не использует hit-test: если событие дошло до xterm, мы
 * обязаны его съесть, иначе снова сработает ветка «история».
 */
export function installXtermWheelScrollFix(p: XtermWheelScrollFixParams): () => void {
  const { term, container, getCellHeightPx, getScrollSensitivity, debugLog } = p
  const wheelAccum: WheelPixelAccum = { px: 0 }

  const scrollFromWheel = (ev: WheelEvent, src: string) => {
    const marked = ev as WheelEvent & { __ctWheelDone?: boolean }
    if (marked.__ctWheelDone) return
    marked.__ctWheelDone = true

    const cell = Math.max(1, getCellHeightPx())
    const sens = getScrollSensitivity()
    const px = wheelEventPixelDelta(ev, cell, term.rows, sens)
    const disp = accumulatePixelsToScrollLineDelta(wheelAccum, px, cell)
    if (disp !== 0) term.scrollLines(disp)
    debugLog?.(`${src} dy=${ev.deltaY.toFixed(1)} mode=${ev.deltaMode} → lines=${disp}`)
  }

  const capOpts: AddEventListenerOptions = { capture: true, passive: false }

  const onWindowWheel = (ev: WheelEvent) => {
    if (ev.shiftKey) return
    if (term.buffer.active.type !== 'normal') return
    if (!wheelPointerOverContainer(ev, container)) return
    ev.preventDefault()
    ev.stopImmediatePropagation()
    scrollFromWheel(ev, 'window')
  }
  window.addEventListener('wheel', onWindowWheel, capOpts)

  const onContainerWheel = (ev: WheelEvent) => {
    if (ev.shiftKey) return
    if (term.buffer.active.type !== 'normal') return
    ev.preventDefault()
    ev.stopPropagation()
    scrollFromWheel(ev, 'container')
  }
  container.addEventListener('wheel', onContainerWheel, capOpts)

  const xtermCustomWheel = (ev: WheelEvent): boolean => {
    if (ev.shiftKey) return true
    if (term.buffer.active.type !== 'normal') return true
    scrollFromWheel(ev, 'xterm-custom')
    ev.preventDefault()
    return false
  }
  term.attachCustomWheelEventHandler(xtermCustomWheel)

  return () => {
    window.removeEventListener('wheel', onWindowWheel, capOpts)
    container.removeEventListener('wheel', onContainerWheel, capOpts)
    term.attachCustomWheelEventHandler(() => true)
  }
}
