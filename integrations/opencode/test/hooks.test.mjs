// The plugin's hooks driven through a fake OpenCode: its SDK client, chat.message / chat.headers
// payloads and bus events as OpenCode 1.19 sends them (packages/plugin/src/index.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeHooks } from '../lib/hooks.js'
import { REASONS } from '../../../hooks/lib/heartbeat.js'

const ok = (body) => ({ ok: true, status: 200, text: JSON.stringify(body) })
const HITS = ok({ project: 'work', indexed: true, hits: [{ kind: 'intent', ref: 'adr:ADR-001', title: 'ADR-001: Delegate routed turns', snippet: '', meta: {} }] })
const MODELS = { auto: {}, 'claude-opus': {}, 'deepseek-pro': {} }
const CFG = { provider: { palgu: { options: { baseURL: 'https://api.palgu.ai/anthropic/v1' }, models: MODELS } } }

function fakeIo(calls, verdict) {
  return {
    key: 'k-123456789', now: 1000, tool: 'opencode',
    async projectName() { return 'work' },
    async search(project, q) { calls.push(['search', project, q]); return HITS },
    async heartbeat(body) { calls.push(['heartbeat', body]); return ok(verdict) },
    indexInBackground(cwd) { calls.push(['index', cwd]) }
  }
}

function fakeClient(calls, data) {
  return {
    session: {
      get: async ({ path }) => ({ data: { id: path.id, parentID: data.parentID } }),
      messages: async () => { if (data.fail) throw new Error('down'); return { data: data.messages || [] } },
      promptAsync: async (o) => { calls.push(['prompt', o]); return { data: {} } }
    },
    tui: { showToast: async (o) => { calls.push(['toast', o.body.message]) } }
  }
}

const PREMATURE = { assessment: 'premature', should_continue: true, reason: REASONS.premature }
const COMPLETE = { assessment: 'complete', should_continue: false, reason: '' }

function setup(o = {}) {
  const calls = []
  let disk = o.state || {}
  const deps = {
    client: fakeClient(calls, o),
    directory: '/work',
    options: o.options || {},
    version: '9.9.9',
    stateEnv: () => ({ io: fakeIo(calls, o.verdict || COMPLETE), read: () => disk, write: (s) => { disk = s } }),
    classify: async () => o.classified,
    commands: { memory: async (w) => ({ out: 'Palgu memory: ' + w + '\n' }), heartbeat: (m) => ({ out: 'Heartbeat: ' + m + '\n' }), status: async () => ({ out: 'Palgu: signed in\n' }) },
    log: () => undefined
  }
  const hooks = makeHooks(deps)
  return { hooks, calls, disk: () => disk }
}

function userTurn(text, modelID = 'auto', providerID = 'palgu') {
  const message = { id: 'm1', sessionID: 's1', role: 'user', agent: 'build', model: { providerID, modelID } }
  return [{ sessionID: 's1', agent: 'build', model: { providerID, modelID } }, { message, parts: [{ type: 'text', text }] }]
}

async function send(hooks, text, modelID, providerID) {
  const [input, output] = userTurn(text, modelID, providerID)
  await hooks['chat.message'](input, output)
  const headers = { headers: {} }
  const used = output.message.model
  await hooks['chat.headers']({ sessionID: 's1', agent: 'build', model: { id: used.modelID, providerID: used.providerID }, provider: { info: { id: used.providerID } }, message: output.message }, headers)
  return { message: output.message, parts: output.parts, headers: headers.headers }
}

const idle = (hooks) => hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's1' } } })
const history = (answer, error) => [
  { info: { role: 'user', agent: 'build', model: { providerID: 'palgu', modelID: 'auto' } }, parts: [{ type: 'text', text: 'fix the loader' }] },
  { info: { role: 'assistant', ...(error ? { error } : {}) }, parts: [{ type: 'text', text: answer }] }
]

test('the config hook registers /route and /palgu without replacing the person\'s own commands', async () => {
  const { hooks } = setup()
  const cfg = { ...CFG, command: { palgu: { template: 'mine' } } }
  await hooks.config(cfg)
  assert.equal(cfg.command.palgu.template, 'mine')
  assert.match(cfg.command.route.template, /\$ARGUMENTS/)
})

test('critical work goes to the configured critical model: the message\'s model and the pin header', async () => {
  const { hooks } = setup({ options: { critical: 'claude-opus' } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'use claude to plan the database migration')
  assert.deepEqual(r.message.model, { providerID: 'palgu', modelID: 'claude-opus' })
  assert.equal(r.headers['x-srooter-pin'], 'claude-opus')
  assert.equal(r.headers['x-srooter-client'], 'mixture-of-models-opencode/9.9.9')
  assert.equal(r.headers['x-srooter-project'], 'work')
  assert.equal(r.headers['x-api-key'], 'k-123456789')
})

test('OpenCode\'s own title and summary requests are not pinned: Palgu serves them from its cheap tier', async () => {
  const { hooks } = setup({ options: { critical: 'claude-opus' } })
  await hooks.config(structuredClone(CFG))
  await send(hooks, 'use claude to plan the database migration')
  const out = { headers: {} }
  await hooks['chat.headers']({ sessionID: 's1', agent: 'title', model: { id: 'auto', providerID: 'palgu' } }, out)
  assert.equal('x-srooter-pin' in out.headers, false)
  assert.equal(out.headers['x-srooter-client'], 'mixture-of-models-opencode/9.9.9')
})

test('without routes Palgu routes: the model stays auto and no pin is sent', async () => {
  const { hooks } = setup()
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'add a retry to the http client and test it')
  assert.equal(r.message.model.modelID, 'auto')
  assert.equal('x-srooter-pin' in r.headers, false)
})

