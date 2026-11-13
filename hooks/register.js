// mixture-of-models: Maggy's routing as a Claude Code mod. Score each prompt; answer a routed
// turn with a headless child (`claude -p` on the gateway or on your Claude login, or `codex exec`);
// the main session never leaves its model.
import { parseConfig } from './lib/config.js'
import { VERDICTS, labelFor, ollamaBody, ollamaReply, parseVerdict, preClassify, sessionTurn } from './lib/classify.js'
import { adjustThresholds, bumpFailures, isBorderline, midTaskGuard, parseRouteArg, summaryLine } from './lib/routing.js'
import { allowPatterns, buildBrief, childEnv, childFlags, childHeaders, childReady, gatewayFrom, parseChildOutput, relayText, safeArgs, safeModelId, subscriptionEnv } from './lib/child.js'
import { checkRoute, familiesText, isAutoRoute, routeValue, targetFor } from './lib/families.js'
import { CODEX_INSTALL, codexAsk, codexBaseUrl, codexBrief, codexEnv, codexFlags, codexReady, codexRelayText, codexResumeFlags, droppedArgs, missingCodex, parseCodexOutput, refusalNote, sandboxOf } from './lib/codex.js'
import { vetAnswer } from './lib/vet.js'
import { appendLog, bumpStats, statsLine, summarize } from './lib/stats.js'
import { paneTree } from './lib/stats-pane.js'
import { bandButtons, bandTree, reportText, tagText, tagTree } from './lib/ui.js'
import { HELP, PALGU_GATEWAY, configureValues, deviceBody, deviceName, isPalgu, newInstallId, parseBody, parsePalguArg, signedInText, startFailedText, startText, statusText, tokenBody, tokenStep, upgradeText } from './lib/palgu.js'
import { gatewayName } from './lib/providers.js'
import { addTurn, claudeCost, quoteBody, quotedCost, savingsLine, tableCost, turnNote } from './lib/savings.js'
import { helpTree } from './lib/help-pane.js'
import { BUILTIN, STRATEGY_DIR, applyStrategy, parseStrategy, strategiesText, strategyFiles, strategyPrompt } from './lib/strategies.js'
import { liveCatalogue, liveModels, modelsText } from './lib/catalogue.js'
import { failedRun, isNewer, lastLine, latestVersion, updateText } from './lib/update.js'
import { VERSION } from './lib/version.js'
import { continuePrompt, heartbeatBody, heartbeatMode, localVerdict, palguVerdict, shouldCheck, turnUsedTools } from './lib/heartbeat.js'
import { indexDue, memoryLine, memoryOn, memoryStatus, setMemory } from './lib/memory.js'
import { recallBlock, recallQuery, withRecall } from './lib/recall.js'

// Every capability call in this module is written `$.noun.method(...)`, and `$` is handed only,
// whole, to this file's own top-level functions. Network hosts are fixed https:// URLs written at
// each $.http.fetch call, except the local Ollama classifier. No value from a network answer is
// ever on a $.process.run argv; see each call.

let cfg = applyStrategy(parseConfig(''), BUILTIN.complexity), configText = '', options = {}, disabled = false, ready = false, codexOk = false, key = '', sessionModel = ''
let pin = { mode: 'auto' }, decision = { label: 'critical', model: '', source: 'default' }, lastPrompt = '', tab = 'models', lastWasChild = false
const answered = new Map()
// Routing strategies: built-ins plus the user's files; `chosen` is a /route strategy pick.
let strategies = BUILTIN, chosen = '', home = '', polling = false
// What Palgu serves now (GET /v1/models/health), saved for the next session; null: the built-in list.
let live = null, modelsAsk = 0
// The heartbeat's continues for the person's current prompt, and that prompt's number.
// sessionTag: a random id per session, so Palgu's heartbeat budget is never shared between sessions.
let beats = 0, promptSeq = 0, cwd = '', sessionTag = newInstallId()
// The Palgu memory project of this folder (from `palgu memory status`) and this prompt's recall.
let memoryProject = '', recalled = ''
const PLUGIN_NAME = 'mixture-of-models'
const FAILED = { ok: false, status: 0, text: '' }
const PANES = { 'mom-help': 'Mixture of models · help', 'routing-stats': 'Mixture of models' }

