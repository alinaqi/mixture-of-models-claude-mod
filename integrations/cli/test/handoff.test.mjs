import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handoffFor, rememberHandoff } from '../lib/handoff.js'

const ID = '123e4567-e89b-42d3-a456-426614174000'
const event = { session: ID, cwd: '/work' }

test('mom hook remembers only the Codex session id and folder, never prompts or answers', () => {
  const state = rememberHandoff({ heartbeat: 'palgu' }, { ...event, prompt: 'secret prompt', answer: 'x' }, 'codex')
  assert.deepEqual(state, { heartbeat: 'palgu', handoffs: { codex: { session: ID, cwd: '/work' } } })
  // Palgu continues Claude Code and Codex sessions; another tool's hook is not kept.
  assert.deepEqual(rememberHandoff(state, { session: 'other', cwd: '/elsewhere' }, 'cursor'), state)
  assert.deepEqual(rememberHandoff(state, { session: '', cwd: '/work' }, 'codex'), state)
})

test('mom palgu codex hands Palgu the exact hook session in its own folder; --open asks for a Terminal tab', () => {
  const state = rememberHandoff({}, event, 'codex')
  const r = handoffFor(['codex'], { state, cwd: '/somewhere/else' })
  assert.equal(r.code, 0)
  assert.equal(r.command, `cd /work && palgu --continue-codex=${ID}`)
  assert.deepEqual(r.args, [`--continue-codex=${ID}`])
  assert.equal(r.cwd, '/work')
  assert.equal(r.open, false)
  assert.equal(handoffFor(['codex', '--open'], { state }).open, true)
})

test('without a saved session mom palgu fails and never prints an id-less continuation', () => {
  for (const args of [['codex'], ['codex', '--session', 'latest']]) {
    const r = handoffFor(args, { state: {}, cwd: '/work' })
    assert.equal(r.code, 1)
    assert.doesNotMatch(r.err, /--continue-codex(?!=)/)
  }
  for (const args of [['cursor'], ['bogus'], [], ['codex', '--open=false'], ['codex', '--session']]) assert.equal(handoffFor(args, { state: {} }).code, 2)
})

test('an explicit --session must be a plain id, and runs in the current folder', () => {
  const r = handoffFor(['codex', '--session', 'thread_1'], { state: {}, cwd: '/work' })
  assert.equal(r.command, 'cd /work && palgu --continue-codex=thread_1')
  assert.equal(handoffFor(['codex', '--session', 'id; rm -rf'], { state: {}, cwd: '/work' }).code, 1)
})
