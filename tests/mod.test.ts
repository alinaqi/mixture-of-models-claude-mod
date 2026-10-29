import { expect, test } from 'claude-code/testing'

const CONFIG = '{"primary":"claude"}'
// The plugin's userConfig values, as a configured install stores them.
const GW = { options: { gateway_url: 'https://api.palgu.ai/anthropic', gateway_key: 'srt_test' } }

// Everything a session.start needs answered in Claude Code's place.
function stubSession(on, opts: { childEnv?: string; customHeaders?: string; score?: string; offline?: boolean; scores?: string[]; messages?: any[]; config?: string; logs?: string[] } = {}) {
  const store = new Map<string, unknown>()
  on('session.start', () => ({ cwd: '/work' }))
  on('session.model', () => ({ value: 'claude-opus-5' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/home/me' : e.name === 'MAGGY_ROUTER_CHILD' ? opts.childEnv : e.name === 'ANTHROPIC_CUSTOM_HEADERS' ? opts.customHeaders : undefined }))
  on('fs.read', () => ({ value: opts.config ?? CONFIG }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('ui.log', ($, e) => { opts.logs?.push(e.text ?? e.message ?? JSON.stringify(e)); return { value: undefined } })
  on('session.messages', () => ({ value: opts.messages ?? [] }))
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

// What a headless child prints with --output-format json.
function childJson(text: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: 'sid-1', result: text, permission_denials: [], ...extra }) + '\n'
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
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('child answer'), stderr: '' } } })
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
  expect(runs[0].argv.join(' ')).toContain('--disallowedTools Read(**/.env)')
  expect(runs[0].init.env.ANTHROPIC_BASE_URL).toBe('https://api.palgu.ai/anthropic')
  expect(runs[0].init.env.ANTHROPIC_API_KEY).toBe('srt_test')
  expect(runs[0].init.env.MAGGY_ROUTER_CHILD).toBe('1')
  expect(runs[0].init.stdin).toContain('grep the repo for TODO comments')
})

test('the child tells the gateway it is the mod, and which project, keeping the user\'s own headers', GW, async ($, on) => {
  stubSession(on, { customHeaders: 'X-Team: platform' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('child answer'), stderr: '' } } })
  recordSteps(on, [])

  await routedTurn($, 'grep the repo for TODO comments and list the files')

  const headers = runs[0].init.env.ANTHROPIC_CUSTOM_HEADERS.split('\n')
  expect(headers[0]).toBe('X-Team: platform')
  expect(headers[1]).toMatch(/^x-srooter-client: mixture-of-models\/\d+\.\d+\.\d+$/)
  expect(headers[2]).toBe('x-srooter-project: work')
})

test('a critical prompt never starts a child', GW, async ($, on) => {
  stubSession(on, { score: '9 code' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
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
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('inside a child session the mod does nothing', GW, async ($, on) => {
  stubSession(on, { childEnv: '1' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('/route off keeps everything on the main session and /route shows the state', GW, async ($, on) => {
  stubSession(on)
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
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
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('kimi says hi'), stderr: '' } } })
  recordSteps(on, [])

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const pinned = await $.command.run({ command: 'route', args: 'kimi' })
  expect(pinned.text).toContain('kimi-k3.1-pro')
  await $.prompt.submit({ text: 'grep the repo for TODO comments and list the files' })
  await $.turn.start({ turnId: 't1' })
  const result = await drain($.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5', messageCount: 1 }))

  expect(runs[0].argv).toContain('kimi-k3.1-pro')
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
  on('process.run', () => ({ value: { exitCode: 0, stdout: childJson('x'), stderr: '' } }))
  recordSteps(on, [])

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /auto · no prompt yet/ })).toBeDefined()
  await ui.press({ key: 'pin-kimi' })
  expect(store.get('pin')).toEqual({ mode: 'model', model: 'kimi-k3.1-pro' })
  expect(await ui.find({ type: 'Text', text: /pinned kimi-k3\.1-pro/ })).toBeDefined()
  await ui.press({ key: 'pin-auto' })
  expect(store.get('pin')).toEqual({ mode: 'auto' })
  await ui.unmount()
})

test('a routed reply gets a provenance tag and a main-session reply does not', GW, async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: childJson('child answer'), stderr: '' } }))
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
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('wired up'), stderr: '' } } })
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
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('ok'), stderr: '' } } })
  recordSteps(on, [])

  await routedTurn($, 'grep the repo for TODO comments and list the files')
  expect(runs.length).toBe(1)
})

