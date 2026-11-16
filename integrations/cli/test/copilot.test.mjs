import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEvent, render, TOOLS } from '../lib/events.js'

// Copilot CLI hooks configured in camelCase get camelCase input with no event name: the hook command names it.
const cop = (o) => JSON.stringify({ sessionId: 'cs1', timestamp: 1, cwd: '/work', ...o })

test('copilot is a tool mom hook answers; sessionStart, userPromptSubmitted and agentStop map to start, prompt and stop', () => {
  assert.ok(TOOLS.includes('copilot'))
  assert.deepEqual(parseEvent('copilot', cop({ source: 'startup' }), 'sessionStart'), { kind: 'start', session: 'cs1', cwd: '/work', prompt: '', answer: '', continued: false, recall: false, transcript: '' })
  const prompt = parseEvent('copilot', cop({ prompt: 'fix the loader' }), 'userPromptSubmitted')
  assert.equal(prompt.kind, 'prompt')
  assert.equal(prompt.prompt, 'fix the loader')
  // a command hook's output on prompt submit is dropped by Copilot, so no recall there (memory goes through MCP)
  assert.equal(prompt.recall, false)
  assert.equal(parseEvent('copilot', cop({}), 'preToolUse'), null)
})

test('agentStop: the answer comes from the transcript; stop_hook_active marks a continue; only an end_turn is healed', () => {
  const stop = parseEvent('copilot', cop({ transcriptPath: '/t/events.jsonl', stopReason: 'end_turn', stop_hook_active: true }), 'agentStop')
  assert.equal(stop.kind, 'stop')
  assert.equal(stop.answer, null)
  assert.equal(stop.transcript, '/t/events.jsonl')
  assert.equal(stop.continued, true)
  assert.equal(parseEvent('copilot', cop({ stopReason: 'error' }), 'agentStop'), null)
})

test('render answers Copilot: the memory note at session start, block with the reason on stop', () => {
  assert.deepEqual(JSON.parse(render('copilot', 'start', { note: 'Palgu memory is on' })), { additionalContext: 'Palgu memory is on' })
  assert.deepEqual(JSON.parse(render('copilot', 'stop', { reason: 'You stopped mid-task' })), { decision: 'block', reason: 'You stopped mid-task' })
  assert.equal(render('copilot', 'prompt', { context: 'x' }), '')
  assert.equal(render('copilot', 'stop', { reason: '' }), '')
})
