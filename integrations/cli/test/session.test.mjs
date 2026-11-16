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