test('the kind picks the model: research at a coding score goes to Kimi', GW, async ($, on) => {
  stubSession(on, { score: '5 research' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('findings'), stderr: '' } } })
  recordSteps(on, [])

  await routedTurn($, 'research how other teams do blue-green deploys on render and compare three approaches')
  expect(runs[0].argv).toContain('kimi-k3.1-pro')
})

test('a borderline score is sampled twice and the higher one wins', GW, async ($, on) => {
  stubSession(on, { scores: ['7 code', '8 code'] })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
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
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
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
  on('process.run', () => ({ value: { exitCode: 0, stdout: childJson('ok'), stderr: '' } }))
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

test('after a child-answered turn, "continue" goes to the main session instead of a memoryless child', GW, async ($, on) => {
  stubSession(on, { score: '3 code' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('child did step one'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'scaffold the invoices module with a model, a repository and a first test')
  expect(runs).toBe(1)
  await $.prompt.submit({ text: 'continue' })
  await $.turn.start({ turnId: 't2' })
  await drain($.turn.step({ turnId: 't2', index: 0, model: 'claude-opus-5', messageCount: 3 }))
  expect(runs).toBe(1)
  expect(seen).toEqual(['claude-opus-5'])
})

test('while the main session is mid-task, a coding-score follow-up stays on it', GW, async ($, on) => {
  const working = [{ role: 'user', text: 'refactor the auth module', toolUses: [] }, { role: 'assistant', text: 'Edited three files.', toolUses: [{ name: 'Edit' }, { name: 'Bash' }] }]
  stubSession(on, { score: '5 code', messages: working })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'now also update the README and fix the failing test in the auth module please')
  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
  const done = await $.turn.complete({ turnId: 't1', answer: 'main answer', durationMs: 10, isAborted: false, usage: null })
  expect(done.text).toContain('mid-task guard')
})

test('while the main session is mid-task, a lookup can still go to the child', GW, async ($, on) => {
  const working = [{ role: 'assistant', text: 'Edited three files.', toolUses: [{ name: 'Edit' }] }]
  stubSession(on, { score: '1 research', messages: working })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
  recordSteps(on, [])

  await routedTurn($, 'what does the --bare flag of claude do, in one line, do not touch any files')
  expect(runs).toBe(1)
})

const DENIED = { result: 'I need approval to run git pull --ff-only', permission_denials: [{ tool_name: 'Bash', tool_input: { command: 'git pull --ff-only' } }] }

test('a command the child cannot run is relayed to the user; on approval the same child resumes with it allowed', GW, async ($, on) => {
  stubSession(on, { score: '4 code' })
  const runs: any[] = []
  on('process.run', ($, e) => {
    runs.push(e)
    const resumed = e.argv.includes('--resume')
    return { value: { exitCode: 0, stdout: resumed ? childJson('pulled and finished') : childJson('I need approval', DENIED), stderr: '' } }
  })
  const asked: string[] = []
  on('tool.call', ($, e) => { asked.push(e.questions[0].question); return { result: { answers: { [e.questions[0].question]: 'Allow and continue' } } } })
  recordSteps(on, [])

  const result = await routedTurn($, 'update the working copy from origin and tell me what changed in the last commit')
  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('git pull --ff-only')
  expect(runs.length).toBe(2)
  expect(runs[1].argv.join(' ')).toContain('--resume sid-1')
  expect(runs[1].argv.join(' ')).toContain('--allowedTools Bash(git pull --ff-only)')
  expect(runs[1].init.stdin).toContain('git pull --ff-only')
  expect(result.answer).toBe('pulled and finished')
})

test('a denied relay does not resume, and the child\'s "needs approval" prose goes to the main model instead', GW, async ($, on) => {
  stubSession(on, { score: '4 code' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('I need approval', DENIED), stderr: '' } } })
  on('tool.call', ($, e) => ({ result: { answers: { [e.questions[0].question]: 'Deny' } } }))
  recordSteps(on, [])

  const result = await routedTurn($, 'update the working copy from origin and tell me what changed in the last commit')
  expect(runs).toBe(1)
  expect(result.answer).toBe('main answer')
})

test('when nobody can answer the question, the relay counts as denied', GW, async ($, on) => {
  stubSession(on, { score: '4 code' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('I need approval', DENIED), stderr: '' } } })
  on('tool.call', () => ({ deny: 'no one to ask' }))
  recordSteps(on, [])

  const result = await routedTurn($, 'update the working copy from origin and tell me what changed in the last commit')
  expect(runs).toBe(1)
  expect(result.answer).toBe('main answer')
})

