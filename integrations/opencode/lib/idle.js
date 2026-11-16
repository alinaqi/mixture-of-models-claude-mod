// OpenCode's bus events: a new session indexes a memory-on folder in the background (mom onStart);
// a session going idle after a turn that stopped mid-task gets the heartbeat's continue prompt
// (mom onStop: Palgu's verdict or the local classifier, at most heartbeatMax per prompt).
import { onStart, onStop } from '../../cli/lib/decide.js'
import { step } from '../../cli/lib/session.js'
import { textOf, track } from './runtime.js'

async function started(rt, info) {
  if (!info || !info.id || info.parentID) return
  await step(onStart, { session: info.id, cwd: rt.deps.directory }, rt.deps.stateEnv())
}

// The last answer, if the turn ended with one that was not aborted or failed, and the person's
// last message (its agent and model carry over to the continue prompt).
export function lastTurn(messages) {
  const last = messages[messages.length - 1]
  if (!last || !last.info || last.info.role !== 'assistant' || last.info.error) return null
  const user = [...messages].reverse().find((m) => m.info && m.info.role === 'user')
  return { answer: textOf(last.parts), agent: user && user.info.agent, model: user && user.info.model }
}

async function turnOf(rt, id) {
  const session = await rt.deps.client.session.get({ path: { id } })
  if (!session || !session.data || session.data.parentID) return null
  const res = await rt.deps.client.session.messages({ path: { id } })
  return lastTurn((res && res.data) || [])
}

function continueBody(turn, text) {
  return { ...(turn.agent ? { agent: turn.agent } : {}), ...(turn.model ? { model: turn.model } : {}), parts: [{ type: 'text', text }] }
}

// onStop, unless a message arrived while it ran: then nothing is saved for this session.
function unlessStale(s, gen) {
  return async (ev, state, io) => {
    const r = await onStop(ev, state, io)
    return s.gen === gen ? r : { reason: '', state: {} }
  }
}

async function idled(rt, id) {
  const s = track(rt, id)
  const gen = s.gen
  if (!id || s.turn === 'echo') return
  const turn = await turnOf(rt, id)
  if (!turn || !turn.answer || s.gen !== gen) return
  const r = await step(unlessStale(s, gen), { session: id, cwd: rt.deps.directory, answer: turn.answer }, rt.deps.stateEnv())
  if (!r.reason || s.gen !== gen) return
  s.continuing = r.reason
  rt.deps.log({ session: id, heartbeat: r.reason })
  await rt.deps.client.session.promptAsync({ path: { id }, body: continueBody(turn, r.reason) })
}

export async function onEvent(rt, input) {
  const e = (input && input.event) || {}
  const p = e.properties || {}
  if (e.type === 'session.created') return started(rt, p.info)
  if (e.type === 'session.idle') return idled(rt, p.sessionID)
}
