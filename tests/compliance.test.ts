import { expect, mock, test } from 'claude-code/testing'

// Directory compliance: what reaches $.process.run is fixed text plus checked values, and the
// network hosts are fixed. These drive the hooks through the real kit.
const GW = { options: { gateway_url: 'https://api.palgu.ai/anthropic', gateway_key: 'test-key' } }
const ok = (body: unknown) => ({ ok: true, status: 200, headers: {}, text: JSON.stringify(body) })

function stub(on, opts: { config?: string; fetch?: (url: string, init: any) => any; logs?: string[] } = {}) {
  const store = new Map<string, unknown>()
  on('session.start', () => ({ cwd: '/work' }))
  on('session.model', () => ({ value: 'claude-opus-5' }))
  on('session.cwd', () => ({ value: '/work' }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
  on('fs.read', () => ({ value: opts.config ?? '{"primary":"claude"}' }))
  on('fs.list', () => ({ value: [] }))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('ui.log', ($, e) => { opts.logs?.push(e.text ?? JSON.stringify(e)); return { value: undefined } })
  on('ui.toast', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [] }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('http.fetch', ($, e) => ({ value: (opts.fetch ?? (() => ok({ message: { content: '2 code' } })))(e.url, e.init ?? e) }))
}

function childJson(text: string) {
  return JSON.stringify({ type: 'result', is_error: false, session_id: 'sid-1', result: text, permission_denials: [] }) + '\n'
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

function mainSteps(on, seen: string[]) {
  on('turn.step', async function* ($, e) {
    seen.push(e.model)
    yield { kind: 'text', index: 0, text: 'main answer' }
    return { turnId: e.turnId, index: e.index, answer: 'main answer', toolUses: [], stopReason: 'end_turn', usage: null }
  })
}

test('the gateway child starts with the program and its fixed flags as written, then the checked values', GW, async ($, on) => {
  const runs: any[] = []
  stub(on)
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('child answer'), stderr: '' } } })
  mainSteps(on, [])
  await routedTurn($, 'grep the repo for TODO comments and list the files')
  expect(runs[0].argv.slice(0, 10)).toEqual(['claude', '-p', '--model', 'glm-5.3', '--output-format', 'json', '--max-turns', '25', '--add-dir', '/work'])
})

test('a routed model id that is not one plain id never reaches process.run; the main model answers', GW, async ($, on) => {
  const runs: any[] = [], seen: string[] = [], logs: string[] = []
  stub(on, { config: '{"router":{"routes":{"simple":"glm 5.3; rm -rf"}}}', logs })
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: childJson('x'), stderr: '' } } })
  mainSteps(on, seen)
  await routedTurn($, 'grep the repo for TODO comments and list the files')
  expect(runs.length).toBe(0)
  expect(seen.length).toBe(1)
  expect(logs.join(' ')).toContain('argument refused')
})

const LATEST = 'https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json'

test('/route update asks GitHub for the version and runs only the two fixed update commands', async ($, on) => {
  const runs: any[] = [], urls: string[] = []
  stub(on, { fetch: (url) => { urls.push(url); return ok({ version: '99.0.0' }) } })
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: '', stderr: '' } } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const r = await $.command.run({ command: 'route', args: 'update' })
  expect(urls).toEqual([LATEST])
  expect(runs.map((x) => x.argv)).toEqual([
    ['claude', 'plugin', 'marketplace', 'update', 'mixture-of-models-claude-mod'],
    ['claude', 'plugin', 'update', 'mixture-of-models@mixture-of-models-claude-mod'],
  ])
  expect(r.text).toContain('99.0.0')
})

test('/route update runs nothing when GitHub has no newer version', async ($, on) => {
  const runs: any[] = []
  stub(on, { fetch: () => ok({ version: '0.0.1' }) })
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: '', stderr: '' } } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const r = await $.command.run({ command: 'route', args: 'update' })
  expect(runs.length).toBe(0)
  expect(r.text).toContain('up to date')
})

test('/palgu login never saves or uses a minted key that is not one plain token', async ($, on) => {
  const clock = mock.clock(on)
  const runs: any[] = []
  stub(on, { fetch: (url) => url.endsWith('/auth/device/code')
    ? ok({ device_code: 'dc-1', user_code: 'ABCD-EFGH', expires_in: 600, interval: 5 })
    : ok({ access_token: 'not one\ntoken', account: { email: 'dev@acme.com' }, org: {} }) })
  on('process.run', ($, e) => { runs.push(e); return { value: { exitCode: 0, stdout: '', stderr: '' } } })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'palgu', args: 'login' })
  await clock.advance(5000)
  expect(runs.length).toBe(0)
})
