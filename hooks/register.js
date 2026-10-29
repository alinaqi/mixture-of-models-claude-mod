// mixture-of-models: Maggy's routing as a Claude Code mod. Score each prompt; answer a routed
// turn with a headless child (`claude -p` on the gateway or on your Claude login, or `codex exec`);
// the main session never leaves its model.
import { parseConfig } from './lib/config.js'
import { VERDICTS, labelFor, ollamaBody, ollamaReply, parseVerdict, preClassify, sessionTurn } from './lib/classify.js'
import { adjustThresholds, bumpFailures, isBorderline, midTaskGuard, parseRouteArg, summaryLine } from './lib/routing.js'
import { allowPatterns, buildBrief, childArgs, childEnv, childHeaders, childReady, gatewayFrom, parseChildOutput, relayText, subscriptionEnv } from './lib/child.js'
import { checkRoute, familiesText, isAutoRoute, routeValue, targetFor } from './lib/families.js'
import { CODEX_INSTALL, codexArgs, codexAsk, codexBaseUrl, codexBrief, codexEnv, codexReady, codexRelayText, codexResumeArgs, droppedArgs, missingCodex, parseCodexOutput, refusalNote, sandboxOf } from './lib/codex.js'
import { vetAnswer } from './lib/vet.js'
import { appendLog, bumpStats, statsLine, summarize } from './lib/stats.js'
import { paneTree } from './lib/stats-pane.js'
import { bandButtons, bandTree, reportText, tagText, tagTree } from './lib/ui.js'
import { PALGU_GATEWAY } from './lib/palgu.js'
import { palguCommand } from './palgu.js'
import { addTurn, savingsLine, turnNote } from './lib/savings.js'
import { priceTurn } from './savings.js'
import { helpTree } from './lib/help-pane.js'
import { BUILTIN, STRATEGY_DIR, applyStrategy, strategiesText, strategyPrompt } from './lib/strategies.js'
import { loadStrategies } from './strategy.js'
import { routeUpdate } from './update.js'

let cfg = applyStrategy(parseConfig(''), BUILTIN.complexity), configText = '', options = {}, disabled = false, ready = false, codexOk = false, key = '', sessionModel = ''
let pin = { mode: 'auto' }, decision = { label: 'critical', model: '', source: 'default' }, lastPrompt = '', tab = 'models', lastWasChild = false
const answered = new Map()
// Routing strategies: built-ins plus the user's files; `chosen` is a /route strategy pick.
let strategies = BUILTIN, chosen = '', home = ''

function applyGateway() {
  ;({ baseUrl: cfg.child.baseUrl, key } = gatewayFrom(options, cfg.child))
  ready = childReady(cfg.child, key)
  codexOk = codexReady(cfg.codex, { baseUrl: cfg.child.baseUrl, key, provider: cfg.provider })
}

// The provider, and with it the child's auth and default routes, follows the gateway options.
function applyConfig() {
  const base = parseConfig(configText, options)
  cfg = applyStrategy(base, strategies[chosen || base.strategyName] || BUILTIN.complexity)
  applyGateway()
}

// What /palgu reads and changes: a key from /palgu login takes over the child at once.
function palguContext($) {
  const useKey = (k) => {
    options = { ...options, gateway_url: PALGU_GATEWAY, gateway_key: k, gateway_provider: 'palgu' }
    applyConfig()
    $.ui.invalidate('ui.render')
  }
  return { key: () => key, baseUrl: () => cfg.child.baseUrl, useKey }
}

async function loadConfig($) {
  home = (await $.env.get('HOME')) || ''
  configText = await $.fs.read(home + '/.claude/model-config.json').catch(() => '')
  strategies = await loadStrategies($, home)
  chosen = (await $.store.get('strategy')) || ''
  applyConfig()
  const dropped = droppedArgs(cfg.codex)
  if (dropped.length) $.ui.log('router.codex.args: ignored ' + dropped.join(' ') + ' (set router.codex.sandbox or router.codex.allowOutsideGit instead)')
  sessionModel = await $.session.model()
  pin = (await $.store.get('pin')) || { mode: 'auto' }
}

