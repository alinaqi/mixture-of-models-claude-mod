// What the plugin keeps while OpenCode runs: the routing options, the provider's models and base URL
// (from the config hook), and per session the model it chose and what kind of turn is in flight.
// The pin and everything the heartbeat and memory need live in mom's state file (stateEnv).
import { routingOptions } from './route.js'

export function makeRuntime(deps) {
  return { deps, opts: routingOptions(deps.options), known: [], baseURL: '', sessions: new Map() }
}

// { model, turn: 'person'|'continue'|'echo', continuing, echo }
export function track(rt, id) {
  if (!rt.sessions.has(id)) rt.sessions.set(id, { model: '', turn: '', continuing: '', echo: false })
  return rt.sessions.get(id)
}

export function isPalgu(rt, providerID) {
  return Boolean(providerID) && providerID === rt.opts.provider
}

export function readState(rt) {
  return rt.deps.stateEnv().read() || {}
}

// The /route pin, shared by every OpenCode session on the machine (like the mod's).
export function pinOf(rt) {
  return (readState(rt).opencode || {}).pin || 'auto'
}

export function savePin(rt, pin) {
  const env = rt.deps.stateEnv()
  const state = env.read() || {}
  env.write({ ...state, opencode: { ...(state.opencode || {}), pin } })
}

// The person's words in a message: text parts OpenCode did not add itself.
export function textOf(parts) {
  return (parts || []).filter((p) => p && p.type === 'text' && !p.synthetic && !p.ignored).map((p) => p.text).join('\n').trim()
}
