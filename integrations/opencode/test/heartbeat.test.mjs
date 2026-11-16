// The heartbeat and indexing through a fake OpenCode (fake.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REASONS } from '../../../hooks/lib/heartbeat.js'
import { COMPLETE, PREMATURE, history, idle, send, setup } from './fake.mjs'

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

test('a heartbeat verdict that arrives after the person\'s next prompt is dropped', async () => {
  const { hooks, calls, disk } = setup({ verdict: PREMATURE, messages: history('Let me check the tests next.') })
  await send(hooks, 'fix the loader')
  const pending = idle(hooks)
  await send(hooks, 'now update the docs for the loader')
  await pending
  assert.equal(calls.some((c) => c[0] === 'prompt'), false)
  assert.equal(disk().sessions.s1.prompt, 'now update the docs for the loader')
  assert.equal(disk().sessions.s1.beats, 0)
})
