// mixture-of-models: Maggy's routing as a Claude Code mod. Score each prompt; answer a routed
// turn with a headless `claude -p` child on the gateway; the main session never leaves its model.
import { parseConfig } from './lib/config.js'
import { VERDICTS, classifierPrompt, labelFor, ollamaBody, ollamaReply, parseVerdict, preClassify, sessionTurn } from './lib/classify.js'
import { adjustThresholds, bumpFailures, isBorderline, midTaskGuard, parseRouteArg, resolveModel, summaryLine } from './lib/routing.js'
import { allowPatterns, buildBrief, childArgs, childEnv, childHeaders, childReady, gatewayFrom, parseChildOutput, relayText } from './lib/child.js'
import { vetAnswer } from './lib/vet.js'
import { appendLog, bumpStats, statsLine, summarize } from './lib/stats.js'
import { paneTree } from './lib/stats-pane.js'
import { bandTree, reportText, tagText, tagTree } from './lib/ui.js'

let cfg = parseConfig(''), options = {}, disabled = false, ready = false, key = '', sessionModel = ''
let pin = { mode: 'auto' }, decision = { label: 'critical', model: '', source: 'default' }, lastPrompt = '', tab = 'models', lastWasChild = false
const answered = new Map()

async function loadConfig($) {
  const home = (await $.env.get('HOME')) || ''
  cfg = parseConfig(await $.fs.read(home + '/.claude/model-config.json').catch(() => ''))
  ;({ baseUrl: cfg.child.baseUrl, key } = gatewayFrom(options, cfg.child))
  ready = childReady(cfg.child, key)
  sessionModel = await $.session.model()
  pin = (await $.store.get('pin')) || { mode: 'auto' }
}

