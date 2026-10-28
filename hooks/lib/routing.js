// Route resolution, the /route argument grammar, and the summary line. Pure.
import { GATEWAY_MODELS, LABELS } from './config.js'
import { routeValue } from './families.js'

// The tier says whether Claude is mandatory; below that, the kind picks the cheaper model.
// Family routes (`claude/auto`, `kimi/highspeed`) come back as written; families.js resolves them.
export function resolveModel(decision, routes, sessionModel) {
  const route = routeValue(decision, routes)
  return route === 'claude' ? sessionModel : route
}

// While the main session is mid-task (its last answer used tools), coding-level work stays
// with it: a child would start over without the transcript. Lookups may still go out.
export function midTaskGuard(label, ctx) {
  return label === 'coding' && Boolean(ctx.lastHadTools)
}

// On the coding/critical edge one sample is noisy: these scores earn a second one.
export function isBorderline(score, thresholds) {
  return score === thresholds.coding || score === thresholds.coding + 1
}

export function bumpFailures(failures, kind) {
  const k = kind || 'code'
  return { ...(failures || {}), [k]: ((failures || {})[k] || 0) + 1 }
}

// Outcome memory: every two child failures of a kind lower that kind's coding cut-off by one.
export function adjustThresholds(thresholds, failures, kind) {
  const drop = Math.floor(((failures || {})[kind] || 0) / 2)
  return { ...thresholds, coding: Math.max(thresholds.simple + 1, thresholds.coding - drop) }
}

export function routeModels(routes) {
  return [...Object.values(routes).filter((m) => typeof m === 'string'), ...Object.values(routes.kinds || {})]
}

function modelByPrefix(arg, routes) {
  const match = (m) => m.startsWith(arg)
  return routeModels(routes).find(match) || GATEWAY_MODELS.find(match)
}

export function parseRouteArg(arg, routes) {
  const word = (arg || '').trim().toLowerCase()
  if (word === '' || word === 'status') return { mode: 'show' }
  if (word.includes('/')) return { mode: 'model', model: word }
  if (['auto', 'off', 'reset', 'stats'].includes(word)) return { mode: word }
  if (LABELS.includes(word)) return { mode: 'label', label: word }
  return { mode: 'model', model: modelByPrefix(word, routes) || word }
}

function fmtTokens(n) {
  return (n / 1000).toFixed(1) + 'k'
}

// The API's input_tokens excludes cached tokens, so the context size is the three summed.
function contextTokens(usage) {
  return usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
}

function cachePercent(usage) {
  const total = contextTokens(usage)
  return total ? Math.round((usage.cache_read_input_tokens / total) * 100) : 0
}

function outcomeNote(child) {
  if (child.rejected) return ' · child answer discarded (' + child.rejected + '), main model answered'
  if (child.exitCode !== 0) return ' · child failed, main model answered'
  return ' · child ' + Math.round(child.ms / 1000) + 's'
}

// A Codex child: its sandbox, and every command it was refused, by name or as a count of unnamed ones.
function sandboxNote(child) {
  if (!child.sandbox) return ''
  const refused = [...(child.refused || []), ...(child.unnamed ? [child.unnamed + ' unnamed'] : [])]
  return ' · sandbox ' + child.sandbox + (refused.length ? ' · refused: ' + refused.join(' · ') : '')
}

function childNote(child) {
  return outcomeNote(child) + sandboxNote(child)
}

function usageNote(usage) {
  if (!usage) return ''
  return ' · ' + fmtTokens(contextTokens(usage)) + ' in / ' + fmtTokens(usage.output_tokens) + ' out · cache ' + cachePercent(usage) + '%'
}

// ` (claude/sonnet)`, or ` (claude/auto → sonnet)` when the tier picked the member.
function familyNote(d) {
  if (!d.family) return ''
  return ' (' + d.family + '/' + (d.auto ? 'auto → ' : '') + (d.member || 'default') + ')'
}

// Every turn gets a line: where it ran (child or main session) and what it cost.
export function tierText(decision) {
  const score = decision.score ? ' ' + decision.score + '/10' + (decision.kind ? ' ' + decision.kind : '') : ''
  return decision.label + score + ' via ' + decision.source
}

export function summaryLine(decision, usage) {
  const head = 'route: ' + decision.model + familyNote(decision) + ' · ' + tierText(decision)
  if (decision.child) return head + childNote(decision.child)
  return head + usageNote(usage) + ' · main session'
}
