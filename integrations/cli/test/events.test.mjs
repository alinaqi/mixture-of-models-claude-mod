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

const cursor = (o) => JSON.stringify({ conversation_id: 'c1', generation_id: 'g1', model: 'auto', cursor_version: '3.9.0', workspace_roots: ['/work'], user_email: null, transcript_path: null, ...o })

test('parseEvent reads Cursor sessionStart, beforeSubmitPrompt, afterAgentResponse and stop, keyed by conversation and the first workspace root', () => {
  assert.deepEqual(parseEvent('cursor', cursor({ hook_event_name: 'sessionStart', session_id: 'c1', is_background_agent: false })), { kind: 'start', session: 'c1', cwd: '/work', prompt: '', answer: '', continued: false, recall: false })
  const prompt = parseEvent('cursor', cursor({ hook_event_name: 'beforeSubmitPrompt', prompt: 'fix the loader', attachments: [] }))
  assert.equal(prompt.kind, 'prompt')
  assert.equal(prompt.prompt, 'fix the loader')
  assert.equal(prompt.recall, false)
  const answer = parseEvent('cursor', cursor({ hook_event_name: 'afterAgentResponse', text: 'Let me check the tests.' }))
  assert.equal(answer.kind, 'answer')
  assert.equal(answer.answer, 'Let me check the tests.')
  const stop = parseEvent('cursor', cursor({ hook_event_name: 'stop', status: 'completed', loop_count: 1 }))
  assert.equal(stop.kind, 'stop')
  assert.equal(stop.continued, true)
  assert.equal(stop.answer, null)
})

test('parseEvent for Cursor: an aborted or failed stop is not a stop to heal; the session falls back to session_id', () => {
  assert.equal(parseEvent('cursor', cursor({ hook_event_name: 'stop', status: 'aborted', loop_count: 0 })), null)
  assert.equal(parseEvent('cursor', cursor({ hook_event_name: 'stop', status: 'error', loop_count: 0 })), null)
  assert.equal(parseEvent('cursor', cursor({ hook_event_name: 'postToolUse' })), null)
  const start = parseEvent('cursor', JSON.stringify({ hook_event_name: 'sessionStart', session_id: 's9', workspace_roots: [] }))
  assert.equal(start.session, 's9')
  assert.equal(start.cwd, '')
})

test('render answers Cursor: a note at session start, allow on prompt submit, followup_message on stop', () => {
  assert.deepEqual(JSON.parse(render('cursor', 'start', { note: 'Palgu memory is on' })), { additional_context: 'Palgu memory is on' })
  assert.equal(render('cursor', 'start', {}), '')
  assert.deepEqual(JSON.parse(render('cursor', 'prompt', { context: 'ignored: Cursor cannot add context here' })), { continue: true })
  assert.deepEqual(JSON.parse(render('cursor', 'stop', { reason: 'You stopped mid-task' })), { followup_message: 'You stopped mid-task' })
  assert.equal(render('cursor', 'stop', { reason: '' }), '')
  assert.equal(render('cursor', 'answer', {}), '')
  assert.ok(TOOLS.includes('cursor'))
})
