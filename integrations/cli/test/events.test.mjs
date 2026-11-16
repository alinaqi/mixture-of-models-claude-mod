import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEvent, render, TOOLS } from '../lib/events.js'

const codex = (o) => JSON.stringify({ session_id: 's1', turn_id: 't1', cwd: '/work', model: 'auto', ...o })

test('parseEvent reads Codex SessionStart, UserPromptSubmit and Stop', () => {
  assert.deepEqual(parseEvent('codex', codex({ hook_event_name: 'SessionStart', source: 'startup' })), { kind: 'start', session: 's1', cwd: '/work', prompt: '', answer: '', continued: false })
  assert.equal(parseEvent('codex', codex({ hook_event_name: 'UserPromptSubmit', prompt: 'fix the loader' })).prompt, 'fix the loader')
  const stop = parseEvent('codex', codex({ hook_event_name: 'Stop', last_assistant_message: 'Let me check the tests.', stop_hook_active: true }))
  assert.equal(stop.kind, 'stop')
  assert.equal(stop.answer, 'Let me check the tests.')
  assert.equal(stop.continued, true)
})

test('parseEvent is null for an unknown tool, an unknown event or input that is not JSON', () => {
  assert.equal(parseEvent('vim', codex({ hook_event_name: 'Stop' })), null)
  assert.equal(parseEvent('codex', codex({ hook_event_name: 'PreToolUse' })), null)
  assert.equal(parseEvent('codex', 'not json'), null)
  assert.equal(parseEvent('codex', ''), null)
})

test('render answers Codex: context on prompt submit, block with a reason on stop, nothing otherwise', () => {
  assert.deepEqual(JSON.parse(render('codex', 'prompt', { context: 'Palgu memory for work:\n- [doc] a' })), { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'Palgu memory for work:\n- [doc] a' } })
  assert.deepEqual(JSON.parse(render('codex', 'stop', { reason: 'You stopped mid-task' })), { decision: 'block', reason: 'You stopped mid-task' })
  assert.equal(render('codex', 'prompt', {}), '')
  assert.equal(render('codex', 'stop', { reason: '' }), '')
  assert.equal(render('codex', 'start', {}), '')
})

test('TOOLS lists the tools mom hook answers', () => {
  assert.ok(TOOLS.includes('codex'))
})
