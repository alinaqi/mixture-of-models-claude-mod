// Route resolution, the /route argument grammar, and the summary line. Pure.
import { LABELS } from './config.js'

export function resolveModel(label, routes, sessionModel) {
  const model = routes[label]
  if (!model || model === 'claude') return sessionModel
  return model
}

function modelByPrefix(arg, routes) {
  return Object.values(routes).find((m) => m.startsWith(arg))
}

export function parseRouteArg(arg, routes) {
  const word = (arg || '').trim().toLowerCase()
  if (word === '') return { mode: 'show' }
  if (word === 'auto' || word === 'off') return { mode: word }
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

function childNote(child) {
  if (child.exitCode !== 0) return ' · child failed, main model answered'
  return ' · child ' + Math.round(child.ms / 1000) + 's'
}

function usageNote(usage) {
  if (!usage) return ''
  return ' · ' + fmtTokens(contextTokens(usage)) + ' in / ' + fmtTokens(usage.output_tokens) + ' out · cache ' + cachePercent(usage) + '%'
}

// Every turn gets a line: where it ran (child or main session) and what it cost.
export function summaryLine(decision, usage) {
  const head = 'route: ' + decision.model + ' · ' + decision.label + ' via ' + decision.source
  if (decision.child) return head + childNote(decision.child)
  return head + usageNote(usage) + ' · main session'
}
