// mixture-of-models: Maggy's routing as a Claude Code mod. Score each prompt; answer a routed
// turn with a headless `claude -p` child on the gateway; the main session never leaves its model.
import { parseConfig } from './lib/config.js'
import { VERDICTS, classifierPrompt, labelFor, ollamaBody, ollamaReply, parseVerdict, preClassify } from './lib/classify.js'
import { adjustThresholds, bumpFailures, isBorderline, parseRouteArg, resolveModel, summaryLine } from './lib/routing.js'
import { buildBrief, childArgs, childEnv, childReady, gatewayFrom } from './lib/child.js'
import { bumpStats, statsLine } from './lib/stats.js'
import { bandTree, reportText, tagText, tagTree } from './lib/ui.js'

let cfg = parseConfig(''), options = {}, disabled = false, ready = false, key = '', sessionModel = ''
let pin = { mode: 'auto' }, decision = { label: 'critical', model: '', source: 'default' }, lastPrompt = ''
const answered = new Map()

function readFile($, path) {
  return $.fs.read(path).catch(() => '')
}

async function loadConfig($) {
  const home = (await $.env.get('HOME')) || ''
  cfg = parseConfig(await readFile($, home + '/.claude/model-config.json'))
  ;({ baseUrl: cfg.child.baseUrl, key } = gatewayFrom(options, cfg.child))
  ready = childReady(cfg.child, key)
  sessionModel = await $.session.model()
  pin = (await $.store.get('pin')) || { mode: 'auto' }
}

