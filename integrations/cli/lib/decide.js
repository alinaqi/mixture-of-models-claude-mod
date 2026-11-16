// What mom does on each hook event, for any tool (ADR 0005): index on session start, recall Palgu
// memory on prompt submit, the heartbeat on stop. The same pure modules as the Claude Code mod
// (hooks/lib); every effect goes through `io` (io.js), so this file only decides.
import { recallBlock, recallQuery } from '../../../hooks/lib/recall.js'
import { continuePrompt, heartbeatBody, localVerdict, palguVerdict } from '../../../hooks/lib/heartbeat.js'
import { indexDue, memoryOn } from '../../../hooks/lib/memory.js'
import { beginPrompt, sessionOf, settingsOf, takeBeat } from './session.js'

async function projectFor(state, cwd, io) {
  const known = (state.projects || {})[cwd]
  if (known) return { project: known, state }
  const project = await io.projectName(cwd).catch(() => '')
  return { project, state: project ? { ...state, projects: { ...(state.projects || {}), [cwd]: project } } : state }
}

export async function onStart(ev, state, io) {
  const on = memoryOn(state.memory, ev.cwd)
  const last = (state.index || {})[ev.cwd]
  if (!indexDue({ on, signedIn: Boolean(io.key), installed: true }, last, io.now)) return { state }
  io.indexInBackground(ev.cwd)
  return { state: { ...state, index: { ...(state.index || {}), [ev.cwd]: io.now } } }
}

export async function onPrompt(ev, state, io) {
  let next = beginPrompt(state, ev.session, ev.prompt, io.now)
  const query = recallQuery(ev.prompt)
  if (!query || !io.key || !memoryOn(next.memory, ev.cwd)) return { context: '', state: next }
  const found = await projectFor(next, ev.cwd, io)
  next = found.state
  if (!found.project) return { context: '', state: next }
  const res = await io.search(found.project, query).catch(() => null)
  return { context: recallBlock(res, found.project), state: next }
}

async function verdict(ev, state, io, mode) {
  const s = sessionOf(state, ev.session) || { n: 1 }
  // Codex does not say whether the turn called tools, so narration is left to Palgu's reading.
  if (mode !== 'palgu' || !io.key) return localVerdict(ev.answer, true)
  const tag = 'mom:' + (io.tool || 'codex') + ':' + ev.session + ':' + s.n
  const res = await io.heartbeat(heartbeatBody(tag, ev.answer)).catch(() => null)
  return palguVerdict(res) || localVerdict(ev.answer, true)
}

export async function onStop(ev, state, io) {
  const settings = settingsOf(state)
  if (settings.heartbeat === 'off') return { reason: '', state }
  const v = await verdict(ev, state, io, settings.heartbeat)
  const reason = continuePrompt(v, (sessionOf(state, ev.session) || {}).prompt)
  if (!reason) return { reason: '', state }
  const beat = takeBeat(state, ev.session, settings.heartbeatMax, io.now)
  return beat.ok ? { reason, state: beat.state } : { reason: '', state }
}
