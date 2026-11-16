// mom's commands other than `hook`: sign-in, the key for a tool's token command, memory consent,
// heartbeat setting, and per-tool setup (ADR 0005).
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { deviceBody, newInstallId, parseBody, tokenBody, tokenStep } from '../../hooks/lib/palgu.js'
import { memoryLine, memoryOn, setMemory } from '../../hooks/lib/memory.js'
import { VERSION } from '../../hooks/lib/version.js'
import { codexProfile } from './lib/setup.js'
import { setupCursor } from './setup-cursor.js'
import { settingsOf } from './lib/session.js'
import { call, indexInBackground, loadKey, palguStatus, readJson, removeFile, writeJson } from './io.js'

const fail = (text, code = 1) => ({ code, err: text + '\n' })
const done = (text) => ({ code: 0, out: text + '\n' })
const json = { 'content-type': 'application/json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function installId() {
  const state = readJson('state.json', {}) || {}
  if (state.installId) return state.installId
  const id = newInstallId()
  writeJson('state.json', { ...state, installId: id })
  return id
}

async function poll(code, interval, until) {
  while (Date.now() < until) {
    await sleep(interval * 1000)
    const step = tokenStep(await call('/auth/token', { method: 'POST', headers: json, body: JSON.stringify(tokenBody(code)) }, 15000), interval)
    if (step.state !== 'wait') return step
    interval = step.interval
  }
  return { state: 'stop', reason: 'the code expired: run mom login again' }
}

export async function login() {
  const name = ('Mixture of Models CLI on ' + hostname()).slice(0, 64)
  const res = await call('/auth/device/code', { method: 'POST', headers: json, body: JSON.stringify(deviceBody(name, installId())) }, 15000)
  const start = parseBody(res)
  if (!res.ok || !start.device_code) return fail('Palgu sign-in could not start (' + res.status + ')')
  process.stdout.write('Open https://www.palgu.ai/connect?code=' + encodeURIComponent(start.user_code) + ' and approve code ' + start.user_code + '\nWaiting for approval…\n')
  const step = await poll(start.device_code, Number(start.interval) || 5, Date.now() + (Number(start.expires_in) || 600) * 1000)
  if (step.state !== 'ok') return fail('Not signed in: ' + step.reason)
  writeJson('credentials.json', { key: step.key, email: step.email, org: step.org })
  return done('Signed in to Palgu as ' + step.email + (step.org ? ' (' + step.org + ')' : '') + '.')
}

export function logout() {
  removeFile('credentials.json')
  return done('Signed out of Palgu (mom).')
}

export function token() {
  const k = loadKey()
  return k ? { code: 0, out: k } : fail('No Palgu key: run mom login')
}

export async function memory(word, cwd) {
  const state = readJson('state.json', {}) || {}
  if (word === 'on' && !loadKey()) return fail('Palgu memory needs a Palgu sign-in: run mom login first')
  if (word === 'on' || word === 'off') writeJson('state.json', { ...state, memory: setMemory(state.memory, cwd, word === 'on') })
  if (word === 'on') indexInBackground(cwd)
  if (word === 'off') return done(memoryLine({ on: false }))
  const status = await palguStatus(cwd)
  return done(memoryLine({ on: memoryOn((readJson('state.json', {}) || {}).memory, cwd), status, now: Date.now(), missing: false }))
}

export function heartbeat(mode) {
  if (!['palgu', 'local', 'off'].includes(mode)) return fail('mom heartbeat palgu|local|off', 2)
  const state = readJson('state.json', {}) || {}
  writeJson('state.json', { ...state, settings: { ...settingsOf(state), heartbeat: mode } })
  return done('Heartbeat: ' + mode)
}

export async function status(cwd) {
  const key = loadKey()
  const who = readJson('credentials.json', {}) || {}
  const line = key ? 'Palgu: signed in' + (who.email ? ' as ' + who.email : '') : 'Palgu: not signed in (mom login)'
  const state = readJson('state.json', {}) || {}
  return done([line, 'Heartbeat: ' + settingsOf(state).heartbeat, (await memory('status', cwd)).out.trim(), 'mom ' + VERSION].join('\n'))
}

function writeCodexProfile() {
  const dir = process.env.CODEX_HOME || join(homedir(), '.codex')
  const path = join(dir, 'palgu.config.toml')
  mkdirSync(dir, { recursive: true })
  if (existsSync(path) && readFileSync(path, 'utf8') !== codexProfile(VERSION)) copyFileSync(path, path + '.bak')
  writeFileSync(path, codexProfile(VERSION))
  return path
}

export function setup(tool, write) {
  if (tool === 'cursor') return setupCursor(process.cwd(), write)
  if (tool !== 'codex') return fail('mom setup codex|cursor [--write]', 2)
  if (!write) return done(codexProfile(VERSION).trim())
  return done('Wrote ' + writeCodexProfile() + '. Start Codex on Palgu with: codex -p palgu')
}
