// Prices a finished turn for the savings totals: a routed turn at the session's Claude model and
// at what it cost (Palgu's own quote, router.prices, or Claude rates for a Claude member), a
// main-session turn at the session's model.
import { isPalgu, PALGU_ORIGIN, parseBody } from './lib/palgu.js'
import { claudeCost, quoteBody, tableCost } from './lib/savings.js'

// Palgu prices the usage with the formula it bills by; the key goes only to Palgu itself.
async function palguQuote($, model, usage, key) {
  const init = { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify(quoteBody(model, usage)) }
  const res = await $.http.fetch(PALGU_ORIGIN + '/v1/pricing/quote', init).catch(() => ({ ok: false }))
  const cost = res.ok ? parseBody(res).cost_usd : undefined
  return typeof cost === 'number' ? cost : null
}

async function actualCost($, t) {
  const { decision, cfg, key } = t
  if (decision.runner === 'subscription') return claudeCost(decision.child.usage, decision.id)
  if (decision.runner !== 'gateway') return null
  const listed = tableCost(decision.child.usage, decision.id, cfg.prices)
  if (listed !== null || !isPalgu(cfg.child.baseUrl) || !key) return listed
  return palguQuote($, decision.id, decision.child.usage, key)
}

// t: { decision, sessionModel, cfg, key, usage } where usage is the main session's, if it ran.
export async function priceTurn($, t) {
  const child = t.decision.child
  if (!child || child.exitCode !== 0) return { routed: false, baseline: claudeCost(t.usage, t.sessionModel) }
  const baseline = claudeCost(child.usage, t.sessionModel)
  return { routed: true, baseline, actual: baseline === null ? null : await actualCost($, t) }
}
