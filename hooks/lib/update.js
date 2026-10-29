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

export function updateCommands() {
  return [['claude', 'plugin', 'marketplace', 'update', MARKETPLACE], ['claude', 'plugin', 'update', PLUGIN_ID]]
}

// r: { current, latest, updated?, error? }
export function updateText(r) {
  if (!r.latest) return 'mixture-of-models could not check for updates (GitHub unreachable). To update by hand: ' + BY_HAND
  if (!isNewer(r.latest, r.current)) return 'mixture-of-models ' + r.current + ' is up to date.'
  if (r.updated) return 'Updated mixture-of-models ' + r.current + ' → ' + r.latest + '. Restart Claude Code to load it; see the CHANGELOG for what changed.'
  return 'mixture-of-models ' + r.latest + ' is out but the update failed (' + r.error + '). Run: ' + BY_HAND
}
