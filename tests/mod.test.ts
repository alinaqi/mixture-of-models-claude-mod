import { expect, test } from 'claude-code/testing'

const CONFIG = '{"primary":"claude"}'
// The plugin's userConfig values, as a configured install stores them.
const GW = { options: { gateway_url: 'https://api.palgu.ai/anthropic', gateway_key: 'srt_test' } }

// Everything a session.start needs answered in Claude Code's place.
function stubSession(on, opts: { childEnv?: string; score?: string; offline?: boolean; scores?: string[] } = {}) {
  const store = new Map<string, unknown>()
  on('session.start', () => ({ cwd: '/work' }))
  on('session.model', () => ({ value: 'claude-opus-5' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/home/me' : e.name === 'MAGGY_ROUTER_CHILD' ? opts.childEnv : undefined }))
  on('fs.read', () => ({ value: CONFIG }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [] }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.delete', () => ({ value: undefined }))
  // The local classifier's replies, in order: "<score> <kind>" verdicts the test wants, or no Ollama at all.
  const replies = opts.scores ?? [opts.score ?? '2 code']
  let n = 0
  if (opts.offline) on('http.fetch', () => ({ deny: 'ollama down' }))
  else on('http.fetch', () => ({ value: { ok: true, status: 200, headers: {}, text: '{"message":{"content":"' + replies[Math.min(n++, replies.length - 1)] + '"}}' } }))
  return store
}

// Records which model the MAIN session's request would carry, if the mod lets it through.
function recordSteps(on, seen: string[]) {
  on('turn.step', async function* ($, e) {
    seen.push(e.model)
    yield { kind: 'text', index: 0, text: 'main answer' }
    return { turnId: e.turnId, index: e.index, answer: 'main answer', toolUses: [], stopReason: 'end_turn', usage: null }
  })
}

async function drain(stream) {
  let step = await stream.next()
  while (step.done !== true) step = await stream.next()
  return step.value
}

async function routedTurn($, text: string) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.prompt.submit({ text })
  await $.turn.start({ turnId: 't1' })
  return drain($.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5', messageCount: 1 }))
}

test('a simple prompt is answered by a child claude on the gateway, not the main session', GW, async ($, on) => {
  stubSession(on)
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: 'child answer\n', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  const result = await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(seen).toEqual([])
  expect(result.answer).toBe('child answer')
  expect(result.stopReason).toBe('end_turn')
  expect(runs.length).toBe(1)
  expect(runs[0].argv[0]).toBe('claude')
  expect(runs[0].argv).toContain('glm-5.3')
  expect(runs[0].argv).toContain('-p')
  expect(runs[0].argv).toContain('--bare')
  expect(runs[0].argv.join(' ')).toContain('--add-dir /work')
  expect(runs[0].init.env.ANTHROPIC_BASE_URL).toBe('https://api.palgu.ai/anthropic')
  expect(runs[0].init.env.ANTHROPIC_API_KEY).toBe('srt_test')
  expect(runs[0].init.env.MAGGY_ROUTER_CHILD).toBe('1')
  expect(runs[0].init.stdin).toContain('grep the repo for TODO comments')
})

test('a critical prompt never starts a child', GW, async ($, on) => {
  stubSession(on, { score: '9 code' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  const result = await routedTurn($, 'redesign the auth service boundaries and write the ADR')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
  expect(result.answer).toBe('main answer')
})

test('a failed child hands the step to the main model', GW, async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'auth error' } }))
  const seen: string[] = []
  recordSteps(on, seen)

  const result = await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(seen).toEqual(['claude-opus-5'])
  expect(result.answer).toBe('main answer')
})

test('without a gateway key the mod observes only', async ($, on) => {
  stubSession(on)
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('inside a child session the mod does nothing', GW, async ($, on) => {
  stubSession(on, { childEnv: '1' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('/route off keeps everything on the main session and /route shows the state', GW, async ($, on) => {
  stubSession(on)
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const off = await $.command.run({ command: 'route', args: 'off' })
  expect(off.text).toContain('off')
  await $.prompt.submit({ text: 'list the files in src and summarize them briefly' })
  await $.turn.start({ turnId: 't1' })
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5', messageCount: 1 }))
  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])

  const shown = await $.command.run({ command: 'route', args: '' })
  expect(shown.text).toContain('off')
})

test('/route kimi pins the next routed turn to Kimi', GW, async ($, on) => {
  stubSession(on)
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: 'kimi says hi', stderr: '' } } })
  recordSteps(on, [])

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const pinned = await $.command.run({ command: 'route', args: 'kimi' })
  expect(pinned.text).toContain('kimi-k3')
  await $.prompt.submit({ text: 'grep the repo for TODO comments and list the files' })
  await $.turn.start({ turnId: 't1' })
  const result = await drain($.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5', messageCount: 1 }))

  expect(runs[0].argv).toContain('kimi-k3')
  expect(result.answer).toBe('kimi says hi')
})

const BAND = {
  plugin: 'mixture-of-models',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 120, rows: 40 },
  props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 110, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

function message(text: string) {
  return { plugin: 'mixture-of-models', component: 'AssistantMessage', requestId: 'm-' + text.length, surface: 'terminal', props: { text, isFirstOfReply: true } } as const
}

test('the band shows the mode and its buttons pin a model', GW, async ($, on) => {
  const store = stubSession(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'x', stderr: '' } }))
  recordSteps(on, [])

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /auto · no prompt yet/ })).toBeDefined()
  await ui.press({ key: 'pin-kimi' })
  expect(store.get('pin')).toEqual({ mode: 'model', model: 'kimi-k3' })
  expect(await ui.find({ type: 'Text', text: /pinned kimi-k3/ })).toBeDefined()
  await ui.press({ key: 'pin-auto' })
  expect(store.get('pin')).toEqual({ mode: 'auto' })
  await ui.unmount()
})