test('a teammate notification never starts a child, even at a low score', GW, async ($, on) => {
  stubSession(on, { score: '1 code' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('Verdict: ...'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, '<teammate-message teammate_id="worker-1">{"type":"idle_notification","from":"worker-1"}</teammate-message>')
  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
  const done = await $.turn.complete({ turnId: 't1', answer: 'main answer', durationMs: 10, isAborted: false, usage: null })
  expect(done.text).toContain('via notification')
})

test('an operator command stays on the main session even when a model is pinned', GW, async ($, on) => {
  stubSession(on)
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'route', args: 'glm' })
  await $.prompt.submit({ text: 'approve git pull --ff-only' })
  await $.turn.start({ turnId: 't1' })
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5', messageCount: 1 }))
  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('a child that replies HANDBACK hands the turn to the main model', GW, async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: childJson('HANDBACK\nneeds the session PR list', { num_turns: 1 }), stderr: '' } }))
  const seen: string[] = []
  recordSteps(on, seen)

  const result = await routedTurn($, 'grep the repo for TODO comments and list the files')
  expect(seen).toEqual(['claude-opus-5'])
  expect(result.answer).toBe('main answer')
  const done = await $.turn.complete({ turnId: 't1', answer: 'main answer', durationMs: 10, isAborted: false, usage: null })
  expect(done.text).toContain('discarded (handback)')
})

test('a child that claims a change it never made is discarded for the main model', GW, async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: childJson('I added the retry wrapper and opened PR #812.', { num_turns: 1 }), stderr: '' } }))
  const seen: string[] = []
  recordSteps(on, seen)

  const result = await routedTurn($, 'grep the repo for TODO comments and list the files')
  expect(seen).toEqual(['claude-opus-5'])
  expect(result.answer).toBe('main answer')
  const done = await $.turn.complete({ turnId: 't1', answer: 'main answer', durationMs: 10, isAborted: false, usage: null })
  expect(done.text).toContain('unverified claim')
})

// What `codex exec --json` prints: a thread, a tool call, the answer.
function codexJsonl(text: string) {
  return [{ type: 'thread.started', thread_id: 'th-1' }, { type: 'item.completed', item: { type: 'command_execution', command: 'ls', exit_code: 0 } },
    { type: 'item.completed', item: { type: 'agent_message', text } }, { type: 'turn.completed', usage: {} }].map((e) => JSON.stringify(e)).join('\n') + '\n'
}

