// /route update: compare this version with the manifest on main, and update through Claude Code's
// own plugin commands. Pure.
import { PLUGIN_ID } from './palgu.js'

export const LATEST_URL = 'https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json'
const MARKETPLACE = PLUGIN_ID.split('@')[1]
const BY_HAND = 'claude plugin marketplace update ' + MARKETPLACE + ' && claude plugin update ' + PLUGIN_ID

// The published version, or '' when the answer is missing or not a version.
export function latestVersion(res) {
  if (!res || !res.ok) return ''
  try {
    const v = String(JSON.parse(res.text).version || '')
    return /^\d+\.\d+\.\d+$/.test(v) ? v : ''
  } catch {
    return ''
  }
}

export function isNewer(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  const i = x.findIndex((n, k) => n !== y[k])
  return i >= 0 && x[i] > y[i]
}

// What a failed or missing `claude` turns into, and the line of its output worth showing.
export function failedRun(err) {
  return { exitCode: 1, stderr: String((err && err.message) || err) }
}

export function lastLine(r) {
  return String(r.stderr || r.stdout || '').trim().split('\n').pop() || 'exit ' + r.exitCode
}

// The two commands /route update runs, as register.js writes them literally at its calls.
export function updateCommands() {
  return [['claude', 'plugin', 'marketplace', 'update', MARKETPLACE], ['claude', 'plugin', 'update', PLUGIN_ID]]
}

// The session-start check: GitHub at most every 12 hours, the answer kept in the store between.
export const CHECK_EVERY_MS = 12 * 3600 * 1000

export function checkDue(cache, now) {
  return !cache || !cache.checkedAt || now - cache.checkedAt >= CHECK_EVERY_MS
}

// The once-per-version notice, or '' when there is nothing newer.
export function updateNotice(current, latest) {
  if (!latest || !isNewer(latest, current)) return ''
  return 'mixture-of-models ' + latest + ' is out (you have ' + current + '): run /route update, then /reload-plugins.'
}

// r: { current, latest, updated?, error? }
export function updateText(r) {
  if (!r.latest) return 'mixture-of-models could not check for updates (GitHub unreachable). To update by hand: ' + BY_HAND
  if (!isNewer(r.latest, r.current)) return 'mixture-of-models ' + r.current + ' is up to date.'
  if (r.updated) return 'Updated mixture-of-models ' + r.current + ' → ' + r.latest + '. Run /reload-plugins to load it; see the CHANGELOG for what changed.'
  return 'mixture-of-models ' + r.latest + ' is out but the update failed (' + r.error + '). Run: ' + BY_HAND
}
