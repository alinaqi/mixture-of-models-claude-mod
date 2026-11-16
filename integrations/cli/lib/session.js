// mom's state between hook runs: each tool session's last prompt and how many times the heartbeat
// continued it, plus the user's settings. Each hook is a new process, so this lives in a file
// (io.js); these functions only transform it. Pure.

export const DAY_MS = 24 * 60 * 60 * 1000
const HEARTBEAT = ['palgu', 'local', 'off']

export function sessionOf(state, id) {
  return ((state && state.sessions) || {})[id] || null
}

function withSession(state, id, value) {
  return { ...state, sessions: { ...((state && state.sessions) || {}), [id]: value } }
}

// A new prompt from the person: remember it (the heartbeat reads it) and reset the budget. In
// Cursor the heartbeat's continue arrives as a prompt too (`followup_message`); that one is not the
// person's, so it keeps the prompt and the budget.
export function beginPrompt(state, id, prompt, now) {
  const old = sessionOf(state, id)
  if (old && old.followup && String(prompt).trim() === old.followup.trim()) return withSession(state, id, { ...old, followup: '', answer: undefined, at: now })
  return withSession(state, id, { prompt, beats: 0, n: old ? old.n + 1 : 1, at: now })
}

// The agent's last answer, for a tool whose stop event does not carry it (Cursor). The heartbeat
// reads its end only.
export function recordAnswer(state, id, text, now) {
  const s = sessionOf(state, id) || { prompt: '', beats: 0, n: 1 }
  return withSession(state, id, { ...s, answer: String(text || '').slice(-2000), at: now })
}

// The continue mom just sent, so the prompt it comes back as is known (beginPrompt).
export function markFollowup(state, id, reason) {
  const s = sessionOf(state, id)
  return s ? withSession(state, id, { ...s, followup: reason }) : state
}

// One continue for this prompt, if the budget allows it.
export function takeBeat(state, id, max, now) {
  const s = sessionOf(state, id) || { prompt: '', beats: 0, n: 1, at: now }
  if (s.beats >= max) return { ok: false, state }
  return { ok: true, state: withSession(state, id, { ...s, beats: s.beats + 1, at: now }) }
}

export function prune(state, now) {
  const sessions = Object.fromEntries(Object.entries((state && state.sessions) || {}).filter(([, s]) => now - (s.at || 0) < DAY_MS))
  return { ...state, sessions }
}

// { heartbeat: 'palgu'|'local'|'off', heartbeatMax }, defaults for anything missing or invalid.
export function settingsOf(state) {
  const s = (state && state.settings) || {}
  const max = Number(s.heartbeatMax)
  return { heartbeat: HEARTBEAT.includes(s.heartbeat) ? s.heartbeat : 'palgu', heartbeatMax: Number.isInteger(max) && max >= 0 ? max : 3 }
}

function entry(map, key) {
  return map && key in map ? { [key]: map[key] } : {}
}

// A hook run read the state at its start; others may have saved since (another session's
// heartbeat, `mom memory off`). Re-read at the end, only this run's session and folder entries
// are taken from it; consent and settings always stay as they are on disk.
export function mergeState(current, mine, ev) {
  const cur = current || {}
  return {
    ...cur,
    sessions: { ...(cur.sessions || {}), ...entry(mine.sessions, ev.session) },
    projects: { ...(cur.projects || {}), ...entry(mine.projects, ev.cwd) },
    index: { ...(cur.index || {}), ...entry(mine.index, ev.cwd) }
  }
}