async function pinnedTurn($, arg: string, text: string) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const pinned = await $.command.run({ command: 'route', args: arg })
  await $.prompt.submit({ text })
  await $.turn.start({ turnId: 't1' })
  const result = await drain($.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5', messageCount: 1 }))
  const done = await $.turn.complete({ turnId: 't1', answer: result.answer, durationMs: 10, isAborted: false, usage: null })
  return { pinned, result, done }
}

test('/route claude/sonnet runs a subscription child with --model, no --bare and no gateway, even with no gateway key', async ($, on) => {
  stubSession(on)
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('sonnet answer', { num_turns: 2 }), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  const { pinned, result, done } = await pinnedTurn($, 'claude/sonnet', 'grep the repo for TODO comments and list the files')
  expect(pinned.text).toContain('claude/sonnet')
  expect(seen).toEqual([])
  expect(result.answer).toBe('sonnet answer')
  expect(runs[0].argv[0]).toBe('claude')
  expect(runs[0].argv.join(' ')).toContain('--model claude-sonnet-5-5')
  expect(runs[0].argv).not.toContain('--bare')
  expect(runs[0].init.env.ANTHROPIC_BASE_URL).toBe('')
  expect(runs[0].init.env.ANTHROPIC_API_KEY).toBeUndefined()
  expect(runs[0].init.env.MAGGY_ROUTER_CHILD).toBe('1')
  expect(done.text).toContain('claude-sonnet-5-5 (claude/sonnet)')
})

test('a claude/auto route picks haiku for a trivial prompt and never leaves the family', GW, async ($, on) => {
  stubSession(on, { score: '1 code', config: '{"router":{"routes":{"simple":"claude/auto","coding":"claude/auto","critical":"claude/auto"}}}' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('haiku answer', { num_turns: 2 }), stderr: '' } } })
  recordSteps(on, [])

  const result = await routedTurn($, 'what does the -s flag of grep do, answer in one line')
  expect(runs[0].argv.join(' ')).toContain('--model claude-haiku-5-5')
  expect(runs[0].init.env.ANTHROPIC_API_KEY).toBeUndefined()
  expect(result.answer).toBe('haiku answer')
})

test('claude/auto at a critical score lands on opus, the session model, so the main session answers', GW, async ($, on) => {
  stubSession(on, { score: '9 code', config: '{"router":{"routes":{"critical":"claude/auto"},"families":{"claude":{"members":{"opus":"claude-opus-5"}}}}}' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'redesign the auth service boundaries and write the ADR')
  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('/route kimi/auto classifies and picks a kimi member: highspeed for a lookup', GW, async ($, on) => {
  stubSession(on, { score: '2 code' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('fast answer'), stderr: '' } } })
  recordSteps(on, [])

  const { done } = await pinnedTurn($, 'kimi/auto', 'grep the repo for TODO comments and list the files')
  expect(runs[0].argv).toContain('kimi-k3.1-pro-highspeed')
  expect(runs[0].argv).toContain('--bare')
  expect(runs[0].init.env.ANTHROPIC_BASE_URL).toBe('https://api.palgu.ai/anthropic')
  expect(done.text).toContain('(kimi/auto → highspeed)')
})

test('/route codex runs codex exec on Palgu /v1/responses with the key in the environment only', GW, async ($, on) => {
  stubSession(on)
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: codexJsonl('codex answer'), stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  const { result, done } = await pinnedTurn($, 'codex', 'grep the repo for TODO comments and list the files')
  expect(seen).toEqual([])
  expect(result.answer).toBe('codex answer')
  expect(runs[0].argv.slice(0, 3)).toEqual(['codex', 'exec', '--json'])
  expect(runs[0].argv.join(' ')).toContain('model_providers.palgu.base_url="https://api.palgu.ai/v1"')
  expect(runs[0].argv.join(' ')).toContain('model_providers.palgu.wire_api="responses"')
  expect(runs[0].argv.join(' ')).not.toContain('srt_test')
  expect(runs[0].init.env.PALGU_API_KEY).toBe('srt_test')
  expect(runs[0].init.env.MAGGY_ROUTER_CHILD).toBe('1')
  expect(runs[0].init.stdin).toContain('grep the repo for TODO comments')
  expect(runs[0].init.timeoutMs).toBe(600000)
  expect(done.text).toContain('route: codex (codex/default)')
})

test('a codex route defaults to a read-only sandbox, never escalates, stays in git repos and says so on the route line', GW, async ($, on) => {
  stubSession(on)
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: codexJsonl('codex answer'), stderr: '' } } })
  recordSteps(on, [])

  const { done } = await pinnedTurn($, 'codex', 'grep the repo for TODO comments and list the files')
  const argv = runs[0].argv.join(' ')
  expect(argv).toContain('--sandbox read-only -c approval_policy="never"')
  expect(argv).not.toContain('workspace-write')
  expect(argv).not.toContain('--skip-git-repo-check')
  expect(runs[0].init.stdin).toContain('NEEDS-APPROVAL: <exact command>')
  expect(done.text).toContain('sandbox read-only')
})