test('the classifier\'s tier picks its route; a model the config does not list is pinned by header only', async () => {
  const { hooks } = setup({ options: { routes: { simple: 'gemini-3.8-flash' } }, classified: { score: 2, kind: 'docs' } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'fix the typo in the readme intro please')
  assert.equal(r.message.model.modelID, 'auto')
  assert.equal(r.headers['x-srooter-pin'], 'gemini-3.8-flash')
})

test('another provider is left alone, and the key never goes to a host that is not Palgu', async () => {
  const { hooks } = setup({ options: { critical: 'claude-opus' } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'use claude to plan the database migration', 'claude-sonnet-5', 'anthropic')
  assert.equal(r.message.model.modelID, 'claude-sonnet-5')
  assert.deepEqual(r.headers, {})
  const other = setup()
  await other.hooks.config({ provider: { palgu: { options: { baseURL: 'https://example.com/v1' }, models: MODELS } } })
  assert.equal('x-api-key' in (await send(other.hooks, 'add a retry to the http client please')).headers, false)
})

test('Palgu memory is recalled into the message\'s system text where memory is on', async () => {
  const { hooks, calls } = setup({ state: { memory: { '/work': true } } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'refactor the config loader to cache reads')
  assert.match(r.message.system, /^Palgu memory for work/)
  assert.deepEqual(calls.find((c) => c[0] === 'search'), ['search', 'work', 'refactor the config loader to cache reads'])
  const off = setup()
  assert.equal((await send(off.hooks, 'refactor the config loader to cache reads')).message.system, undefined)
})

test('the heartbeat continues a mid-task stop on idle, up to the budget, and its prompt does not reset it', async () => {
  const { hooks, calls, disk } = setup({ verdict: PREMATURE, messages: history('Let me check the tests next.') })
  await send(hooks, 'fix the loader')
  for (let i = 0; i < 3; i += 1) {
    await idle(hooks)
    const p = calls.filter((c) => c[0] === 'prompt').pop()[1]
    assert.equal(p.body.parts[0].text, REASONS.premature)
    assert.equal(p.body.agent, 'build')
    await send(hooks, REASONS.premature)
  }
  await idle(hooks)
  assert.equal(calls.filter((c) => c[0] === 'prompt').length, 3)
  assert.equal(disk().sessions.s1.prompt, 'fix the loader')
  assert.equal(calls.find((c) => c[0] === 'heartbeat')[1].session_id, 'mom:opencode:s1:1')
})

test('no heartbeat for a finished answer, a subagent session, an aborted turn or a failing client', async () => {
  for (const o of [{ verdict: COMPLETE, messages: history('Done: all 12 tests pass.') }, { verdict: PREMATURE, parentID: 'p', messages: history('Let me check.') }, { verdict: PREMATURE, messages: history('Let me check.', { name: 'MessageAbortedError' }) }, { verdict: PREMATURE, fail: true }]) {
    const { hooks, calls } = setup(o)
    await idle(hooks)
    assert.equal(calls.some((c) => c[0] === 'prompt'), false)
  }
})

test('a new session indexes a memory-on folder in the background', async () => {
  const { hooks, calls } = setup({ state: { memory: { '/work': true } } })
  await hooks.event({ event: { type: 'session.created', properties: { info: { id: 's1' } } } })
  assert.deepEqual(calls.filter((c) => c[0] === 'index'), [['index', '/work']])
})

test('/route <model> pins it for the next prompts; its own echo turn goes to auto without recall or heartbeat', async () => {
  const { hooks, calls, disk } = setup({ verdict: PREMATURE, messages: history('Let me check.'), state: { memory: { '/work': true } } })
  await hooks.config(structuredClone(CFG))
  const out = { parts: [{ type: 'text', text: 'Mixture of Models /route deepseek' }] }
  await hooks['command.execute.before']({ command: 'route', sessionID: 's1', arguments: 'deepseek' }, out)
  assert.equal(disk().opencode.pin, 'deepseek-pro')
  assert.match(out.parts[0].text, /Route: deepseek-pro/)
  assert.ok(calls.some((c) => c[0] === 'toast'))
  const echo = await send(hooks, out.parts[0].text)
  assert.equal(echo.message.model.modelID, 'auto')
  assert.equal(echo.message.system, undefined)
  await idle(hooks)
  assert.equal(calls.some((c) => c[0] === 'prompt'), false)
  assert.equal((await send(hooks, 'add a retry to the http client please')).message.model.modelID, 'deepseek-pro')
})

test('/palgu runs mom\'s own memory, heartbeat and status commands', async () => {
  const { hooks } = setup()
  for (const [args, line] of [['memory on', /Palgu memory: on/], ['heartbeat off', /Heartbeat: off/], ['', /signed in/], ['bogus', /palgu memory on\|off\|status/]]) {
    const out = { parts: [{ type: 'text', text: 'x' }] }
    await hooks['command.execute.before']({ command: 'palgu', sessionID: 's1', arguments: args }, out)
    assert.match(out.parts[0].text, line)
  }
})

test('every hook fails open', async () => {
  const { hooks } = setup()
  await hooks.config(null)
  await hooks['chat.message']({}, {})
  await hooks['chat.headers']({}, {})
  await hooks.event({})
  await hooks['command.execute.before']({ command: 'route' }, {})
})
