import type { ModelPricing } from './models'

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-haiku-4-5-20251001': {
    label: 'Haiku 4.5',
    inputPerMTok: 0.25,
    outputPerMTok: 1.25,
    speed: '●●●○',
    quality: '●●○○',
    color: '#34d399',
  },
  'claude-sonnet-4-6': {
    label: 'Sonnet 4.6',
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    speed: '●●●○',
    quality: '●●●○',
    color: '#60a5fa',
  },
  'claude-opus-4-6': {
    label: 'Opus 4.6',
    inputPerMTok: 15.00,
    outputPerMTok: 75.00,
    speed: '●●○○',
    quality: '●●●●',
    color: '#a78bfa',
  },
}

export function calcCostUSD(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
  modelId: string
): number {
  const pricing = MODEL_PRICING[modelId]
  if (!pricing) return 0
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok
  // Cache read is 10% of input price, cache write is 25% of input price
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.inputPerMTok * 0.1
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * pricing.inputPerMTok * 0.25
  return inputCost + outputCost + cacheReadCost + cacheWriteCost
}