// Codex's answer naming a command its read-only sandbox refused.
const NEEDS = 'The sandbox is read-only, so I could not create it.\nNEEDS-APPROVAL: touch made.txt'

test('a command Codex was refused is relayed to the user; on approval the same thread resumes with edits allowed', GW, async ($, on) => {
  stubSession(on)
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: codexJsonl(e.argv.includes('resume') ? 'created made.txt' : NEEDS), stderr: '' } } })
  const asked: string[] = []
  on('tool.call', ($, e) => { asked.push(e.questions[0].question); return { result: { answers: { [e.questions[0].question]: 'Allow and continue' } } } })
  recordSteps(on, [])

  const { result } = await pinnedTurn($, 'codex', 'create made.txt in the project root and confirm')
  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('touch made.txt')
  expect(runs.length).toBe(2)
  expect(runs[1].argv.slice(0, 5)).toEqual(['codex', 'exec', '-C', '/work', 'resume'])
  expect(runs[1].argv.join(' ')).toContain('sandbox_mode="workspace-write"')
  expect(runs[1].argv.join(' ')).toContain('sandbox_workspace_write.network_access=false')
  expect(runs[1].argv).toContain('th-1')
  expect(runs[1].init.stdin).toContain('touch made.txt')
  expect(result.answer).toBe('created made.txt')
})

test('a denied Codex relay does not resume, and the answer and route line both name the refused command', GW, async ($, on) => {
  stubSession(on)
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: codexJsonl(NEEDS), stderr: '' } } })
  on('tool.call', ($, e) => ({ result: { answers: { [e.questions[0].question]: 'Deny' } } }))
  recordSteps(on, [])

  const { result, done } = await pinnedTurn($, 'codex', 'create made.txt in the project root and confirm')
  expect(runs).toBe(1)
  expect(result.answer).toContain('could not create it')
  expect(result.answer).toContain('refused')
  expect(result.answer).toContain('touch made.txt')
  expect(result.answer).not.toContain('NEEDS-APPROVAL')
  expect(done.text).toContain('refused: touch made.txt')
})

test('with an opted-in workspace-write sandbox a refusal is reported, not offered: approving would widen nothing safely', GW, async ($, on) => {
  stubSession(on, { config: '{"router":{"codex":{"sandbox":"workspace-write"}}}' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: codexJsonl(NEEDS), stderr: '' } } })
  const asked: string[] = []
  on('tool.call', ($, e) => { asked.push(e.questions[0].question); return { result: { answers: { [e.questions[0].question]: 'Allow and continue' } } } })
  recordSteps(on, [])

  const { result, done } = await pinnedTurn($, 'codex', 'create made.txt in the project root and confirm')
  expect(asked).toEqual([])
  expect(runs).toBe(1)
  expect(result.answer).toContain('touch made.txt')
  expect(done.text).toContain('sandbox workspace-write · refused: touch made.txt')
})

