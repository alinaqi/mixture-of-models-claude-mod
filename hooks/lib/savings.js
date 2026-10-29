// What routing saved: each routed turn priced twice, at the session's Claude model (what it would
// have cost) and at what it did cost, plus the main-session turns, which run on Claude either way.
// Prices are API list prices, so on a subscription the saving is the API-equivalent. Pure.

// $ per million tokens. cacheWrite is the 5-minute rate (1.25x input); 1-hour writes, which
// Claude Code uses, cost 2x input.
export const CLAUDE_PRICES = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
}

const KEYS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']
const round = (n) => Math.round(n * 1e6) / 1e6

// A usage block with every count a number, or null when it has no input or output count.
// cache_1h_input_tokens is the part of cache_creation_input_tokens written for an hour.
export function usageOf(u) {
  if (!u || (typeof u.input_tokens !== 'number' && typeof u.output_tokens !== 'number')) return null
  const hour = (u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens) || u.cache_1h_input_tokens
  return { ...Object.fromEntries(KEYS.map((k) => [k, Number(u[k]) || 0])), cache_1h_input_tokens: Number(hour) || 0 }
}

function cost(usage, p) {
  const read = p.cacheRead === undefined ? p.input / 10 : p.cacheRead
  const write = p.cacheWrite === undefined ? p.input * 1.25 : p.cacheWrite
  const hour = Math.min(usage.cache_1h_input_tokens, usage.cache_creation_input_tokens)
  const writes = (usage.cache_creation_input_tokens - hour) * write + hour * p.input * 2
  const sum = usage.input_tokens * p.input + usage.output_tokens * p.output + usage.cache_read_input_tokens * read + writes
  return round(sum / 1e6)
}

export function claudeCost(usage, model) {
  const p = CLAUDE_PRICES[String(model || '').replace(/\[.*\]$/, '')]
  const u = usageOf(usage)
  return p && u ? cost(u, p) : null
}

// router.prices: { "<model id>": { input, output, cacheRead?, cacheWrite? } } in $ per million.
export function tableCost(usage, model, prices) {
  const p = (prices || {})[model]
  const u = usageOf(usage)
  return p && u ? cost(u, p) : null
}

// The four standard counts only: Palgu prices them with its own cache rules.
export function quoteBody(model, usage) {
  const u = usageOf(usage)
  return { model, usage: u && Object.fromEntries(KEYS.map((k) => [k, u[k]])) }
}

export function emptyTotals() {
  return { routed: 0, priced: 0, unpriced: 0, baseline: 0, actual: 0, main: 0 }
}

function addRouted(t, e) {
  if (e.baseline === null || e.actual === null || e.baseline === undefined || e.actual === undefined) return { ...t, routed: t.routed + 1, unpriced: t.unpriced + 1 }
  return { ...t, routed: t.routed + 1, priced: t.priced + 1, baseline: round(t.baseline + e.baseline), actual: round(t.actual + e.actual) }
}

// entry: { routed, baseline, actual }. A main-session turn has only a baseline.
export function addTurn(totals, entry) {
  const t = { ...emptyTotals(), ...(totals || {}) }
  if (entry.routed) return addRouted(t, entry)
  return typeof entry.baseline === 'number' ? { ...t, main: round(t.main + entry.baseline) } : t
}

function usd(n) {
  return '$' + (Math.abs(n) < 0.01 ? n.toFixed(3) : n.toFixed(2))
}

function unpricedNote(n) {
  return n ? ' · ' + n + ' routed turn' + (n === 1 ? '' : 's') + ' unpriced' : ''
}

export function savingsLine(t, sessionModel) {
  const model = String(sessionModel || '').replace(/\[.*\]$/, '')
  if (!t || !t.priced) return 'saved: nothing priced yet' + unpricedNote(t ? t.unpriced : 0)
  const saved = t.baseline - t.actual, all = t.baseline + t.main
  const pct = all > 0 ? Math.round((saved / all) * 100) : 0
  return 'saved ~' + usd(saved) + ' (' + pct + '%) vs all ' + model + ', at API prices' + unpricedNote(t.unpriced)
}

// The route line's note for one routed turn; nothing when it could not be priced.
export function turnNote(entry) {
  if (!entry || typeof entry.baseline !== 'number' || typeof entry.actual !== 'number') return ''
  const saved = entry.baseline - entry.actual
  return saved >= 0 ? ' · saved ~' + usd(saved) : ' · cost ~' + usd(-saved) + ' more than Claude'
}
