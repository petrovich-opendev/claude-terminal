import { describe, it, expect } from 'vitest'
import { MODEL_PRICING, calcCostUSD } from '../lib/pricing'

describe('MODEL_PRICING', () => {
  it('contains all three models', () => {
    expect(Object.keys(MODEL_PRICING)).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
    ])
  })

  it('all models have required fields', () => {
    for (const [, p] of Object.entries(MODEL_PRICING)) {
      expect(p.label).toBeTruthy()
      expect(p.inputPerMTok).toBeGreaterThan(0)
      expect(p.outputPerMTok).toBeGreaterThan(0)
      expect(p.speed).toMatch(/^●+○*$/)
      expect(p.quality).toMatch(/^●+○*$/)
      expect(p.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('opus is most expensive', () => {
    const opus = MODEL_PRICING['claude-opus-4-6']
    const sonnet = MODEL_PRICING['claude-sonnet-4-6']
    const haiku = MODEL_PRICING['claude-haiku-4-5-20251001']
    expect(opus.inputPerMTok).toBeGreaterThan(sonnet.inputPerMTok)
    expect(sonnet.inputPerMTok).toBeGreaterThan(haiku.inputPerMTok)
  })
})

describe('calcCostUSD', () => {
  it('returns 0 for unknown model', () => {
    expect(calcCostUSD(1000, 1000, 0, 0, 'unknown-model')).toBe(0)
  })

  it('calculates sonnet cost correctly', () => {
    // 1M input @ $3 + 1M output @ $15 = $18
    const cost = calcCostUSD(1_000_000, 1_000_000, 0, 0, 'claude-sonnet-4-6')
    expect(cost).toBeCloseTo(18.0, 2)
  })

  it('calculates cache read at 10% of input price', () => {
    // 1M cache read tokens @ 10% of $3 = $0.30
    const cost = calcCostUSD(0, 0, 1_000_000, 0, 'claude-sonnet-4-6')
    expect(cost).toBeCloseTo(0.3, 2)
  })

  it('calculates cache write at 25% of input price', () => {
    // 1M cache write tokens @ 25% of $3 = $0.75
    const cost = calcCostUSD(0, 0, 0, 1_000_000, 'claude-sonnet-4-6')
    expect(cost).toBeCloseTo(0.75, 2)
  })

  it('returns 0 for zero tokens', () => {
    expect(calcCostUSD(0, 0, 0, 0, 'claude-sonnet-4-6')).toBe(0)
  })

  it('handles small token counts without floating point errors', () => {
    const cost = calcCostUSD(100, 50, 0, 0, 'claude-sonnet-4-6')
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(0.01)
  })
})