test('router.codex.args that widen the sandbox are ignored, with a log line naming them', GW, async ($, on) => {
  const logs: string[] = []
  stubSession(on, { logs, config: '{"router":{"codex":{"args":["--sandbox","workspace-write","--ephemeral"]}}}' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: codexJsonl('codex answer'), stderr: '' } } })
  recordSteps(on, [])

  await pinnedTurn($, 'codex', 'grep the repo for TODO comments and list the files')
  expect(runs[0].argv.join(' ')).toContain('--sandbox read-only')
  expect(runs[0].argv).toContain('--ephemeral')
  expect(runs[0].argv).not.toContain('workspace-write')
  expect(logs.join('\n')).toContain('ignored --sandbox workspace-write')
})

test('outside a git repo Codex refuses to start; the route line says how to opt in and the main model answers', GW, async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'Not inside a trusted directory and --skip-git-repo-check was not specified.\n' } }))
  const seen: string[] = []
  recordSteps(on, seen)

  const { done } = await pinnedTurn($, 'codex', 'grep the repo for TODO comments and list the files')
  expect(seen).toEqual(['claude-opus-5'])
  expect(done.text).toContain('router.codex.allowOutsideGit')
})

test('/route codex/gpt-5.6-terra on the ChatGPT login passes -m and no Palgu provider or key', async ($, on) => {
  stubSession(on, { config: '{"router":{"codex":{"auth":"chatgpt"}}}' })
  const runs: any[] = []
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: codexJsonl('terra answer'), stderr: '' } } })
  recordSteps(on, [])

  const { result } = await pinnedTurn($, 'codex/gpt-5.6-terra', 'grep the repo for TODO comments and list the files')
  expect(result.answer).toBe('terra answer')
  expect(runs[0].argv.join(' ')).toContain('-m gpt-5.6-terra')
  expect(runs[0].argv.join(' ')).not.toContain('model_provider')
  expect(runs[0].init.env.PALGU_API_KEY).toBeUndefined()
})

test('a missing codex binary says how to install it and the main model answers', GW, async ($, on) => {
  const logs: string[] = []
  stubSession(on, { logs })
  on('process.run', () => ({ deny: 'failed to start: ENOENT: no such file or directory' }))
  const seen: string[] = []
  recordSteps(on, seen)

  const { result, done } = await pinnedTurn($, 'codex', 'grep the repo for TODO comments and list the files')
  expect(seen).toEqual(['claude-opus-5'])
  expect(result.answer).toBe('main answer')
  expect(logs.join('\n')).toContain('npm install -g @openai/codex')
  expect(done.text).toContain('codex not installed')
})

test('/route rejects an unknown member, and /route status lists the families', GW, async ($, on) => {
  stubSession(on)
  recordSteps(on, [])
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const bad = await $.command.run({ command: 'route', args: 'claude/gpt' })
  expect(bad.text).toContain('claude has no member gpt')
  const status = await $.command.run({ command: 'route', args: 'status' })
  expect(status.text).toContain('mode auto')
  expect(status.text).toContain('claude: fable, opus, sonnet, haiku')
})

test('a Codex answer that is only a NEEDS-APPROVAL line, denied, still answers with the refusal named', GW, async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 0, stdout: codexJsonl('NEEDS-APPROVAL: touch made.txt'), stderr: '' } }))
  on('tool.call', ($, e) => ({ result: { answers: { [e.questions[0].question]: 'Deny' } } }))
  const seen: string[] = []
  recordSteps(on, seen)

  const { result } = await pinnedTurn($, 'codex', 'create made.txt in the project root and confirm')
  expect(seen).toEqual([])
  expect(result.answer).toContain('refused')
  expect(result.answer).toContain('touch made.txt')
})
