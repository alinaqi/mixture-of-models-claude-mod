import { expect, test } from 'claude-code/testing'
import { HEARTBEAT_MODES, REASONS, turnUsedTools, wantsEdits, continuePrompt, assessStop, waitingOnBackground, heartbeatBody, heartbeatMode, palguVerdict, shouldCheck } from '../hooks/lib/heartbeat.js'

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

test('wantsEdits: the person asked for changes, and did not ask to only see them', async () => {
  expect(wantsEdits('fix the failing config test')).toBe(true)
  expect(wantsEdits('add a --json flag to the status command')).toBe(true)
  expect(wantsEdits('show me a patch for this; don\'t edit files')).toBe(false)
  expect(wantsEdits('explain how the loader works')).toBe(false)
  expect(wantsEdits('what would you change here?')).toBe(false)
  expect(wantsEdits('just show the diff, do not apply it')).toBe(false)
})

test('wantsEdits: a polite question or a fix that also asks for an explanation still wants edits', async () => {
  expect(wantsEdits('Can you fix the loader?')).toBe(true)
  expect(wantsEdits('Fix the loader and explain the changes')).toBe(true)
  expect(wantsEdits('review the config module and fix what is broken')).toBe(true)
  expect(wantsEdits('how would you refactor this?')).toBe(false)
})

test('continuePrompt: narration continues only when edits were asked for; premature always', async () => {
  expect(continuePrompt({ assessment: 'narration', reason: REASONS.narration }, 'fix the config test')).toBe(REASONS.narration)
  expect(continuePrompt({ assessment: 'narration', reason: REASONS.narration }, 'show me a patch, don\'t edit')).toBe('')
  expect(continuePrompt({ assessment: 'premature', reason: REASONS.premature }, 'explain the loader')).toBe(REASONS.premature)
  expect(continuePrompt({ assessment: 'complete', reason: '' }, 'fix it')).toBe('')
})

// The four answers the heartbeat continued by mistake on 2026-11-16: each ends waiting on work running
// in the background (subagents, a GitHub merge), so continuing could only make the model wait again.
const WAITING = [
  'Waiting for the translator to update the 15 translated files. Then I\'ll run the checks, open the PR, merge it, publish v0.33.0 and update your plugin.',
  'I added the GitHub check to the English summary list and sent the same two edits to the translator. Once it reports back I\'ll check the result, then commit, merge, release v0.33.0 and update your plugin.',
  'French is finished too, with all 12 files passing the checks. I\'ll check the other languages handled those links the same way. Still waiting on Japanese, German and Arabic.',
  'Waiting for GitHub to finish the merge it already started; then I\'ll tag the release and update your plugin.',
  'The suite is still running in the background. I\'ll report the results when it finishes.',
  'Two agents are working on it; as soon as they finish I\'ll merge the branches.',
]

test('waitingOnBackground spots an answer that ends waiting on work running elsewhere', async () => {
  for (const text of WAITING) expect(waitingOnBackground(text)).toBe(true)
})

test('waitingOnBackground leaves real mid-task stops alone', async () => {
  expect(waitingOnBackground('Tests pass. Let me check the config loader next.')).toBe(false)
  expect(waitingOnBackground('Next I\'ll update the README. Once that\'s done I\'ll run the tests.')).toBe(false)
  expect(waitingOnBackground('I\'ll wire the hook into register.js now.')).toBe(false)
  // Waiting mentioned early, then a plain announced action at the end: still a stop to heal.
  expect(waitingOnBackground('The build was waiting for the lock file earlier, which I removed. ' + 'x'.repeat(500) + ' Let me run the tests.')).toBe(false)
})

test('continuePrompt never continues an answer that waits on background work, whoever judged it premature', async () => {
  for (const text of WAITING) expect(continuePrompt({ assessment: 'premature', reason: REASONS.premature }, 'merge and release it', text)).toBe('')
  expect(continuePrompt({ assessment: 'premature', reason: REASONS.premature }, 'fix it', 'Let me run the tests.')).toBe(REASONS.premature)
  expect(continuePrompt({ assessment: 'premature', reason: REASONS.premature }, 'fix it')).toBe(REASONS.premature)
})
