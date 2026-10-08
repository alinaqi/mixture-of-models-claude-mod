// mixture-of-models: Maggy's model routing as a Claude Code mod, child-process edition.
// Classify each prompt → for a routed tier, answer the turn with a headless
// `claude -p` child on the gateway → the main session never leaves its own model.
import { parseConfig } from './lib/config.js'
import { classifierPrompt, ollamaBody, ollamaReply, parseLabel, preClassify } from './lib/classify.js'
import { parseRouteArg, resolveModel, summaryLine } from './lib/routing.js'
import { buildBrief, childArgv, childEnv, childReady, expandHome, parseEnvFile } from './lib/child.js'
import { bumpStats, statsLine } from './lib/stats.js'
import { bandTree, reportText, tagText, tagTree } from './lib/ui.js'

let cfg = parseConfig('')
let disabled = false
let ready = false
let key = ''
let sessionModel = ''
let pin = { mode: 'auto' }
let decision = { label: 'critical', model: '', source: 'default' }
let lastPrompt = ''
const answered = new Map()

async function readFile($, path) {
  try {
    return await $.fs.read(path)
  } catch {
    return ''
  }
}

async function loadConfig($) {
  const home = (await $.env.get('HOME')) || ''
  cfg = parseConfig(await readFile($, home + '/.claude/model-config.json'))
  key = parseEnvFile(await readFile($, expandHome(cfg.child.keyFile, home)))[cfg.child.keyVar] || ''
  ready = childReady(cfg.child, key)
  sessionModel = await $.session.model()
  pin = (await $.store.get('pin')) || { mode: 'auto' }
}

async function askOllama($, text) {
  try {
    const url = cfg.ollama.base + '/api/chat'
    const r = await $.http.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: ollamaBody(cfg.ollama.model, classifierPrompt(text)) })
    return r.ok ? parseLabel(ollamaReply(r.text)) : undefined
  } catch {
    return undefined
  }
}

async function askClaude($, text) {
  try {
    return await $.model.classify(classifierPrompt(text), ['simple', 'coding', 'analysis', 'critical'], { model: cfg.classifier })
  } catch {
    return undefined
  }
}

async function classify($, text) {
  const local = await askOllama($, text)
  if (local) return { label: local, source: 'ollama' }
  const remote = await askClaude($, text)
  if (remote) return { label: remote, source: 'claude-classify' }
  const cached = await $.store.get('last-label')
  return { label: cached || 'critical', source: cached ? 'cache' : 'default' }
}

async function lastTurnUsedTools($) {
  const messages = await $.session.messages()
  const last = messages.filter((m) => m.role === 'assistant').pop()
  return Boolean(last && last.toolUses.length)
}

function setDecision(label, source) {
  decision = { label, source, model: resolveModel(label, cfg.routes, sessionModel) }
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
  const { label, source } = await classify($, text)
  await $.store.set('last-label', label)
  setDecision(label, source)
}

// The main session's own request goes out whenever the child is not the answer.
function shouldDelegate(e) {
  if (disabled || !ready || pin.mode === 'off' || e.agentId || e.index > 0) return false
  return Boolean(decision.model) && decision.model !== sessionModel
}

async function runChild($) {
  const brief = buildBrief(await $.session.messages(), lastPrompt, cfg.child.contextMessages)
  const started = Date.now()
  try {
    const argv = childArgv(cfg.child, decision.model, await $.session.cwd())
    const r = await $.process.run(argv, { env: childEnv(cfg.child, key), stdin: brief, timeoutMs: cfg.child.timeoutMs })
    const ok = r.exitCode === 0 && r.stdout.trim() !== ''
    decision = { ...decision, child: { ms: Date.now() - started, exitCode: ok ? 0 : r.exitCode || 1 } }
    return ok ? r.stdout.trim() : ''
  } catch {
    decision = { ...decision, child: { ms: Date.now() - started, exitCode: 1 } }
    return ''
  }
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

export function register(on) {
  on('session.start', async ($, e, next) => {
    disabled = Boolean(await $.env.get('MAGGY_ROUTER_CHILD'))
    if (disabled) return next(e)
    await loadConfig($)
    applyPin()
    try {
      await $.command.register({ name: 'route', description: 'Show or pin the model route: /route [auto|off|simple|coding|analysis|critical|<model>]', argumentHint: '[auto|off|label|model]', immediate: true })
    } catch {
      $.ui.log('/route is taken by another plugin')
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (disabled) return next(e)
    lastPrompt = e.text
    await decide($, e.text)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    decision = { label: decision.label, model: decision.model, source: decision.source }
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
    return { text: await pinFrom($, e.args) }
  })
}
