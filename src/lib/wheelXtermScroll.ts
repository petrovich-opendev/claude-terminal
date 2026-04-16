/** Match DOM Level 3 WheelEvent.deltaMode (works in Node tests without global WheelEvent). */
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2

/**
 * Wheel → pixel delta aligned with xterm Viewport._getPixelsScrolled (vertical only).
 */
export function wheelEventPixelDelta(
  ev: WheelEvent,
  cellHeightPx: number,
  rows: number,
  sensitivity: number
): number {
  if (ev.deltaY === 0 || ev.shiftKey) return 0
  let amount = ev.deltaY * sensitivity
  if (ev.deltaMode === DOM_DELTA_LINE) {
    amount *= cellHeightPx
  } else if (ev.deltaMode === DOM_DELTA_PAGE) {
    amount *= cellHeightPx * rows
  }
  return amount
}

/** Sub-pixel accumulation for smooth trackpad (macOS). */
export type WheelPixelAccum = { px: number }

/**
 * Returns signed line count for `Terminal.scrollLines` (positive = toward newer output).
 */
export function accumulatePixelsToScrollLineDelta(
  acc: WheelPixelAccum,
  pixelDelta: number,
  cellHeightPx: number
): number {
  if (cellHeightPx <= 0) return 0
  acc.px += pixelDelta
  const lines = Math.trunc(acc.px / cellHeightPx)
  acc.px -= lines * cellHeightPx
  return lines
}
