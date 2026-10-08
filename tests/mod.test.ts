import { expect, test } from 'claude-code/testing'

const CONFIG = '{"primary":"claude","router":{"child":{"baseUrl":"https://www.srooter.ai/anthropic"}}}'

// Everything a session.start needs answered in Claude Code's place.
function stubSession(on, opts: { childEnv?: string; keyFile?: string } = {}) {
  const store = new Map<string, unknown>()
  on('session.start', () => ({ cwd: '/work' }))
  on('session.model', () => ({ value: 'claude-opus-5' }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/home/me' : e.name === 'MAGGY_ROUTER_CHILD' ? opts.childEnv : undefined }))
  on('fs.read', ($, e) => ({ value: e.path.endsWith('model-config.json') ? CONFIG : (opts.keyFile ?? 'SROOTER_API_KEY=srt_test\n') }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [] }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('http.fetch', () => ({ value: { ok: true, status: 200, headers: {}, text: '{"message":{"content":"simple"}}' } }))
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

test('a simple prompt is answered by a child claude on the gateway, not the main session', async ($, on) => {
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
  expect(runs[0].argv).toContain('glm-5.3')
  expect(runs[0].argv).toContain('-p')
  expect(runs[0].init.env.ANTHROPIC_BASE_URL).toBe('https://www.srooter.ai/anthropic')
  expect(runs[0].init.env.ANTHROPIC_API_KEY).toBe('srt_test')
  expect(runs[0].init.env.MAGGY_ROUTER_CHILD).toBe('1')
  expect(runs[0].init.stdin).toContain('grep the repo for TODO comments')
})

test('a critical prompt never starts a child', async ($, on) => {
  stubSession(on)
  on('http.fetch', () => ({ value: { ok: true, status: 200, headers: {}, text: '{"message":{"content":"critical"}}' } }))
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  const result = await routedTurn($, 'redesign the auth service boundaries and write the ADR')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
  expect(result.answer).toBe('main answer')
})

test('a failed child hands the step to the main model', async ($, on) => {
  stubSession(on)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'auth error' } }))
  const seen: string[] = []
  recordSteps(on, seen)

  const result = await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(seen).toEqual(['claude-opus-5'])
  expect(result.answer).toBe('main answer')
})

test('without a gateway key the mod observes only', async ($, on) => {
  stubSession(on, { keyFile: '# no key here\n' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('inside a child session the mod does nothing', async ($, on) => {
  stubSession(on, { childEnv: '1' })
  let runs = 0
  on('process.run', () => { runs += 1; return { value: { exitCode: 0, stdout: 'x', stderr: '' } } })
  const seen: string[] = []
  recordSteps(on, seen)

  await routedTurn($, 'grep the repo for TODO comments and list the files')

  expect(runs).toBe(0)
  expect(seen).toEqual(['claude-opus-5'])
})

test('/route off keeps everything on the main session and /route shows the state', async ($, on) => {
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

test('/route kimi pins the next routed turn to Kimi', async ($, on) => {
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
