import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beginPrompt, takeBeat, sessionOf, prune, DAY_MS, settingsOf } from '../lib/session.js'

test('beginPrompt records the prompt and resets the session\'s heartbeat budget', () => {
  const s = beginPrompt({ sessions: { s1: { prompt: 'old', beats: 3, n: 1, at: 0 } } }, 's1', 'fix it', 100)
  assert.deepEqual(sessionOf(s, 's1'), { prompt: 'fix it', beats: 0, n: 2, at: 100 })
  assert.deepEqual(sessionOf(beginPrompt({}, 's2', 'hi', 5), 's2'), { prompt: 'hi', beats: 0, n: 1, at: 5 })
})

test('takeBeat allows max continues per prompt, then refuses', () => {
  let state = beginPrompt({}, 's1', 'fix it', 0)
  for (let i = 0; i < 3; i += 1) {
    const r = takeBeat(state, 's1', 3, 10)
    assert.equal(r.ok, true)
    state = r.state
  }
  assert.equal(takeBeat(state, 's1', 3, 10).ok, false)
  assert.equal(takeBeat(state, 's1', 0, 10).ok, false)
})

test('prune drops sessions older than a day', () => {
  const s = prune({ sessions: { old: { at: 0 }, new: { at: DAY_MS } } }, DAY_MS + 1)
  assert.deepEqual(Object.keys(s.sessions), ['new'])
})

test('settingsOf: heartbeat palgu with at most 3 continues by default; off or local when set', () => {
  assert.deepEqual(settingsOf({}), { heartbeat: 'palgu', heartbeatMax: 3 })
  assert.deepEqual(settingsOf({ settings: { heartbeat: 'off', heartbeatMax: 1 } }), { heartbeat: 'off', heartbeatMax: 1 })
  assert.deepEqual(settingsOf({ settings: { heartbeat: 'nonsense', heartbeatMax: -2 } }), { heartbeat: 'palgu', heartbeatMax: 3 })
})

test('mergeState keeps what other hook runs saved meanwhile: only this session, folder and index entry are taken from this run', async () => {
  const { mergeState } = await import('../lib/session.js')
  const before = { memory: { '/w': true }, sessions: { s1: { prompt: 'a', beats: 0, n: 1, at: 1 } } }
  const mine = { ...before, sessions: { s1: { prompt: 'a', beats: 1, n: 1, at: 2 } }, projects: { '/w': 'w' }, index: { '/w': 5 } }
  // meanwhile: memory turned off, another session continued, settings changed
  const current = { memory: {}, settings: { heartbeat: 'off' }, sessions: { s1: { prompt: 'a', beats: 0, n: 1, at: 1 }, s2: { prompt: 'b', beats: 2, n: 1, at: 3 } } }
  const out = mergeState(current, mine, { session: 's1', cwd: '/w' })
  assert.deepEqual(out.memory, {})
  assert.deepEqual(out.settings, { heartbeat: 'off' })
  assert.equal(out.sessions.s1.beats, 1)
  assert.equal(out.sessions.s2.beats, 2)
  assert.equal(out.projects['/w'], 'w')
  assert.equal(out.index['/w'], 5)
})

test('recordAnswer keeps the last answer of a session for the stop hook; a new prompt clears it', async () => {
  const { recordAnswer } = await import('../lib/session.js')
  let s = recordAnswer(beginPrompt({}, 'c1', 'fix it', 1), 'c1', 'Let me check.', 2)
  assert.equal(sessionOf(s, 'c1').answer, 'Let me check.')
  assert.equal(sessionOf(s, 'c1').prompt, 'fix it')
  s = beginPrompt(s, 'c1', 'now the docs', 3)
  assert.equal(sessionOf(s, 'c1').answer, undefined)
  assert.equal(sessionOf(recordAnswer({}, 'c2', 'x'.repeat(5000), 1), 'c2').answer.length, 2000)
})

test('a prompt that is the heartbeat\'s own follow-up does not reset the budget or replace the prompt', async () => {
  const { markFollowup } = await import('../lib/session.js')
  let s = beginPrompt({}, 'c1', 'fix the loader', 1)
  s = takeBeat(s, 'c1', 3, 2).state
  s = markFollowup(s, 'c1', 'You stopped mid-task. Continue.')
  s = beginPrompt(s, 'c1', 'You stopped mid-task. Continue.', 3)
  assert.equal(sessionOf(s, 'c1').beats, 1)
  assert.equal(sessionOf(s, 'c1').prompt, 'fix the loader')
  assert.equal(sessionOf(s, 'c1').followup, '')
  s = beginPrompt(s, 'c1', 'You stopped mid-task. Continue.', 4)
  assert.equal(sessionOf(s, 'c1').beats, 0)
})

test('step runs a handler on the saved state and saves its result merged into what is on disk now', async () => {
  const { step } = await import('../lib/session.js')
  let disk = { memory: { '/w': true }, sessions: {} }
  const store = { read: () => disk, write: (s) => { disk = s } }
  const handler = async (ev, state, io) => ({ out: state.memory['/w'] && io.now, state: { ...state, sessions: { [ev.session]: { prompt: 'p', beats: 0, n: 1, at: io.now } } } })
  const r = await step(handler, { session: 's1', cwd: '/w' }, { io: { now: 7 }, ...store })
  assert.equal(r.out, 7)
  assert.equal(disk.sessions.s1.at, 7)
  assert.deepEqual(disk.memory, { '/w': true })
})
