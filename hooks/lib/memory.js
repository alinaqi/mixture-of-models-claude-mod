// Palgu memory (cortex) for the project the session is in (issue #24). The mod's own key has no
// memory scope yet (srooter S7), so this goes through the `palgu` CLI and its own sign-in:
// `palgu memory index .` in the background, `palgu memory status . --json` for /palgu status.
// Indexing uploads the project's source to Palgu, so it is off until /palgu memory on. Pure.

export const INDEX_EVERY_MS = 10 * 60 * 1000

// { indexed, project, symbols, updated } from `palgu memory status --json` (exit 0 indexed,
// 1 not indexed, 2 error), or null when it did not answer.
export function memoryStatus(r) {
  if (!r || r.exitCode === 2) return null
  try {
    const s = JSON.parse(r.stdout)
    return { indexed: s.indexed === true, project: String(s.project || ''), symbols: Number(s.symbols) || 0, updated: String(s.updated || '') }
  } catch {
    return null
  }
}

function ago(iso, now) {
  const mins = Math.round((now - Date.parse(iso)) / 60000)
  if (!(mins >= 0)) return ''
  if (mins < 60) return mins + 'm ago'
  return mins < 48 * 60 ? Math.round(mins / 60) + 'h ago' : Math.round(mins / 1440) + 'd ago'
}

// m: { on, status, now, missing }
export function memoryLine(m) {
  if (!m.on) return 'Palgu memory: off · /palgu memory on indexes this project into Palgu (uploads its source)'
  if (m.missing) return 'Palgu memory: on, but the palgu CLI is not installed (https://www.palgu.ai/install)'
  if (!m.status) return 'Palgu memory: on · could not read the index status (is `palgu login` done?)'
  if (!m.status.indexed) return 'Palgu memory: on · ' + m.status.project + ' not indexed yet'
  const when = m.status.updated ? ', updated ' + ago(m.status.updated, m.now) : ''
  return 'Palgu memory: on · ' + m.status.project + ' indexed, ' + m.status.symbols + ' symbols' + when
}

// s: { on, signedIn, installed }; last: when this project was last indexed (ms) or undefined.
export function indexDue(s, last, now) {
  if (!s.on || !s.signedIn || !s.installed) return false
  return last === undefined || now - last >= INDEX_EVERY_MS
}

// Consent is per project folder: { '<cwd>': true }. Anything else (the pre-release's single flag
// included) is on nowhere.
export function memoryOn(saved, folder) {
  return Boolean(saved && typeof saved === 'object' && saved[folder] === true)
}

export function setMemory(saved, folder, on) {
  const all = saved && typeof saved === 'object' ? { ...saved } : {}
  if (on) all[folder] = true
  else delete all[folder]
  return all
}