// The only network call the mod makes itself: a local Ollama, fixed address, no credentials.
function askOllama($, text) {
  return $.http.fetch('http://localhost:11434/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ollamaBody(cfg.ollama.model, classifierPrompt(text)) })
    .then((r) => (r.ok ? parseVerdict(ollamaReply(r.text)) : undefined)).catch(() => undefined)
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
  const cached = first ? null : await $.store.get('last-verdict')
  if (!first) return cached ? { ...cached, source: 'cache' } : { score: 10, kind: 'code', source: 'default' }
  if (!isBorderline(first.score, cfg.thresholds)) return first
  const second = await sample($, text)
  return second && second.score > first.score ? second : first
}

function setDecision(label, source, verdict) {
  decision = { label, source, ...(verdict || {}) }
  decision.model = resolveModel(decision, cfg.routes, sessionModel)
}

function applyPin() {
  if (pin.mode === 'label') setDecision(pin.label, 'pin')
  if (pin.mode === 'model') decision = { label: 'pinned', source: 'pin', model: pin.model === 'claude' ? sessionModel : pin.model }
}

// Notifications, operator commands and security turns stay on the main session, pinned or not.
async function decide($, text) {
  const stay = sessionTurn(text)
  if (stay) return setDecision('main', stay)
  if (pin.mode === 'model' || pin.mode === 'label') return applyPin()
  const last = (await $.session.messages()).filter((m) => m.role === 'assistant').pop()
  const ctx = { lastHadTools: Boolean(last && last.toolUses.length), lastWasChild }
  const pre = preClassify(text, ctx)
  if (pre.kind === 'label') return setDecision(pre.label, 'rule')
  if (pre.kind === 'main') return setDecision('main', pre.reason)
  if (pre.kind !== 'classify') return
  const verdict = await classify($, text)
  await $.store.set('last-verdict', { score: verdict.score, kind: verdict.kind })
  const thresholds = adjustThresholds(cfg.thresholds, await $.store.get('failures'), verdict.kind)
  const label = labelFor(verdict.score, thresholds)
  setDecision(label, midTaskGuard(label, ctx) ? 'mid-task guard' : verdict.source, { score: verdict.score, kind: verdict.kind })
  if (midTaskGuard(label, ctx)) decision.model = sessionModel
}

function shouldDelegate(e) {
  if (disabled || !ready || pin.mode === 'off' || e.agentId || e.index > 0) return false
  return Boolean(decision.model) && decision.model !== sessionModel
}

// The only program this mod runs: Claude Code itself, headless, on the routed model.
// Its env names the mod and the project to the gateway, after any custom headers the user set.
async function spawnChild($, extra, stdin) {
  const cwd = await $.session.cwd()
  const argv = ['claude', ...childArgs(cfg.child, decision.model, cwd), ...extra]
  const headers = childHeaders(cwd, (await $.env.get('ANTHROPIC_CUSTOM_HEADERS')) || '')
  const r = await $.process.run(argv, { env: childEnv(cfg.child, key, headers), stdin, timeoutMs: cfg.child.timeoutMs }).catch(() => ({ exitCode: 1, stdout: '' }))
  return parseChildOutput(r.stdout, r.exitCode)
}

// A command the child was refused becomes a real question here; nobody to ask counts as no.
function askAllow($, patterns) {
  return $.ui.ask('Child on ' + decision.model + ' wants to run: ' + patterns.join(' · '), ['Allow and continue', 'Deny'])
    .then((a) => a === 'Allow and continue').catch(() => false)
}

async function runChild($) {
  const started = Date.now()
  let out = await spawnChild($, [], buildBrief(await $.session.messages(), lastPrompt, cfg.child.contextMessages))
  for (let round = 0; out.ok && out.denials.length && round < cfg.child.relayRounds; round += 1) {
    const patterns = allowPatterns(out.denials)
    if (!(await askAllow($, patterns))) break
    out = await spawnChild($, ['--resume', out.sessionId, '--allowedTools', ...patterns], relayText(patterns))
  }
  // A handback, a request that the user act, an unverified claim, narration or a repeat is discarded.
  const vet = out.ok ? vetAnswer(out, answered) : { ok: false, reason: '' }
  decision = { ...decision, child: { ms: Date.now() - started, exitCode: vet.ok ? 0 : 1, rejected: vet.reason } }
  if (!vet.ok) await $.store.set('failures', bumpFailures(await $.store.get('failures'), decision.kind))
  return vet.ok ? out.answer : ''
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

export function register(on, opts) {
  options = opts || {}
  on('session.start', async ($, e, next) => {
    disabled = Boolean(await $.env.get('MAGGY_ROUTER_CHILD'))
    if (disabled) return next(e)
    await loadConfig($)
    applyPin()
    await $.command.register({ name: 'route', description: 'Show or pin the model route, or open the stats pane: /route [stats|auto|off|reset|simple|coding|critical|<model>]', argumentHint: '[stats|auto|off|reset|label|model]', immediate: true })
      .catch(() => $.ui.log('/route is taken by another plugin'))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (disabled) return next(e)
    lastPrompt = e.text
    await decide($, e.text)
    return next(e)
  }).catch(async ($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    decision = { ...decision, child: undefined }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) lastWasChild = false
    if (!shouldDelegate(e)) return yield* next(e)
    const answer = await runChild($)
    if (!answer) {
      $.ui.log('child on ' + decision.model + (decision.child.rejected ? ' answer discarded (' + decision.child.rejected + ')' : ' failed') + ', main model takes this turn')
      return yield* next(e)
    }
    lastWasChild = true
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
    await $.store.set('log', appendLog(await $.store.get('log'), { day, model: decision.model, kind: decision.kind, label: decision.label, score: decision.score, source: decision.source, child: decision.child || null }, 200))
    return { ...result, text: summaryLine(decision, e.usage) + ' · ' + statsLine(stats, day) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!cfg.ui.band || e.props.hasSurvey) return next(e)
    const theirs = await next(e)
    return bandTree($.ui.resolve(e), bandView(e, theirs), (arg) => pinFrom($, arg))
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const tagged = cfg.ui.tags !== 'off' && e.props.isFirstOfReply
    const model = tagged ? answered.get(e.props.text.trim()) || (cfg.ui.tags === 'all' ? sessionModel : undefined) : undefined
    if (!model) return next(e)
    return tagTree($.ui.resolve(e), tagText(model, sessionModel), await next(e))
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'routing-stats') return next(e)
    const view = { summary: summarize((await $.store.get('log')) || [], sessionModel), sessionModel, thresholds: cfg.thresholds, columns: e.props.bodyColumns, tab }
    return paneTree($.ui.resolve(e), view, (t) => { tab = t; $.ui.invalidate('ui.render') })
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!shouldDelegate({ index: 0 })) return next(e)
    return next({ ...e, props: { ...e.props, suffix: ' · via ' + decision.model + ' (child)…' } })
  })

  on('command.run', { command: 'route' }, async ($, e) => {
    const parsed = parseRouteArg(e.args, cfg.routes)
    if (parsed.mode === 'show') return { text: reportText(bandView({ props: {} })) + ' · ' + statsLine((await $.store.get('stats')) || {}, new Date().toISOString().slice(0, 10)) }
    if (parsed.mode === 'reset') return { text: 'failure memory cleared', ...(await $.store.set('failures', {}) || {}) }
    if (parsed.mode === 'stats') return { ...(await $.ui.open({ id: 'routing-stats', title: 'Mixture of models', focus: true, closeOnEscape: true }) && {}) }
    return { text: await pinFrom($, e.args) }
  })
}
