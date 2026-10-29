import { expect, test } from 'claude-code/testing'
import { CLAUDE_PRICES, addTurn, claudeCost, emptyTotals, quoteBody, savingsLine, tableCost, turnNote, usageOf } from '../hooks/lib/savings.js'

const M = 1000000
const usage = (input, output, read = 0, write = 0) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read, cache_creation_input_tokens: write })

test('Claude prices are the current API rates per million tokens', async () => {
  expect(CLAUDE_PRICES['claude-opus-5-5']).toEqual({ input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 })
  expect(CLAUDE_PRICES['claude-sonnet-5-5']).toEqual({ input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 })
  expect(CLAUDE_PRICES['claude-haiku-5-5'].input).toBe(0.1)
  expect(CLAUDE_PRICES['claude-fable-5-1'].output).toBe(50)
})

test('claudeCost prices every token kind, reads a [1m] suffix, and knows nothing of other models', async () => {
  expect(claudeCost(usage(M, M), 'claude-opus-5-5')).toBe(24)
  expect(claudeCost(usage(0, 0, M, M), 'claude-opus-5-5')).toBe(5.2)
  expect(claudeCost(usage(M, 0), 'claude-opus-5-5[1m]')).toBe(4)
  expect(claudeCost(usage(M, 0), 'glm-5.3')).toBe(null)
  expect(claudeCost(null, 'claude-opus-5-5')).toBe(null)
})

test('claudeCost prices 1-hour cache writes at 2x input, matching what Claude Code itself reported', async () => {
  // A real `claude -p --model claude-haiku-5-5 --output-format json` result: total_cost_usd 0.00527857.
  const real = { input_tokens: 2, cache_creation_input_tokens: 25149, cache_read_input_tokens: 11607, output_tokens: 265,
    cache_creation: { ephemeral_1h_input_tokens: 25149, ephemeral_5m_input_tokens: 0 } }
  expect(claudeCost(real, 'claude-haiku-5-5')).toBe(0.005279)
  expect(usageOf(real).cache_1h_input_tokens).toBe(25149)
})

test('tableCost prices a gateway model from router.prices, cache reads at a tenth of input unless set', async () => {
  const prices = { 'glm-5.3': { input: 0.6, output: 2.2 } }
  expect(tableCost(usage(M, M), 'glm-5.3', prices)).toBe(2.8)
  expect(tableCost(usage(0, 0, M), 'glm-5.3', prices)).toBe(0.06)
  expect(tableCost(usage(M, M), 'kimi-k3.1-pro', prices)).toBe(null)
})

test('usageOf reads the child result usage and rejects one with no token counts', async () => {
  expect(usageOf({ input_tokens: 10, output_tokens: 2 })).toEqual({ ...usage(10, 2), cache_1h_input_tokens: 0 })
  expect(usageOf({ cache_read_input_tokens: 5 })).toBe(null)
  expect(usageOf(undefined)).toBe(null)
})

test('quoteBody asks Palgu to price exactly the child usage', async () => {
  expect(quoteBody('glm-5.3', { ...usage(10, 2, 3, 4), cache_creation: { ephemeral_1h_input_tokens: 4 } })).toEqual({ model: 'glm-5.3', usage: usage(10, 2, 3, 4) })
})

test('addTurn: a priced routed turn saves the difference, an unpriced one claims nothing, a main turn adds to the baseline', async () => {
  let t = addTurn(emptyTotals(), { routed: true, baseline: 1.2, actual: 0.2 })
  expect(t).toEqual({ routed: 1, priced: 1, unpriced: 0, baseline: 1.2, actual: 0.2, main: 0 })
  t = addTurn(t, { routed: true, baseline: 0.5, actual: null })
  expect(t.unpriced).toBe(1)
  expect(t.baseline).toBe(1.2)
  t = addTurn(t, { routed: false, baseline: 0.8 })
  expect(t.main).toBe(0.8)
  expect(addTurn(undefined, { routed: false, baseline: null })).toEqual(emptyTotals())
})

test('savingsLine says how much was saved against running everything on Claude', async () => {
  expect(savingsLine(emptyTotals(), 'claude-opus-5-5')).toBe('saved: nothing priced yet')
  const t = { routed: 3, priced: 2, unpriced: 1, baseline: 1.2, actual: 0.2, main: 0.8 }
  // all-Claude 2.00, spent 1.00: saved 1.00, half
  expect(savingsLine(t, 'claude-opus-5-5')).toBe('saved ~$1.00 (50%) vs all claude-opus-5-5, at API prices · 1 routed turn unpriced')
})

test('turnNote is the per-turn saving on the route line', async () => {
  expect(turnNote({ baseline: 0.42, actual: 0.03 })).toBe(' · saved ~$0.39')
  expect(turnNote({ baseline: 0.004, actual: 0.001 })).toBe(' · saved ~$0.003')
  expect(turnNote({ baseline: 0.4, actual: null })).toBe('')
  expect(turnNote(null)).toBe('')
})
