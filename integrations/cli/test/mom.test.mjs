import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REASONS } from '../../../hooks/lib/heartbeat.js'

const MOM = join(dirname(fileURLToPath(import.meta.url)), '..', 'mom.js')

function mom(args, { input = '', env = {}, home } = {}) {
  const dir = home || mkdtempSync(join(tmpdir(), 'mom-'))
  const r = spawnSync(process.execPath, [MOM, ...args], { input, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', MOM_HOME: dir, HOME: dir, ...env } })
  return { ...r, home: dir }
}

test('mom token prints nothing and fails without a key; prints the saved key, alone, with one', () => {
  assert.equal(mom(['token']).status, 1)
  const home = mkdtempSync(join(tmpdir(), 'mom-'))
  writeFileSync(join(home, 'credentials.json'), JSON.stringify({ key: 'pk_test_123456789' }))
  const r = mom(['token'], { home })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, 'pk_test_123456789')
})

test('mom hook codex continues a premature stop with the local classifier when there is no key', () => {
  const r = mom(['hook', 'codex'], { input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's1', cwd: '/w', last_assistant_message: 'Now I\'ll run the full suite', stop_hook_active: false }) })
  assert.equal(r.status, 0)
  assert.deepEqual(JSON.parse(r.stdout), { decision: 'block', reason: REASONS.premature })
  const state = JSON.parse(readFileSync(join(r.home, 'state.json'), 'utf8'))
  assert.equal(state.sessions.s1.beats, 1)
  assert.equal(statSync(join(r.home, 'state.json')).mode & 0o777, 0o600)
})

test('mom hook prints nothing for a finished answer, an unknown event or garbage, and never fails', () => {
  for (const input of [JSON.stringify({ hook_event_name: 'Stop', session_id: 's1', cwd: '/w', last_assistant_message: 'Done: 12 tests pass.' }), JSON.stringify({ hook_event_name: 'PreToolUse' }), 'garbage']) {
    const r = mom(['hook', 'codex'], { input })
    assert.equal(r.status, 0)
    assert.equal(r.stdout, '')
  }
})

test('mom heartbeat off is saved and stops the heartbeat', () => {
  const home = mkdtempSync(join(tmpdir(), 'mom-'))
  assert.equal(mom(['heartbeat', 'off'], { home }).status, 0)
  const r = mom(['hook', 'codex'], { home, input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's1', cwd: '/w', last_assistant_message: 'Now I\'ll run the full suite' }) })
  assert.equal(r.stdout, '')
  assert.equal(mom(['heartbeat', 'sometimes'], { home }).status, 2)
})

test('mom memory on refuses without a Palgu sign-in', () => {
  const r = mom(['memory', 'on'])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /mom login/)
})

test('mom setup codex prints the profile; --write writes ~/.codex/palgu.config.toml and keeps an old one', () => {
  assert.match(mom(['setup', 'codex']).stdout, /model_provider = "palgu"/)
  const home = mkdtempSync(join(tmpdir(), 'mom-'))
  const r = mom(['setup', 'codex', '--write'], { home, env: { CODEX_HOME: join(home, '.codex') } })
  assert.equal(r.status, 0)
  const path = join(home, '.codex', 'palgu.config.toml')
  assert.match(readFileSync(path, 'utf8'), /auth = \{ command = "mom", args = \["token"\] \}/)
  writeFileSync(path, 'mine = true\n')
  mom(['setup', 'codex', '--write'], { home, env: { CODEX_HOME: join(home, '.codex') } })
  assert.equal(readFileSync(path + '.bak', 'utf8'), 'mine = true\n')
})

test('mom with no command or an unknown one prints help and fails', () => {
  assert.match(mom([]).stdout, /mom login/)
  assert.equal(mom(['frobnicate']).status, 2)
  assert.equal(existsSync(MOM), true)
})
