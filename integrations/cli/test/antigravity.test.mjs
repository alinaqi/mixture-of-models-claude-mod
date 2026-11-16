import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEvent, render, TOOLS } from '../lib/events.js'

const agy = (o) => JSON.stringify({ conversationId: 'cv1', cwd: '/work', workspacePaths: ['/work'], transcriptPath: '/t/transcript.jsonl', modelName: 'gemini-4', lastUserInput: 'fix the loader', ...o })

test('antigravity is a tool mom hook answers; the event comes from the command line', () => {
  assert.ok(TOOLS.includes('antigravity'))
  assert.deepEqual(parseEvent('antigravity', agy({}), 'SessionStart'), { kind: 'start', session: 'cv1', cwd: '/work', prompt: 'fix the loader', answer: '', continued: false, transcript: '/t/transcript.jsonl' })
  assert.equal(parseEvent('antigravity', agy({}), 'PostToolUse'), null)
  assert.equal(parseEvent('antigravity', agy({}), undefined), null)
})

test('PreInvocation is the prompt only on the turn\'s first model call', () => {
  const first = parseEvent('antigravity', agy({ invocationNum: 0 }), 'PreInvocation')
  assert.equal(first.kind, 'prompt')
  assert.equal(first.prompt, 'fix the loader')
  assert.equal(parseEvent('antigravity', agy({ invocationNum: 2 }), 'PreInvocation'), null)
})

test('the event name is read from hookEventName when Antigravity sends it (it does, though its docs do not say so)', () => {
  assert.equal(parseEvent('antigravity', agy({ hookEventName: 'Stop', terminationReason: 'NO_TOOL_CALL' })).kind, 'stop')
})

// Seen live in agy 1.0.7: a turn that ends with an answer stops with NO_TOOL_CALL (the docs say model_stop), a failed one with ERROR.
test('Stop: only a model stop is healed; the answer is read from the transcript later; continuationActive marks a continue', () => {
  assert.equal(parseEvent('antigravity', agy({ terminationReason: 'NO_TOOL_CALL', error: '' }), 'Stop').kind, 'stop')
  assert.equal(parseEvent('antigravity', agy({ terminationReason: 'ERROR', error: 'PERMISSION_DENIED' }), 'Stop'), null)
  const stop = parseEvent('antigravity', agy({ terminationReason: 'model_stop', continuationActive: true }), 'Stop')
  assert.equal(stop.kind, 'stop')
  assert.equal(stop.answer, null)
  assert.equal(stop.continued, true)
  assert.equal(parseEvent('antigravity', agy({ terminationReason: 'user_cancel' }), 'Stop'), null)
  assert.equal(parseEvent('antigravity', agy({ terminationReason: 'model_stop', error: 'quota' }), 'Stop'), null)
})

test('render answers Antigravity: memory as an ephemeral step on the first call, continue with the reason on stop', () => {
  assert.deepEqual(JSON.parse(render('antigravity', 'prompt', { context: 'Palgu memory for work:\n- [doc] a' })), { injectSteps: [{ ephemeralMessage: 'Palgu memory for work:\n- [doc] a' }] })
  assert.deepEqual(JSON.parse(render('antigravity', 'stop', { reason: 'You stopped mid-task' })), { decision: 'continue', reason: 'You stopped mid-task' })
  assert.equal(render('antigravity', 'prompt', {}), '')
  assert.equal(render('antigravity', 'stop', { reason: '' }), '')
})

test('lastAnswer reads the model\'s last answer from an Antigravity transcript (JSONL, PLANNER_RESPONSE steps)', async () => {
  const { lastAnswer } = await import('../lib/transcript.js')
  const steps = [
    { step_index: 0, source: 'USER_EXPLICIT', type: 'USER_INPUT', content: '<USER_REQUEST>fix it</USER_REQUEST>' },
    { step_index: 1, source: 'MODEL', type: 'PLANNER_RESPONSE', content: 'First answer' },
    { step_index: 2, source: 'SYSTEM', type: 'SYSTEM_MESSAGE', content: 'x' },
    { step_index: 3, source: 'MODEL', type: 'PLANNER_RESPONSE', content: 'Let me check the tests.' }
  ]
  assert.equal(lastAnswer(steps.map((x) => JSON.stringify(x)).join('\n') + '\n'), 'Let me check the tests.')
  assert.equal(lastAnswer('not json\n{"type":"USER_INPUT","content":"a"}'), '')
  assert.equal(lastAnswer(''), '')
})

test('the Antigravity plugin is on the mod\'s version and its hooks call mom with the event name', async () => {
  const { readFileSync } = await import('node:fs')
  const { VERSION } = await import('../../../hooks/lib/version.js')
  const root = new URL('../../../integrations/antigravity/', import.meta.url)
  assert.equal(JSON.parse(readFileSync(new URL('plugin.json', root), 'utf8')).version, VERSION)
  const hooks = JSON.parse(readFileSync(new URL('hooks.json', root), 'utf8'))['mixture-of-models']
  for (const [event, handlers] of Object.entries(hooks)) assert.equal(handlers[0].command, 'mom hook antigravity ' + event)
  assert.deepEqual(JSON.parse(readFileSync(new URL('mcp_config.json', root), 'utf8')).mcpServers.palgu, { command: 'mom', args: ['mcp', 'antigravity'] })
})