test('a routed reply gets a provenance tag and a main-session reply does not', GW, async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'child answer\n', stderr: '' } }))
  recordSteps(on, [])

  await routedTurn($, 'grep the repo for TODO comments and list the files')
  const tagged = await $.ui.mount(message('child answer'))
  expect(await tagged.find({ type: 'Text', text: /glm-5\.3 · child on gateway/ })).toBeDefined()
  expect(await tagged.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
  await tagged.unmount()

  const plain = await $.ui.mount(message('something Claude wrote'))
  expect(await plain.find({ type: 'Text', text: /child on gateway/ })).toBeUndefined()
  expect(await plain.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
  await plain.unmount()
})

test('every turn gets a route line, main-session turns included', GW, async ($, on) => {
  stubSession(on, { score: '9 code' })
  recordSteps(on, [])

  await routedTurn($, 'redesign the auth service boundaries and write the ADR')
  const done = await $.turn.complete({ turnId: 't1', answer: 'main answer', durationMs: 10, isAborted: false, usage: null })
  expect(done.text).toContain('claude-opus-5')
  expect(done.text).toContain('main session')
  expect(done.text).toContain('today: claude-opus-5 ×1')
})

test('a long multi-service integration task scores mid-range and goes to the coding tier', GW, async ($, on) => {
  stubSession(on, { score: '6 code' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: 'wired up\n', stderr: '' } } })
  recordSteps(on, [])

  const result = await routedTurn($, 'i want to give grokbot local access to apify, gemini, claude and gpt as localhost tools, take educlaude from github, make it reachable from grokbot for research and document creation, all env keys are in render, fix it')

  expect(runs[0].argv).toContain('glm-5.3')
  expect(result.answer).toBe('wired up')
  const done = await $.turn.complete({ turnId: 't1', answer: 'wired up', durationMs: 10, isAborted: false, usage: null })
  expect(done.text).toContain('coding 6/10')
})

test('when the classifier is unreachable the last verdict is reused', GW, async ($, on) => {
  const store = stubSession(on, { offline: true })
  store.set('last-verdict', { score: 2, kind: 'code' })
  on('model.classify', () => ({ deny: 'no network' }))
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: 'ok\n', stderr: '' } } })
  recordSteps(on, [])

  await routedTurn($, 'grep the repo for TODO comments and list the files')
  expect(runs.length).toBe(1)
})

test('the kind picks the model: research at a coding score goes to Kimi', GW, async ($, on) => {
  stubSession(on, { score: '5 research' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: 'findings\n', stderr: '' } } })
  recordSteps(on, [])

  await routedTurn($, 'research how other teams do blue-green deploys on render and compare three approaches')
  expect(runs[0].argv).toContain('kimi-k3')
})

test('a borderline score is sampled twice and the higher one wins', GW, async ($, on) => {
  stubSession(on, { scores: ['7 code', '8 code'] })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'debug why the checkout flow double-charges some users under load')
  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('two child failures for a kind lower its threshold, so the next borderline task stays on Claude', GW, async ($, on) => {
  const store = stubSession(on, { score: '7 code' })
  store.set('failures', { code: 2 })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'write the migration that splits the users table into accounts and profiles')
  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('a failed child is counted against its kind', GW, async ($, on) => {
  const store = stubSession(on, { score: '5 docs' })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'boom' } }))
  recordSteps(on, [])

  await routedTurn($, 'write the changelog entry for this release and the upgrade notes')
  expect(store.get('failures')).toEqual({ docs: 1 })
})

const PANE = {
  plugin: 'mixture-of-models',
  component: 'Pane',
  requestId: 'routing-stats',
  viewport: { columns: 120, rows: 40 },
  props: { title: 'Mixture of models', isFocused: true, bodyColumns: 70, placement: 'inline', scroll: { offset: 0, bodyRows: 14 }, view: {} },
} as const

test('/route stats opens the pane, which charts the turns the session routed', GW, async ($, on) => {
  stubSession(on, { scores: ['5 code', '5 research'] })
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'ok\n', stderr: '' } }))
  recordSteps(on, [])

  await routedTurn($, 'add a unit test for the parseVerdict helper and run it')
  await $.turn.complete({ turnId: 't1', answer: 'ok', durationMs: 10, isAborted: false, usage: null })
  await $.prompt.submit({ text: 'research how other routers pick a model and compare three of them' })
  await $.turn.start({ turnId: 't2' })
  await drain($.turn.step({ turnId: 't2', index: 0, model: 'claude-opus-5', messageCount: 3 }))
  await $.turn.complete({ turnId: 't2', answer: 'ok', durationMs: 10, isAborted: false, usage: null })

  const opened = await $.command.run({ command: 'route', args: 'stats' })
  expect(opened).toEqual({})
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /2 of 2 turns off Claude/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /glm-5\.3/ })).toBeDefined()
  await ui.press({ key: 'tab-kinds' })
  expect(await ui.find({ type: 'Text', text: /research/ })).toBeDefined()
  await ui.press({ key: 'tab-recent' })
  expect(await ui.find({ type: 'Text', text: /5\/10 research/ })).toBeDefined()
  await ui.unmount()
})
