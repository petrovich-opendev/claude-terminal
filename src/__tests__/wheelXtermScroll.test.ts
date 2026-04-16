import { describe, expect, it } from 'vitest'
import { accumulatePixelsToScrollLineDelta, wheelEventPixelDelta } from '@/lib/wheelXtermScroll'

describe('wheelXtermScroll', () => {
  it('pixel delta matches line/page modes', () => {
    const cell = 15
    const rows = 24
    const sens = 1
    const evLine = { deltaY: 2, deltaMode: 1, shiftKey: false } as WheelEvent /* DOM_DELTA_LINE */
    expect(wheelEventPixelDelta(evLine, cell, rows, sens)).toBe(30)

    const evPage = { deltaY: 1, deltaMode: 2, shiftKey: false } as WheelEvent /* DOM_DELTA_PAGE */
    expect(wheelEventPixelDelta(evPage, cell, rows, sens)).toBe(15 * 24)

    const evPx = { deltaY: 45, deltaMode: 0, shiftKey: false } as WheelEvent /* DOM_DELTA_PIXEL */
    expect(wheelEventPixelDelta(evPx, cell, rows, sens)).toBe(45)
  })

  it('accumulates trackpad pixels into whole lines', () => {
    const acc = { px: 0 }
    const cell = 15
    expect(accumulatePixelsToScrollLineDelta(acc, 20, cell)).toBe(1)
    expect(acc.px).toBe(5)
    expect(accumulatePixelsToScrollLineDelta(acc, 20, cell)).toBe(1)
    expect(acc.px).toBe(10)
  })
})
