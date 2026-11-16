// mom's effects: its files, the Palgu key, calls to Palgu, and the `palgu` CLI (ADR 0005).
// Everything decide.js needs from the outside world comes from makeIo.
import { closeSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { isPalguKey } from '../../hooks/lib/palgu.js'
import { memoryStatus } from '../../hooks/lib/memory.js'

export const PALGU = 'https://api.palgu.ai'
export const home = () => process.env.MOM_HOME || join(homedir(), '.config', 'mixture-of-models')
const file = (name) => join(home(), name)

export function readJson(name, fallback) {
  try {
    return JSON.parse(readFileSync(file(name), 'utf8'))
  } catch {
    return fallback
  }
}

// Written whole and renamed into place, readable by the user only.
export function writeJson(name, value) {
  mkdirSync(home(), { recursive: true, mode: 0o700 })
  const tmp = file(name + '.' + process.pid + '.tmp')
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  renameSync(tmp, file(name))
}

export function removeFile(name) {
  rmSync(file(name), { force: true })
}

// PALGU_API_KEY wins; else the key `mom login` saved. Anything that is not one plain token is ignored.
export function loadKey() {
  const k = process.env.PALGU_API_KEY || (readJson('credentials.json', {}) || {}).key || ''
  return isPalguKey(k) ? k : ''
}

// Where each tool keeps the transcripts its hooks may point at. A transcript path comes from hook
// input, so mom reads only a regular .jsonl file inside that folder (after resolving links).
const userHome = () => process.env.HOME || homedir()
const TRANSCRIPT_ROOTS = {
  antigravity: () => join(userHome(), '.gemini', 'antigravity-cli'),
  copilot: () => process.env.COPILOT_HOME || join(userHome(), '.copilot')
}

function transcriptFile(tool, path) {
  const rootOf = TRANSCRIPT_ROOTS[tool]
  if (!rootOf || !String(path).endsWith('.jsonl')) return ''
  try {
    const root = realpathSync(rootOf()) + sep
    const real = realpathSync(path)
    return real.startsWith(root) && statSync(real).isFile() ? real : ''
  } catch {
    return ''
  }
}

// The last `bytes` of a tool's transcript (the answer is near the end), or null when it may not
// or cannot be read. Only that much is read, never the whole file.
export function readTranscript(tool, path, bytes = 262144) {
  const file = transcriptFile(tool, path)
  if (!file) return null
  const fd = openSync(file, 'r')
  try {
    const size = fstatSync(fd).size
    const buf = Buffer.alloc(Math.min(size, bytes))
    readSync(fd, buf, 0, buf.length, size - buf.length)
    return buf.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

export async function call(path, init, ms) {
  const res = await fetch(PALGU + path, { ...init, signal: AbortSignal.timeout(ms) })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

// The palgu CLI uses its own sign-in (`palgu login`); without one, it falls back to SROOTER_API_KEY,
// which is mom's key, so `mom login` alone is enough to index.
function palguEnv() {
  const key = loadKey()
  return key && !process.env.SROOTER_API_KEY ? { ...process.env, SROOTER_API_KEY: key } : process.env
}

function palguStatus(cwd, ms = 15000) {
  return new Promise((resolve) => {
    execFile('palgu', ['memory', 'status', '.', '--json'], { cwd, timeout: ms, env: palguEnv() }, (err, stdout) => {
      resolve(memoryStatus({ exitCode: err ? (err.code === 1 ? 1 : 2) : 0, stdout: String(stdout || '') }))
    })
  })
}

export function indexInBackground(cwd) {
  try {
    spawn('palgu', ['memory', 'index', '.'], { cwd, detached: true, stdio: 'ignore', env: palguEnv() }).on('error', () => undefined).unref()
  } catch {
    // no palgu CLI: memory status says so
  }
}

export function makeIo(tool, key) {
  return {
    tool, key, now: Date.now(),
    // At most 5 s: the prompt hook has 10 s in all, and the search needs up to 3.
    async projectName(cwd) {
      const s = await palguStatus(cwd, 5000)
      return s && s.indexed ? s.project : ''
    },
    search: (project, q) => call('/v1/cortex/search?limit=8&project=' + encodeURIComponent(project) + '&q=' + encodeURIComponent(q), { headers: { authorization: 'Bearer ' + key } }, 3000),
    heartbeat: (body) => call('/anthropic/heartbeat', { method: 'POST', headers: { 'x-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) }, 8000),
    indexInBackground
  }
}

// What session.js `step` needs: this io and mom's state file.
export function stateEnv(io) {
  return { io, read: () => readJson('state.json', {}), write: (s) => writeJson('state.json', s) }
}

export { palguStatus }
