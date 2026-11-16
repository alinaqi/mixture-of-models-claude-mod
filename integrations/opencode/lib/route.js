// Which Palgu model takes an OpenCode prompt. Palgu routes (`auto`) unless the person pinned a model
// with /route, or the plugin options name a model for a tier and the mod's rules or classifier put
// the prompt in that tier (ADR 0005). The rules and tiers are the mod's own (hooks/lib). Pure.
import { labelFor, preClassify, sessionTurn } from '../../../hooks/lib/classify.js'
import { projectSlug } from '../../../hooks/lib/child.js'
import { DEFAULTS, LABELS } from '../../../hooks/lib/config.js'
import { clientHeader } from '../../cli/lib/setup.js'

const AUTO = 'auto'
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

function routesOf(options) {
  const given = { ...(options.routes || {}), ...(options.critical ? { critical: options.critical } : {}) }
  return Object.fromEntries(Object.entries(given).filter(([k, v]) => LABELS.includes(k) && typeof v === 'string' && MODEL_ID.test(v)))
}

// The plugin options from opencode.json (`["…/opencode", { critical, routes, ollama }]`), checked.
export function routingOptions(options) {
  const o = options && typeof options === 'object' ? options : {}
  return {
    provider: typeof o.provider === 'string' && o.provider ? o.provider : 'palgu',
    routes: routesOf(o),
    thresholds: DEFAULTS.thresholds,
    ollama: o.ollama !== false,
    ollamaModel: typeof o.ollamaModel === 'string' ? o.ollamaModel : DEFAULTS.ollama.model
  }
}

const decision = (model, label, reason) => ({ model: model || AUTO, label, reason })

function byLabel(label, routes, reason) {
  return decision(routes[label], label, reason)
}

// ctx: { pin, routes, last }. A decision, or { classify: true } when only a classifier can say.
export function preRoute(text, ctx) {
  if (ctx.pin && ctx.pin !== AUTO) return decision(ctx.pin, 'pinned', 'pin')
  if (!Object.keys(ctx.routes).length) return decision(AUTO, AUTO, 'Palgu routes')
  const stay = sessionTurn(text)
  if (stay === 'security or verdict') return byLabel('critical', ctx.routes, stay)
  if (stay) return decision(ctx.last, 'sticky', stay)
  const pre = preClassify(text, { lastHadTools: false, lastWasChild: false })
  if (pre.kind === 'skip') return decision(AUTO, AUTO, 'slash command')
  if (pre.kind === 'label') return byLabel(pre.label, ctx.routes, 'rule')
  if (pre.kind === 'sticky') return decision(ctx.last, 'sticky', 'continuation')
  return { classify: true }
}

// The classifier's verdict ({ score, kind }) to a decision; no verdict: Palgu routes.
export function fromVerdict(verdict, o) {
  if (!verdict) return decision(AUTO, AUTO, 'no classifier: Palgu routes')
  const label = labelFor(verdict.score, o.thresholds)
  return byLabel(label, o.routes, 'classifier ' + verdict.score + ' ' + verdict.kind)
}

// What every request to Palgu carries: who sends it, the project, and the pin for a named model.
export function routeHeaders(model, cwd, version) {
  const out = { 'x-srooter-client': clientHeader('opencode', version) }
  const project = projectSlug(cwd)
  if (project && !project.includes('..')) out['x-srooter-project'] = project
  if (model && model !== AUTO && MODEL_ID.test(model)) out['x-srooter-pin'] = model
  return out
}

// `/route [status|auto|<model>|<prefix>]` against the provider's models.
export function routeArg(arg, known) {
  const a = String(arg || '').trim()
  if (!a || a === 'status') return { kind: 'status' }
  if (a === AUTO) return { kind: 'pin', model: AUTO }
  const hit = known.find((m) => m === a) || known.find((m) => m !== AUTO && m.startsWith(a))
  if (hit) return { kind: 'pin', model: hit }
  return { kind: 'error', text: 'Unknown model ' + a + '. Models: ' + known.join(', ') }
}

// The provider's model ids from OpenCode's config, auto first.
export function knownModels(cfg, provider) {
  const models = Object.keys((((cfg || {}).provider || {})[provider] || {}).models || {})
  return models.includes(AUTO) ? [AUTO, ...models.filter((m) => m !== AUTO)] : models
}