// The only network call the mod makes itself: a local Ollama, fixed address, no credentials.
async function askOllama($, text) {
  try {
    const r = await $.http.fetch('http://localhost:11434/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ollamaBody(cfg.ollama.model, classifierPrompt(text)) })
    return r.ok ? parseVerdict(ollamaReply(r.text)) : undefined
  } catch {
    return undefined
  }
}

function askClaude($, text) {
  return $.model.classify(classifierPrompt(text), VERDICTS, { model: cfg.classifier }).then(parseVerdict).catch(() => undefined)
}

async function sample($, text) {
  const local = await askOllama($, text)
  if (local) return { ...local, source: 'ollama' }
  const remote = await askClaude($, text)
  return remote ? { ...remote, source: cfg.classifier } : undefined
}

// One sample, a second on the coding/critical edge (the higher wins), else the last verdict seen.
async function classify($, text) {
  const first = await sample($, text)
  if (!first) {
    const cached = await $.store.get('last-verdict')
    return cached ? { ...cached, source: 'cache' } : { score: 10, kind: 'code', source: 'default' }
  }
  if (!isBorderline(first.score, cfg.thresholds)) return first
  const second = await sample($, text)
  return second && second.score > first.score ? second : first
}

async function lastTurnUsedTools($) {
  const messages = await $.session.messages()
  const last = messages.filter((m) => m.role === 'assistant').pop()
  return Boolean(last && last.toolUses.length)
}

function setDecision(label, source, verdict) {
  decision = { label, source, ...(verdict || {}) }
  decision.model = resolveModel(decision, cfg.routes, sessionModel)
}

// A /route pin wins over classification: a label pins a tier, a model id pins the model itself.
function applyPin() {
  if (pin.mode === 'label') setDecision(pin.label, 'pin')
  if (pin.mode === 'model') decision = { label: 'pinned', source: 'pin', model: pin.model === 'claude' ? sessionModel : pin.model }
}

async function decide($, text) {
  if (pin.mode === 'model' || pin.mode === 'label') return applyPin()
  const pre = preClassify(text, await lastTurnUsedTools($))
  if (pre.kind === 'label') return setDecision(pre.label, 'rule')
  if (pre.kind !== 'classify') return
  const verdict = await classify($, text)
  await $.store.set('last-verdict', { score: verdict.score, kind: verdict.kind })
  const thresholds = adjustThresholds(cfg.thresholds, await $.store.get('failures'), verdict.kind)
  setDecision(labelFor(verdict.score, thresholds), verdict.source, { score: verdict.score, kind: verdict.kind })
}

// The main session's own request goes out whenever the child is not the answer.
function shouldDelegate(e) {
  if (disabled || !ready || pin.mode === 'off' || e.agentId || e.index > 0) return false
  return Boolean(decision.model) && decision.model !== sessionModel
}

async function runChild($) {
  const brief = buildBrief(await $.session.messages(), lastPrompt, cfg.child.contextMessages)
  const started = Date.now()
  // The only program this mod runs: Claude Code itself, headless, on the routed model.
  const r = await $.process.run(['claude', ...childArgs(cfg.child, decision.model, await $.session.cwd())], { env: childEnv(cfg.child, key), stdin: brief, timeoutMs: cfg.child.timeoutMs }).catch(() => ({ exitCode: 1, stdout: '' }))
  const ok = r.exitCode === 0 && r.stdout.trim() !== ''
  decision = { ...decision, child: { ms: Date.now() - started, exitCode: ok ? 0 : r.exitCode || 1 } }
  if (!ok) await $.store.set('failures', bumpFailures(await $.store.get('failures'), decision.kind))
  return ok ? r.stdout.trim() : ''
}

async function pinFrom($, arg) {
  pin = parseRouteArg(arg, cfg.routes)
  await $.store.set('pin', pin)
  applyPin()
  $.ui.invalidate('ui.render')
  return 'routing set to ' + pin.mode + (pin.model ? ' ' + pin.model : pin.label ? ' ' + pin.label : '')
}

function bandView(e, theirs) {
  return { disabled, ready, sessionModel, pin, decision, routes: cfg.routes, isWorking: e.props.isWorking, theirs }
}

function taggedModel(props) {
  if (cfg.ui.tags === 'off' || !props.isFirstOfReply) return undefined
  return answered.get(props.text.trim()) || (cfg.ui.tags === 'all' ? sessionModel : undefined)
}

export function register(on, opts) {
  options = opts || {}
  on('session.start', async ($, e, next) => {
    disabled = Boolean(await $.env.get('MAGGY_ROUTER_CHILD'))
    if (disabled) return next(e)
    await loadConfig($)
    applyPin()
    try {
      await $.command.register({ name: 'route', description: 'Show or pin the model route: /route [auto|off|reset|simple|coding|critical|<model>]', argumentHint: '[auto|off|reset|label|model]', immediate: true })
    } catch {
      $.ui.log('/route is taken by another plugin')
    }
    return next(e)
  })

  // Fail open: a classifier that throws or times out must never swallow the prompt.
  on('prompt.submit', async ($, e, next) => {
    if (disabled) return next(e)
    lastPrompt = e.text
    await decide($, e.text)
    return next(e)
  }).catch(async ($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    const { child, ...fresh } = decision
    decision = fresh
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (!shouldDelegate(e)) return yield* next(e)
    const answer = await runChild($)
    if (!answer) {
      $.ui.log('child on ' + decision.model + ' failed, main model takes this turn')
      return yield* next(e)
    }
    answered.set(answer, decision.model)
    if (answered.size > 50) answered.delete(answered.keys().next().value)
    yield { kind: 'text', index: 0, text: answer }
    return { turnId: e.turnId, index: e.index, answer, toolUses: [], stopReason: 'end_turn', usage: null }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (disabled || e.agentId || !cfg.summary || !decision.model) return result
    const day = new Date().toISOString().slice(0, 10)
    const stats = bumpStats((await $.store.get('stats')) || {}, day, decision.model)
    await $.store.set('stats', stats)
    return { ...result, text: summaryLine(decision, e.usage) + ' · ' + statsLine(stats, day) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!cfg.ui.band || e.props.hasSurvey) return next(e)
    const theirs = await next(e)
    return bandTree($.ui.resolve(e), bandView(e, theirs), (arg) => pinFrom($, arg))
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const model = taggedModel(e.props)
    if (!model) return next(e)
    return tagTree($.ui.resolve(e), tagText(model, sessionModel), await next(e))
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!shouldDelegate({ index: 0 })) return next(e)
    return next({ ...e, props: { ...e.props, suffix: ' · via ' + decision.model + ' (child)…' } })
  })

  on('command.run', { command: 'route' }, async ($, e) => {
    const parsed = parseRouteArg(e.args, cfg.routes)
    if (parsed.mode === 'show') return { text: reportText(bandView({ props: {} })) + ' · ' + statsLine((await $.store.get('stats')) || {}, new Date().toISOString().slice(0, 10)) }
    if (parsed.mode === 'reset') return { text: 'failure memory cleared', ...(await $.store.set('failures', {}) || {}) }
    return { text: await pinFrom($, e.args) }
  })
}
