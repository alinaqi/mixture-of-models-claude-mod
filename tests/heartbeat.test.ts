import { expect, test } from 'claude-code/testing'
import { HEARTBEAT_MODES, REASONS, turnUsedTools, assessStop, heartbeatBody, heartbeatMode, palguVerdict, shouldCheck } from '../hooks/lib/heartbeat.js'

test('assessStop is Palgu\'s classifier: an announced action, an empty stop or a trailing colon is premature', async () => {
  expect(assessStop('Tests pass. Let me check the config loader next.', false)).toBe('premature')
  expect(assessStop('Now I\'ll run the full suite', false)).toBe('premature')
  expect(assessStop('The failing cases are:', false)).toBe('premature')
  expect(assessStop('', false)).toBe('premature')
  expect(assessStop('Searching for the caller of parseConfig', false)).toBe('premature')
})

test('assessStop leaves a finished answer, a question and a sign-off alone', async () => {
  expect(assessStop('Done: 301 tests pass and the PR is merged.', false)).toBe('complete')
  expect(assessStop('Should I merge it now?', false)).toBe('question')
  expect(assessStop('Let me know if you want the other option.', false)).toBe('complete')
  // only the last line counts
  expect(assessStop('Let me check the loader.\nChecked: the loader is fine, nothing to change.', false)).toBe('complete')
})

test('assessStop calls described-but-unmade edits narration, only when the turn made no tool call', async () => {
  const text = 'Apply the following change to config.js and the tests will pass.'
  expect(assessStop(text, false)).toBe('narration')
  expect(assessStop(text, true)).toBe('complete')
  expect(assessStop('You should add a test for the empty list case.', false)).toBe('narration')
})

test('REASONS are the prompts Palgu continues with', async () => {
  expect(REASONS.premature).toMatch(/^You stopped mid-task/)
  expect(REASONS.narration).toMatch(/Make the edits now/)
})

test('heartbeatBody sends the session, the answer\'s last 600 characters and nothing else', async () => {
  const body = heartbeatBody('s1:3', 'x'.repeat(700) + 'tail')
  expect(Object.keys(body).sort()).toEqual(['session_id', 'stop_reason', 'text', 'tools_present'])
  expect(body.session_id).toBe('s1:3')
  expect(body.text.length).toBe(600)
  expect(body.text.endsWith('tail')).toBe(true)
  expect(body.stop_reason).toBe('end_turn')
  expect(body.tools_present).toBe(true)
})

test('palguVerdict reads should_continue and its reason; anything else is no answer', async () => {
  const res = (status, body) => ({ ok: status < 300, status, text: JSON.stringify(body) })
  expect(palguVerdict(res(200, { assessment: 'premature', should_continue: true, reason: REASONS.premature }))).toEqual({ assessment: 'premature', reason: REASONS.premature })
  expect(palguVerdict(res(200, { assessment: 'complete', should_continue: false, reason: '' }))).toEqual({ assessment: 'complete', reason: '' })
  // A continue with no prompt, a refusal or garbage is no verdict: the local classifier decides.
  expect(palguVerdict(res(200, { should_continue: true, reason: '' }))).toBe(null)
  expect(palguVerdict(res(401, {}))).toBe(null)
  expect(palguVerdict({ ok: true, status: 200, text: 'nope' })).toBe(null)
  expect(palguVerdict(undefined)).toBe(null)
})

test('heartbeatMode: palgu, local or off; palgu needs a Palgu gateway, else local', async () => {
  expect(HEARTBEAT_MODES).toEqual(['palgu', 'local', 'off'])
  expect(heartbeatMode(undefined, true)).toBe('palgu')
  expect(heartbeatMode(undefined, false)).toBe('local')
  expect(heartbeatMode('palgu', false)).toBe('local')
  expect(heartbeatMode('off', true)).toBe('off')
  expect(heartbeatMode(false, true)).toBe('off')
  expect(heartbeatMode('yolo', true)).toBe('palgu')
})

test('shouldCheck: a main-session answer, under budget, with the heartbeat on', async () => {
  const turn = { reason: 'answer', agentId: undefined }
  expect(shouldCheck(turn, { mode: 'local', used: 0, max: 3, child: false })).toBe(true)
  expect(shouldCheck(turn, { mode: 'local', used: 3, max: 3, child: false })).toBe(false)
  expect(shouldCheck(turn, { mode: 'off', used: 0, max: 3, child: false })).toBe(false)
  // a child's answer is vetted for narration already, and an aborted or subagent turn is not a stop to heal
  expect(shouldCheck(turn, { mode: 'local', used: 0, max: 3, child: true })).toBe(false)
  expect(shouldCheck({ isAborted: true }, { mode: 'local', used: 0, max: 3, child: false })).toBe(false)
  expect(shouldCheck({ reason: 'error' }, { mode: 'local', used: 0, max: 3, child: false })).toBe(false)
  expect(shouldCheck({ reason: 'answer', agentId: 'a1' }, { mode: 'local', used: 0, max: 3, child: false })).toBe(false)
})

test('turnUsedTools looks only at this turn: the assistant messages after the person\'s last prompt', async () => {
  const prompt = { role: 'user', text: 'fix it', toolUses: [] }
  const result = { role: 'user', text: '', toolUses: [], toolResults: [{}] }
  const call = { role: 'assistant', text: '', toolUses: [{ name: 'Edit' }] }
  const done = { role: 'assistant', text: 'done', toolUses: [] }
  expect(turnUsedTools([prompt, call, result, done])).toBe(true)
  expect(turnUsedTools([call, result, prompt, done])).toBe(false)
  expect(turnUsedTools([])).toBe(false)
})
