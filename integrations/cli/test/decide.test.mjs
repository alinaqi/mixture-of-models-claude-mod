import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onStart, onPrompt, onStop } from '../lib/decide.js'
import { REASONS } from '../../../hooks/lib/heartbeat.js'

const ok = (body) => ({ ok: true, status: 200, text: JSON.stringify(body) })
const HITS = ok({ project: 'work', indexed: true, hits: [{ kind: 'intent', ref: 'adr:ADR-001', title: 'ADR-001: Delegate routed turns', snippet: '', meta: {} }] })

function io(over = {}) {
  const calls = []
  return {
    calls,
    key: 'k-123456789',
    now: 1000,
    async projectName(cwd) { calls.push(['projectName', cwd]); return 'work' },
    async search(project, q) { calls.push(['search', project, q]); return HITS },
    async heartbeat(body) { calls.push(['heartbeat', body]); return ok({ assessment: 'complete', should_continue: false, reason: '' }) },
    indexInBackground(cwd) { calls.push(['index', cwd]) },
    ...over
  }
}

const ev = (kind, o = {}) => ({ kind, session: 's1', cwd: '/work', prompt: '', answer: '', continued: false, ...o })

test('onPrompt recalls Palgu memory for a project where memory is on, and remembers the prompt', async () => {
  const x = io()
  const r = await onPrompt(ev('prompt', { prompt: 'refactor the config loader to cache reads' }), { memory: { '/work': true } }, x)
  assert.match(r.context, /^Palgu memory for work/)
  assert.deepEqual(x.calls.find((c) => c[0] === 'search'), ['search', 'work', 'refactor the config loader to cache reads'])
  assert.equal(r.state.sessions.s1.prompt, 'refactor the config loader to cache reads')
  assert.equal(r.state.projects['/work'], 'work')
})

test('onPrompt recalls nothing where memory is off, without a key, or for a short follow-up', async () => {
  for (const [state, x, prompt] of [[{}, io(), 'refactor the config loader please'], [{ memory: { '/work': true } }, io({ key: '' }), 'refactor the config loader please'], [{ memory: { '/work': true } }, io(), 'continue']]) {
    const r = await onPrompt(ev('prompt', { prompt }), state, x)
    assert.equal(r.context, '')
    assert.equal(x.calls.some((c) => c[0] === 'search'), false)
  }
})

test('onStop continues a premature stop with Palgu\'s reason, up to the budget', async () => {
  const x = io({ async heartbeat(body) { x.calls.push(['heartbeat', body]); return ok({ assessment: 'premature', should_continue: true, reason: REASONS.premature }) } })
  let state = (await onPrompt(ev('prompt', { prompt: 'fix the loader' }), {}, x)).state
  for (let i = 0; i < 3; i += 1) {
    const r = await onStop(ev('stop', { answer: 'Let me check the tests.' }), state, x)
    assert.equal(r.reason, REASONS.premature)
    state = r.state
  }
  assert.equal((await onStop(ev('stop', { answer: 'Let me check the tests.' }), state, x)).reason, '')
  const body = x.calls.find((c) => c[0] === 'heartbeat')[1]
  assert.equal(body.session_id, 'mom:codex:s1:1')
  assert.equal(body.text, 'Let me check the tests.')
})

test('onStop falls back to the local classifier when Palgu does not answer or there is no key', async () => {
  const x = io({ key: '', async heartbeat() { throw new Error('no call expected') } })
  const r = await onStop(ev('stop', { answer: 'Now I\'ll run the full suite' }), {}, x)
  assert.equal(r.reason, REASONS.premature)
  const y = io({ async heartbeat() { return { ok: false, status: 500, text: '' } } })
  assert.equal((await onStop(ev('stop', { answer: 'Done: all 12 tests pass.' }), {}, y)).reason, '')
})

test('onStop does nothing when the heartbeat is off', async () => {
  const x = io()
  const r = await onStop(ev('stop', { answer: 'Let me check the tests.' }), { settings: { heartbeat: 'off' } }, x)
  assert.equal(r.reason, '')
  assert.equal(x.calls.length, 0)
})

test('onStart indexes in the background when memory is on and due, and learns the project name', async () => {
  const x = io()
  const r = await onStart(ev('start'), { memory: { '/work': true } }, x)
  assert.deepEqual(x.calls.filter((c) => c[0] === 'index'), [['index', '/work']])
  assert.equal(r.state.index['/work'], 1000)
  const again = io({ now: 2000 })
  await onStart(ev('start'), r.state, again)
  assert.equal(again.calls.some((c) => c[0] === 'index'), false)
  const off = io()
  await onStart(ev('start'), {}, off)
  assert.equal(off.calls.length, 0)
})