// The only network call the mod makes itself: a local Ollama, fixed address, no credentials.
function askOllama($, text) {
  return $.http.fetch('http://localhost:11434/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ollamaBody(cfg.ollama.model, strategyPrompt(cfg.strategy, text)) })
    .then((r) => (r.ok ? parseVerdict(ollamaReply(r.text)) : undefined)).catch(() => undefined)
}

function askClaude($, text) {
  return $.model.classify(strategyPrompt(cfg.strategy, text), VERDICTS, { model: cfg.classifier }).then(parseVerdict).catch(() => undefined)
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

// A pinned `<family>/auto` still classifies: the tier picks the member inside the pinned family.
function setDecision(label, source, verdict) {
  decision = { label, source, ...(verdict || {}) }
  const pinned = pin.mode === 'model' && isAutoRoute(pin.model) && label !== 'main'
  Object.assign(decision, targetFor(pinned ? pin.model : routeValue(decision, cfg.routes), decision, cfg.families, sessionModel))
}

function applyPin() {
  if (pin.mode === 'label') setDecision(pin.label, 'pin')
  if (pin.mode === 'model') decision = { label: 'pinned', source: 'pin', ...targetFor(pin.model, { label: 'coding' }, cfg.families, sessionModel) }
}

// Notifications, operator commands and security turns stay on the main session, pinned or not.
async function decide($, text) {
  const stay = sessionTurn(text)
  if (stay) return setDecision('main', stay)
  if (pin.mode === 'label' || (pin.mode === 'model' && !isAutoRoute(pin.model))) return applyPin()
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
  if (midTaskGuard(label, ctx)) Object.assign(decision, targetFor('claude', decision, cfg.families, sessionModel))
}

// The gateway child needs the gateway, Codex its own auth; the subscription child only your login.
function runnerReady() {
  return { gateway: ready, codex: codexOk, subscription: true }[decision.runner] || false
}

function shouldDelegate(e) {
  if (disabled || pin.mode === 'off' || e.agentId || e.index > 0) return false
  return runnerReady()
}

// Claude Code itself, headless, on the routed model: on the gateway, or on your Claude login.
// The gateway child's env names the mod and the project to the gateway, after any custom headers the user set.
async function spawnChild($, extra, stdin) {
  const sub = decision.runner === 'subscription'
  const cwd = await $.session.cwd()
  const argv = ['claude', ...childArgs(sub ? { ...cfg.child, args: cfg.child.subscriptionArgs } : cfg.child, decision.id, cwd), ...extra]
  const headers = sub ? '' : childHeaders(cwd, (await $.env.get('ANTHROPIC_CUSTOM_HEADERS')) || '', cfg.child.identify)
  const r = await $.process.run(argv, { env: sub ? subscriptionEnv() : childEnv(cfg.child, key, headers), stdin, timeoutMs: cfg.child.timeoutMs }).catch(() => ({ exitCode: 1, stdout: '' }))
  return parseChildOutput(r.stdout, r.exitCode)
}

// The Codex CLI, non-interactive, on the gateway's /v1/responses or on your own Codex login. With a
// thread id it resumes that thread after the user approved its refused commands.
async function spawnCodex($, stdin, thread) {
  const where = { cwd: await $.session.cwd(), baseUrl: codexBaseUrl(cfg.codex, cfg.child.baseUrl, cfg.provider), provider: cfg.provider, thread }
  const argv = thread ? codexResumeArgs(cfg.codex, decision.id, where) : codexArgs(cfg.codex, decision.id, where)
  const r = await $.process.run(['codex', ...argv], { env: codexEnv(cfg.codex, key, cfg.provider), stdin, timeoutMs: cfg.child.timeoutMs })
    .catch((err) => ({ exitCode: 1, stdout: '', missing: missingCodex(String((err && err.message) || err)) }))
  if (r.missing) $.ui.log(CODEX_INSTALL)
  const out = parseCodexOutput(r.stdout, r.exitCode, r.stderr)
  return { ...out, reason: r.missing ? 'codex not installed' : out.reason }
}

// A command the child was refused becomes a real question here; nobody to ask counts as no.
function askAllow($, question) {
  return $.ui.ask(question, ['Allow and continue', 'Deny']).then((a) => a === 'Allow and continue').catch(() => false)
}

async function claudeTurn($, brief) {
  let out = await spawnChild($, [], brief)
  for (let round = 0; out.ok && out.denials.length && round < cfg.child.relayRounds; round += 1) {
    const patterns = allowPatterns(out.denials)
    if (!(await askAllow($, 'Child on ' + decision.model + ' wants to run: ' + patterns.join(' · ')))) break
    out = await spawnChild($, ['--resume', out.sessionId, '--allowedTools', ...patterns], relayText(patterns))
  }
  return out
}

// Codex cannot be asked mid-run, so the commands it names as refused are asked here, once: on
// "Allow" the same thread resumes with edits allowed. Whatever is still refused is named in the
// answer and on the route line. Only a read-only sandbox is widened; any other is reported as is.
async function codexTurn($, brief) {
  const sandbox = sandboxOf(cfg.codex)
  let out = await spawnCodex($, codexBrief(brief, sandbox)), approved = false
  const commands = out.denials.map((d) => d.command)
  if (sandbox === 'read-only' && out.ok && commands.length && cfg.child.relayRounds > 0 && (await askAllow($, codexAsk(decision.model, commands)))) {
    out = await spawnCodex($, codexRelayText(commands), out.sessionId)
    approved = true
  }
  const refused = out.denials.map((d) => d.command)
  const note = { sandbox: approved ? 'workspace-write (approved)' : sandbox, refused, unnamed: Math.max(0, out.refused - refused.length) }
  return { ...out, answer: out.ok ? (out.answer + refusalNote(refused)).trim() : '', note }
}

async function runChild($) {
  const started = Date.now()
  const brief = buildBrief(await $.session.messages(), lastPrompt, cfg.child.contextMessages)
  const out = decision.runner === 'codex' ? await codexTurn($, brief) : await claudeTurn($, brief)
  // A handback, a request that the user act, an unverified claim, narration or a repeat is discarded.
  const vet = out.ok ? vetAnswer(out, answered) : { ok: false, reason: out.reason || '' }
  decision = { ...decision, child: { ms: Date.now() - started, exitCode: vet.ok ? 0 : 1, rejected: vet.reason, usage: out.usage || null, ...(out.note || {}) } }
  if (!vet.ok) await $.store.set('failures', bumpFailures(await $.store.get('failures'), decision.kind))
  return vet.ok ? out.answer : ''
}

// Help changes nothing: it opens the pane that says what is possible.
function openHelp($) {
  return $.ui.open({ id: 'mom-help', title: 'Mixture of models · help', focus: true, closeOnEscape: true })
}

async function helpView($) {
  const buttons = bandButtons(cfg.routes, cfg.catalogue).map((b) => b.arg).filter((a) => a !== 'help')
  return { pin, ready, provider: cfg.provider, sessionModel, saved: savingsLine(await $.store.get('savings'), sessionModel), buttons, strategy: cfg.strategy }
}

// Re-read the files first, so a strategy the skill just wrote can be picked at once.
async function strategyCommand($, parsed) {
  strategies = await loadStrategies($, home)
  if (parsed.mode === 'strategies') return strategiesText(strategies, cfg.strategy.name, '~' + STRATEGY_DIR)
  const s = strategies[parsed.name]
  if (!s) return 'no routing strategy ' + parsed.name + '; strategies: ' + Object.keys(strategies).join(', ')
  chosen = s.name
  await $.store.set('strategy', chosen)
  applyConfig()
  $.ui.invalidate('ui.render')
  return 'routing strategy: ' + s.name + ' · ' + s.description
}

async function pinFrom($, arg) {
  const parsed = parseRouteArg(arg, cfg.routes, cfg.catalogue)
  if (parsed.mode === 'help') return openHelp($).then(() => '')
  const bad = parsed.mode === 'model' ? checkRoute(parsed.model, cfg.families) : ''
  if (bad) return bad
  pin = parsed
  await $.store.set('pin', pin)
  applyPin()
  $.ui.invalidate('ui.render')
  return 'routing set to ' + pin.mode + (pin.model ? ' ' + pin.model : pin.label ? ' ' + pin.label : '')
}

function bandView(e, theirs) {
  return { disabled, ready: ready || runnerReady(), sessionModel, pin, decision, routes: cfg.routes, catalogue: cfg.catalogue, strategy: cfg.strategy.name, isWorking: e.props.isWorking, theirs }
}

export function register(on, opts) {
  options = opts || {}
  on('session.start', async ($, e, next) => {
    disabled = Boolean(await $.env.get('MAGGY_ROUTER_CHILD'))
    if (disabled) return next(e)
    await loadConfig($)
    applyPin()
    await $.command.register({ name: 'route', description: 'Show or pin the model route, or open the stats pane: /route [status|stats|auto|off|reset|simple|coding|critical|<model>|<family>/<member>|<family>/auto|codex]', argumentHint: '[status|stats|auto|off|reset|label|model|family/member]', immediate: true })
      .catch(() => $.ui.log('/route is taken by another plugin'))
    await $.command.register({ name: 'palgu', description: 'Sign up or sign in to Palgu and route to its models: /palgu [login|status|upgrade]', argumentHint: '[login|status|upgrade]', immediate: true })
      .catch(() => $.ui.log('/palgu is taken by another plugin'))
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
    answered.set(answer, { model: decision.model, runner: decision.runner })
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
    const priced = await priceTurn($, { decision, sessionModel, cfg, key, usage: e.usage })
    await $.store.set('savings', addTurn(await $.store.get('savings'), priced))
    return { ...result, text: summaryLine(decision, e.usage) + (priced.routed ? turnNote(priced) : '') + ' · ' + statsLine(stats, day) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!cfg.ui.band || e.props.hasSurvey) return next(e)
    const theirs = await next(e)
    return bandTree($.ui.resolve(e), bandView(e, theirs), (arg) => pinFrom($, arg))
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const tagged = cfg.ui.tags !== 'off' && e.props.isFirstOfReply
    const hit = tagged ? answered.get(e.props.text.trim()) || (cfg.ui.tags === 'all' ? { model: sessionModel } : undefined) : undefined
    if (!hit) return next(e)
    return tagTree($.ui.resolve(e), tagText(hit.model, sessionModel, hit.runner), await next(e))
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId === 'mom-help') return helpTree($.ui.resolve(e), await helpView($))
    if (e.requestId !== 'routing-stats') return next(e)
    const view = { summary: summarize((await $.store.get('log')) || [], sessionModel), sessionModel, thresholds: cfg.thresholds, columns: e.props.bodyColumns, tab, saved: savingsLine(await $.store.get('savings'), sessionModel) }
    return paneTree($.ui.resolve(e), view, (t) => { tab = t; $.ui.invalidate('ui.render') })
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!shouldDelegate({ index: 0 })) return next(e)
    return next({ ...e, props: { ...e.props, suffix: ' · via ' + decision.model + ' (child)…' } })
  })

  on('command.run', { command: 'palgu' }, async ($, e) => ({ text: await palguCommand($, e.args, palguContext($)) }))

  on('command.run', { command: 'route' }, async ($, e) => {
    const parsed = parseRouteArg(e.args, cfg.routes, cfg.catalogue)
    if (parsed.mode === 'show') return { text: reportText(bandView({ props: {} })) + ' · ' + statsLine((await $.store.get('stats')) || {}, new Date().toISOString().slice(0, 10)) + ' · ' + savingsLine(await $.store.get('savings'), sessionModel) + ' · ' + familiesText(cfg.families) }
    if (parsed.mode === 'reset') return { text: 'failure memory cleared', ...(await $.store.set('failures', {}) || {}) }
    if (parsed.mode === 'stats') return { ...(await $.ui.open({ id: 'routing-stats', title: 'Mixture of models', focus: true, closeOnEscape: true }) && {}) }
    if (parsed.mode === 'help') return { ...(await openHelp($) && {}) }
    if (parsed.mode === 'update') return { text: await routeUpdate($) }
    if (parsed.mode === 'strategies' || parsed.mode === 'strategy') return { text: await strategyCommand($, parsed) }
    return { text: await pinFrom($, e.args) }
  })
}