function applyGateway() {
  ;({ baseUrl: cfg.child.baseUrl, key } = gatewayFrom(options, cfg.child))
  ready = childReady(cfg.child, key)
  codexOk = codexReady(cfg.codex, { baseUrl: cfg.child.baseUrl, key, provider: cfg.provider })
}

// The provider, and with it the child's auth and default routes, follows the gateway options.
function applyConfig() {
  const base = parseConfig(configText, options)
  cfg = applyStrategy(base, strategies[chosen || base.strategyName] || BUILTIN.complexity)
  Object.assign(cfg, liveCatalogue(cfg.catalogue, cfg.provider === 'palgu' ? live : null))
  applyGateway()
}

// The user's routing strategies from ~/.claude/mixture-of-models/strategies/*.md. A file that will
// not parse is named in the log and skipped; a file named like a built-in replaces it.
async function readStrategies($, dir) {
  const all = { ...BUILTIN }
  for (const name of strategyFiles(await $.fs.list(dir).catch(() => []))) {
    const s = parseStrategy(await $.fs.read(dir + '/' + name).catch(() => ''), name.slice(0, -3))
    if (s.error) $.ui.log('routing strategy ' + name + ' skipped: ' + s.error)
    else all[s.name] = s
  }
  return all
}

// The only local files read: ~/.claude/model-config.json and the strategy files. Neither is sent anywhere.
async function loadConfig($, homeDir) {
  configText = await $.fs.read(homeDir + '/.claude/model-config.json').catch(() => '')
  strategies = await readStrategies($, homeDir + STRATEGY_DIR)
  chosen = (await $.store.get('strategy')) || ''
  live = (await $.store.get('palgu-models')) || null
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

// Every route resolves here, so a gateway model always goes out under the name its gateway takes.
function routeTo(value, d) {
  const t = targetFor(value, d, cfg.families, sessionModel)
  return t.runner === 'gateway' ? { ...t, id: gatewayName(cfg.provider, t.id) } : t
}

// A pinned `<family>/auto` still classifies: the tier picks the member inside the pinned family.
function setDecision(label, source, verdict) {
  decision = { label, source, ...(verdict || {}) }
  const pinned = pin.mode === 'model' && isAutoRoute(pin.model) && label !== 'main'
  Object.assign(decision, routeTo(pinned ? pin.model : routeValue(decision, cfg.routes), decision))
}

function applyPin() {
  if (pin.mode === 'label') setDecision(pin.label, 'pin')
  if (pin.mode === 'model') decision = { label: 'pinned', source: 'pin', ...routeTo(pin.model, { label: 'coding' }) }
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
  if (midTaskGuard(label, ctx)) Object.assign(decision, routeTo('claude', decision))
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
// Nothing from $.http.fetch reaches the argv: the model id and child.args/deny come from the user's
// settings, cwd from the session, and on --resume the session id and the commands the user approved
// in $.ui.ask from the child's own last run. All are checked (safeModelId, safeArgs); no shell runs it.
async function spawnChild($, resume, stdin) {
  const sub = decision.runner === 'subscription'
  const cwd = await $.session.cwd()
  const headers = sub ? '' : childHeaders(cwd, (await $.env.get('ANTHROPIC_CUSTOM_HEADERS')) || '', cfg.child.identify, decision.id)
  const a = { cwd, turns: String(cfg.child.maxTurns), tail: childFlags(sub ? { ...cfg.child, args: cfg.child.subscriptionArgs } : cfg.child), env: sub ? subscriptionEnv() : childEnv(cfg.child, key, headers), stdin }
  const resumed = resume ? [resume.sessionId, ...resume.patterns] : []
  if (!safeModelId(decision.id) || !safeArgs([cwd, ...a.tail, ...resumed])) return { ...parseChildOutput('', 1), reason: 'argument refused' }
  const r = await (resume ? resumeClaude($, a, resume) : startClaude($, a)).catch(() => ({ exitCode: 1, stdout: '' }))
  return parseChildOutput(r.stdout, r.exitCode)
}

function startClaude($, a) {
  return $.process.run(['claude', '-p', '--model', decision.id, '--output-format', 'json', '--max-turns', a.turns, '--add-dir', a.cwd, ...a.tail], { env: a.env, stdin: a.stdin, timeoutMs: cfg.child.timeoutMs })
}

function resumeClaude($, a, resume) {
  return $.process.run(['claude', '-p', '--model', decision.id, '--output-format', 'json', '--max-turns', a.turns, '--add-dir', a.cwd, ...a.tail, '--resume', resume.sessionId, '--allowedTools', ...resume.patterns], { env: a.env, stdin: a.stdin, timeoutMs: cfg.child.timeoutMs })
}

// The Codex CLI, non-interactive, on the gateway's /v1/responses or on your own Codex login. With a
// thread id it resumes that thread after the user approved its refused commands. As with the
// claude child, nothing from $.http.fetch reaches the argv, every dynamic value is checked, no shell.
async function spawnCodex($, stdin, thread) {
  const where = { cwd: await $.session.cwd(), baseUrl: codexBaseUrl(cfg.codex, cfg.child.baseUrl, cfg.provider), provider: cfg.provider, thread }
  const a = { cwd: where.cwd, thread, stdin, flags: thread ? codexResumeFlags(cfg.codex, decision.id, where) : codexFlags(cfg.codex, decision.id, where) }
  if (![decision.id, thread].filter(Boolean).every(safeModelId) || !safeArgs([a.cwd, ...a.flags])) return { ...parseCodexOutput('', 1, ''), reason: 'argument refused' }
  const r = await (thread ? resumeCodex($, a) : startCodex($, a))
    .catch((err) => ({ exitCode: 1, stdout: '', missing: missingCodex(String((err && err.message) || err)) }))
  if (r.missing) $.ui.log(CODEX_INSTALL)
  const out = parseCodexOutput(r.stdout, r.exitCode, r.stderr)
  return { ...out, reason: r.missing ? 'codex not installed' : out.reason }
}

function startCodex($, a) {
  return $.process.run(['codex', 'exec', '--json', ...a.flags, '-'], { env: codexEnv(cfg.codex, key, cfg.provider), stdin: a.stdin, timeoutMs: cfg.child.timeoutMs })
}

function resumeCodex($, a) {
  return $.process.run(['codex', 'exec', '-C', a.cwd, 'resume', '--json', ...a.flags, a.thread, '-'], { env: codexEnv(cfg.codex, key, cfg.provider), stdin: a.stdin, timeoutMs: cfg.child.timeoutMs })
}

// A command the child was refused becomes a real question here; nobody to ask counts as no.
function askAllow($, question) {
  return $.ui.ask(question, ['Allow and continue', 'Deny']).then((a) => a === 'Allow and continue').catch(() => false)
}

async function claudeTurn($, brief) {
  let out = await spawnChild($, null, brief)
  for (let round = 0; out.ok && out.denials.length && round < cfg.child.relayRounds; round += 1) {
    const patterns = allowPatterns(out.denials)
    if (!(await askAllow($, 'Child on ' + decision.model + ' wants to run: ' + patterns.join(' · ')))) break
    out = await spawnChild($, { sessionId: out.sessionId, patterns }, relayText(patterns))
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

// The child's stdin: the prompt and the last few messages of this session (buildBrief). That
// is what leaves the machine, to the routed model's gateway, and only on a routed turn.
async function runChild($, prompt) {
  const started = Date.now()
  const brief = withRecall(buildBrief(await $.session.messages(), prompt, cfg.child.contextMessages), recalled)
  const out = decision.runner === 'codex' ? await codexTurn($, brief) : await claudeTurn($, brief)
  // A handback, a request that the user act, an unverified claim, narration or a repeat is discarded.
  const vet = out.ok ? vetAnswer(out, answered) : { ok: false, reason: out.reason || '' }
  decision = { ...decision, child: { ms: Date.now() - started, exitCode: vet.ok ? 0 : 1, rejected: vet.reason, usage: out.usage || null, ...(out.note || {}) } }
  if (!vet.ok) await $.store.set('failures', bumpFailures(await $.store.get('failures'), decision.kind))
  return vet.ok ? out.answer : ''
}

// Help changes nothing: it opens the pane that says what is possible. Stats opens the chart pane.
function openPane($, id) {
  return $.ui.open({ id, title: PANES[id], focus: true, closeOnEscape: true })
}

async function helpView($, c) {
  const buttons = bandButtons(c.routes, c.band).map((b) => b.arg).filter((a) => a !== 'help')
  return { pin, ready, provider: c.provider, sessionModel, saved: savingsLine(await $.store.get('savings'), sessionModel), buttons, strategy: c.strategy }
}

// Re-read the files first, so a strategy the skill just wrote can be picked at once.
async function strategyCommand($, parsed) {
  strategies = await readStrategies($, home + STRATEGY_DIR)
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
  if (parsed.mode === 'help') return openPane($, 'mom-help').then(() => '')
  const bad = parsed.mode === 'model' ? checkRoute(parsed.model, cfg.families) : ''
  if (bad) return bad
  pin = parsed
  await $.store.set('pin', pin)
  applyPin()
  $.ui.invalidate('ui.render')
  return 'routing set to ' + pin.mode + (pin.model ? ' ' + pin.model : pin.label ? ' ' + pin.label : '')
}

// Palgu: each request goes to a fixed https://api.palgu.ai URL written whole at its call. A key
// goes there only when the gateway is Palgu (isPalgu, checked by the callers).
function palguDeviceCode($, body) {
  return $.http.fetch('https://api.palgu.ai/auth/device/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => FAILED)
}

function palguToken($, body) {
  return $.http.fetch('https://api.palgu.ai/auth/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => FAILED)
}

function palguMe($, k) {
  return $.http.fetch('https://api.palgu.ai/me', { method: 'GET', headers: { authorization: 'Bearer ' + k } }).catch(() => FAILED)
}

// The models Palgu serves now and their health. Asked with the mod's key, only when the gateway is Palgu.
function palguModels($, k) {
  return $.http.fetch('https://api.palgu.ai/v1/models/health', { method: 'GET', headers: { 'x-api-key': k } }).catch(() => FAILED)
}

// A list that cannot be read keeps the last one (saved, or built in).
// Each ask is numbered, so an older answer that arrives late never replaces a newer one.
async function refreshModels($) {
  if (!isPalgu(cfg.child.baseUrl) || !key) return null
  const ask = ++modelsAsk
  const fresh = liveModels(await palguModels($, key))
  if (!fresh || ask !== modelsAsk) return null
  live = fresh
  await $.store.set('palgu-models', live)
  applyConfig()
  $.ui.invalidate('ui.render')
  return live
}

async function modelsCommand($) {
  const fresh = await refreshModels($)
  return modelsText(fresh || (cfg.provider === 'palgu' ? live : null), cfg.provider, !fresh)
}

// Palgu prices the child's usage with the formula it bills by: model id and token counts, no text.
function palguQuote($, model, usage) {
  return $.http.fetch('https://api.palgu.ai/v1/pricing/quote', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify(quoteBody(model, usage)) })
    .then(quotedCost).catch(() => null)
}

async function installId($, storeKey) {
  const saved = await $.store.get(storeKey)
  if (saved) return saved
  const id = newInstallId()
  await $.store.set(storeKey, id)
  return id
}

// A key from /palgu login takes over the child at once; saving it is for the next session.
function registered() { return true }

function refused() { return false }

function usePalguKey($, k) {
  options = { ...options, gateway_url: PALGU_GATEWAY, gateway_key: k, gateway_provider: 'palgu' }
  applyConfig()
  $.ui.invalidate('ui.render')
  refreshModels($)
}

// Program and arguments are fixed text. The one fetched value near here, the key Palgu minted, is
// never on argv: it travels on stdin, and only after tokenStep checked it is one plain token (isPalguKey).
async function savePalguKey($, signed) {
  usePalguKey($, signed.key)
  const r = await $.process.run(['claude', 'plugin', 'configure', 'mixture-of-models@mixture-of-models-claude-mod', '--values-stdin'], { stdin: configureValues(signed.key) }).catch(() => ({ exitCode: 1 }))
  const note = r.exitCode === 0 ? '' : ' The key could not be saved for later sessions: run /palgu login there again.'
  $.ui.toast(signedInText(signed) + note, { timeoutMs: 10000 })
}

function pollPalgu($, start, interval) {
  $.clock.after(interval * 1000, () => palguStep($, start, interval))
}

async function palguStep($, start, interval) {
  const step = tokenStep(await palguToken($, tokenBody(start.device_code)), interval)
  if (step.state === 'wait') return pollPalgu($, start, step.interval)
  polling = false
  if (step.state === 'ok') return savePalguKey($, step)
  $.ui.toast('Palgu sign-in stopped: ' + step.reason, { timeoutMs: 10000 })
}

async function palguLogin($, name) {
  if (polling) return 'A Palgu sign-in is already waiting for your approval.'
  const res = await palguDeviceCode($, deviceBody(name, await installId($, 'palgu-install-id')))
  const start = res.ok ? parseBody(res) : {}
  if (!start.device_code) return startFailedText(res.status || 'unreachable')
  polling = true
  pollPalgu($, start, Number(start.interval) || 5)
  return startText(start)
}

async function palguStatus($, k) {
  if (!k) return statusText(undefined)
  if (!isPalgu(cfg.child.baseUrl)) return statusText('other')
  const res = await palguMe($, k)
  return statusText(res.ok ? parseBody(res) : null)
}

// Palgu memory (issue #24) runs through the palgu CLI, which uses its own sign-in: no key of the
// mod's is on its argv, env or stdin. Program and arguments are fixed text.
function signedInToPalgu() {
  return isPalgu(cfg.child.baseUrl) && Boolean(key)
}

async function memoryHere($) {
  return memoryOn(await $.store.get('palgu-memory'), cwd)
}

async function memoryNow($) {
  if (!(await memoryHere($))) return { on: false }
  const r = await $.process.run(['palgu', 'memory', 'status', '.', '--json'], { cwd, timeoutMs: 30000 }).catch(() => null)
  const status = r ? memoryStatus(r) : null
  if (status && status.indexed) memoryProject = status.project
  return { on: true, status, now: Date.now(), missing: !r }
}

// What Palgu memory holds for this prompt (recall.js), asked with the mod's key (`memory:read`),
// at most 3 s so a slow Palgu never holds up a prompt. '' when memory is off here or has nothing.
function untimed() {
  return new Promise(() => undefined)
}

function palguRecall($, query) {
  const url = 'https://api.palgu.ai/v1/cortex/search?limit=8&project=' + encodeURIComponent(memoryProject) + '&q=' + encodeURIComponent(query)
  return $.http.fetch(url, { method: 'GET', headers: { authorization: 'Bearer ' + key } }).catch(() => FAILED)
}

async function recall($, text) {
  const query = recallQuery(text)
  if (!query || !memoryProject || !signedInToPalgu() || !(await memoryHere($))) return ''
  // A clock that cannot sleep leaves the search untimed rather than dropping it.
  const res = await Promise.race([palguRecall($, query), $.clock.sleep(3000).then(() => FAILED, untimed)])
  return recallBlock(res, memoryProject)
}

// One background `palgu memory index .` per project at most every INDEX_EVERY_MS; palgu itself
// pushes nothing when nothing changed. Never awaited by a hook, never fails the session.
async function indexProject($) {
  const on = await memoryHere($)
  const last = (await $.store.get('palgu-memory-index')) || {}
  if (!indexDue({ on, signedIn: signedInToPalgu(), installed: true }, last[cwd], Date.now())) return
  await $.store.set('palgu-memory-index', { ...last, [cwd]: Date.now() })
  const r = await $.process.run(['palgu', 'memory', 'index', '.'], { cwd, timeoutMs: 600000 }).catch(failedRun)
  if (r.exitCode !== 0) $.ui.log('Palgu memory: indexing ' + cwd + ' failed: ' + lastLine(r))
  else if (!memoryProject) await memoryNow($)
}

async function memoryCommand($, word) {
  const saved = await $.store.get('palgu-memory')
  if (word === 'memory off') await $.store.set('palgu-memory', setMemory(saved, cwd, false))
  if (word === 'memory on' && !signedInToPalgu()) return 'Palgu memory needs Palgu: sign in with /palgu login first.'
  if (word === 'memory on') await $.store.set('palgu-memory', setMemory(saved, cwd, true))
  if (word === 'memory on') indexProject($).catch(() => undefined)
  return memoryLine(await memoryNow($))
}

// /palgu: device-code sign-in polled in the background on the mod's clock, status, upgrade, memory.
async function palguCommand($, args) {
  const word = parsePalguArg(args)
  if (word === 'login') return palguLogin($, deviceName((await $.env.get('HOSTNAME')) || ''))
  if (word === 'status') return (await palguStatus($, key)) + (signedInToPalgu() ? ' · ' + memoryLine(await memoryNow($)) : '')
  if (word.startsWith('memory')) return memoryCommand($, word)
  return word === 'upgrade' ? upgradeText() : HELP
}

// The heartbeat (issue #25): Palgu's verdict when it is the gateway, else (or when Palgu does not
// answer) the same classifier here. Only the answer's last 600 characters go, with the mod's key.
function palguHeartbeat($, body) {
  return $.http.fetch('https://api.palgu.ai/anthropic/heartbeat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key }, body: JSON.stringify(body) }).catch(() => FAILED)
}

async function heartbeatVerdict($, answer, usedTools) {
  const mode = heartbeatMode(cfg.heartbeat.mode, signedInToPalgu())
  const sessionId = sessionTag + ':' + promptSeq
  const palgu = mode === 'palgu' ? palguVerdict(await palguHeartbeat($, heartbeatBody(sessionId, answer))) : null
  return palgu || localVerdict(answer, usedTools)
}

// A stop worth healing gets one continue prompt of the mod's own, a turn once the session is idle.
// A verdict that arrives after a new prompt of yours, or past the budget, is dropped.
async function heartbeat($, e) {
  const mode = heartbeatMode(cfg.heartbeat.mode, signedInToPalgu())
  const seq = promptSeq, asked = lastPrompt
  if (!shouldCheck(e, { mode, used: beats, max: cfg.heartbeat.max, child: Boolean(decision.child) })) return
  const verdict = await heartbeatVerdict($, e.answer, turnUsedTools(await $.session.messages()))
  const text = continuePrompt(verdict, asked)
  if (!text || seq !== promptSeq || beats >= cfg.heartbeat.max) return
  beats += 1
  $.prompt.submit({ text })
}

// What a routed turn cost: Palgu's own quote, router.prices, or Claude rates for a Claude member.
async function actualCost($, d) {
  if (d.runner === 'subscription') return claudeCost(d.child.usage, d.id)
  if (d.runner !== 'gateway') return null
  const listed = tableCost(d.child.usage, d.id, cfg.prices)
  if (listed !== null || !isPalgu(cfg.child.baseUrl) || !key) return listed
  return palguQuote($, d.id, d.child.usage)
}

// A routed turn at the session's Claude model and at what it cost; a main-session turn at the session's model.
async function priceTurn($, usage) {
  const child = decision.child
  if (!child || child.exitCode !== 0) return { routed: false, baseline: claudeCost(usage, sessionModel) }
  const baseline = claudeCost(child.usage, sessionModel)
  return { routed: true, baseline, actual: baseline === null ? null : await actualCost($, decision) }
}

// /route update: GitHub's answer only says whether a newer version exists. Nothing in it reaches
// $.process.run: both update commands are fixed text. The new code loads on restart.
async function routeUpdate($, current) {
  const latest = latestVersion(await $.http.fetch('https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json', { method: 'GET' }).catch(() => null))
  if (!latest || !isNewer(latest, current)) return updateText({ current, latest })
  const market = await $.process.run(['claude', 'plugin', 'marketplace', 'update', 'mixture-of-models-claude-mod'], { timeoutMs: 120000 }).catch(failedRun)
  if (market.exitCode !== 0) return updateText({ current, latest, updated: false, error: lastLine(market) })
  const plugin = await $.process.run(['claude', 'plugin', 'update', 'mixture-of-models@mixture-of-models-claude-mod'], { timeoutMs: 120000 }).catch(failedRun)
  return updateText({ current, latest, updated: plugin.exitCode === 0, error: lastLine(plugin) })
}

function bandView(e, theirs) {
  return { disabled, ready: ready || runnerReady(), sessionModel, pin, decision, routes: cfg.routes, catalogue: cfg.band, strategy: cfg.strategy.name, isWorking: e.props.isWorking, theirs }
}

export function register(on, opts) {
  options = opts || {}
  on('session.start', async ($, e, next) => {
    disabled = Boolean(await $.env.get('MAGGY_ROUTER_CHILD'))
    if (disabled) return next(e)
    home = (await $.env.get('HOME')) || ''
    await loadConfig($, home)
    applyPin()
    // In the background: a slow Palgu never holds up the session.
    cwd = e.cwd || (await $.session.cwd())
    refreshModels($)
    indexProject($).catch(() => undefined)
    memoryNow($).catch(() => undefined)
    // A failed registration resolves to false (no closure over $), and the log call stays plain.
    const routeOk = await $.command.register({ name: 'route', description: 'Show or pin the model route, or open the stats pane: /route [status|stats|models|auto|off|reset|simple|coding|critical|<model>|<family>/<member>|<family>/auto|codex]', argumentHint: '[status|stats|models|auto|off|reset|label|model|family/member]', immediate: true }).then(registered, refused)
    if (!routeOk) $.ui.log('/route is taken by another plugin')
    const palguOk = await $.command.register({ name: 'palgu', description: 'Sign up or sign in to Palgu and route to its models: /palgu [login|status|upgrade]', argumentHint: '[login|status|upgrade]', immediate: true }).then(registered, refused)
    if (!palguOk) $.ui.log('/palgu is taken by another plugin')
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (disabled) return next(e)
    // The heartbeat's own continue stays on the main session, the one that stopped mid-task.
    if (e.origin && e.origin.kind === 'plugin' && e.origin.name === PLUGIN_NAME) {
      setDecision('main', 'heartbeat')
      return next(e)
    }
    beats = 0
    promptSeq += 1
    lastPrompt = e.text
    // Palgu memory goes to whichever model answers: beside the prompt for the main session, in the brief for a child.
    const [, block] = await Promise.all([decide($, e.text), e.command || e.isMeta ? '' : recall($, e.text).catch(() => '')])
    recalled = block
    return next(block ? { ...e, context: [...(e.context || []), block] } : e)
  }).catch(async ($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    decision = { ...decision, child: undefined }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) lastWasChild = false
    if (!shouldDelegate(e)) return yield* next(e)
    const answer = await runChild($, lastPrompt)
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
    if (!disabled) heartbeat($, e).catch(() => undefined)
    if (disabled || e.agentId || !cfg.summary || !decision.model) return result
    const day = new Date().toISOString().slice(0, 10)
    const stats = bumpStats((await $.store.get('stats')) || {}, day, decision.model)
    await $.store.set('stats', stats)
    await $.store.set('log', appendLog(await $.store.get('log'), { day, model: decision.model, kind: decision.kind, label: decision.label, score: decision.score, source: decision.source, child: decision.child || null }, 200))
    const priced = await priceTurn($, e.usage)
    await $.store.set('savings', addTurn(await $.store.get('savings'), priced))
    return { ...result, text: summaryLine(decision, e.usage) + (priced.routed ? turnNote(priced) : '') + ' · ' + statsLine(stats, day) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!cfg.ui.band || e.props.hasSurvey) return next(e)
    const theirs = await next(e)
    const ui = $.ui.resolve(e)
    return bandTree(ui, bandView(e, theirs), (arg) => pinFrom($, arg))
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const tagged = cfg.ui.tags !== 'off' && e.props.isFirstOfReply
    const hit = tagged ? answered.get(e.props.text.trim()) || (cfg.ui.tags === 'all' ? { model: sessionModel } : undefined) : undefined
    if (!hit) return next(e)
    const ui = $.ui.resolve(e)
    return tagTree(ui, tagText(hit.model, sessionModel, hit.runner), await next(e))
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'mom-help' && e.requestId !== 'routing-stats') return next(e)
    const ui = $.ui.resolve(e)
    if (e.requestId === 'mom-help') return helpTree(ui, await helpView($, cfg))
    const view = { summary: summarize((await $.store.get('log')) || [], sessionModel), sessionModel, thresholds: cfg.thresholds, columns: e.props.bodyColumns, tab, saved: savingsLine(await $.store.get('savings'), sessionModel) }
    return paneTree(ui, view, (t) => { tab = t; $.ui.invalidate('ui.render') })
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!shouldDelegate({ index: 0 })) return next(e)
    return next({ ...e, props: { ...e.props, suffix: ' · via ' + decision.model + ' (child)…' } })
  })

  on('command.run', { command: 'palgu' }, async ($, e) => ({ text: await palguCommand($, e.args) }))

  on('command.run', { command: 'route' }, async ($, e) => {
    const parsed = parseRouteArg(e.args, cfg.routes, cfg.catalogue)
    if (parsed.mode === 'show') return { text: reportText(bandView({ props: {} })) + ' · ' + statsLine((await $.store.get('stats')) || {}, new Date().toISOString().slice(0, 10)) + ' · ' + savingsLine(await $.store.get('savings'), sessionModel) + ' · ' + familiesText(cfg.families) }
    if (parsed.mode === 'reset') return { text: 'failure memory cleared', ...(await $.store.set('failures', {}) || {}) }
    if (parsed.mode === 'stats') return { ...(await openPane($, 'routing-stats') && {}) }
    if (parsed.mode === 'help') return { ...(await openPane($, 'mom-help') && {}) }
    if (parsed.mode === 'update') return { text: await routeUpdate($, VERSION) }
    if (parsed.mode === 'models') return { text: await modelsCommand($) }
    if (parsed.mode === 'strategies' || parsed.mode === 'strategy') return { text: await strategyCommand($, parsed) }
    return { text: await pinFrom($, e.args) }
  })
}
