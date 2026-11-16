// A user message (`chat.message`): pick the Palgu model for it and recall Palgu memory into its
// system text. Each request (`chat.headers`): the pin, client and project headers, and the key.
import { onPrompt } from '../../cli/lib/decide.js'
import { step } from '../../cli/lib/session.js'
import { fromVerdict, preRoute, routeHeaders } from './route.js'
import { isPalgu, pinOf, textOf, track } from './runtime.js'

const AUTO = 'auto'

async function decide(rt, s, text) {
  const pre = preRoute(text, { pin: pinOf(rt), routes: rt.opts.routes, last: s.model })
  if (!pre.classify) return pre
  return fromVerdict(await rt.deps.classify(text).catch(() => undefined), rt.opts)
}

// The message's model, when the provider's config lists it; the pin header carries it either way.
function useModel(rt, message, model) {
  if (!isPalgu(rt, message.model.providerID)) return
  track(rt, message.sessionID).model = model
  if (rt.known.includes(model)) message.model = { ...message.model, modelID: model }
}

// A person's own pick of a Palgu model (not auto, not one this plugin set) is kept, turn after turn.
async function route(rt, s, message, text) {
  const picked = message.model.modelID
  if (picked !== AUTO && (picked !== s.model || picked === s.manual)) {
    s.manual = picked
    return useModel(rt, message, picked)
  }
  s.manual = ''
  const d = await decide(rt, s, text)
  rt.deps.log({ session: message.sessionID, route: d.model, label: d.label, reason: d.reason })
  useModel(rt, message, d.model)
}

async function recall(rt, message, text) {
  const ev = { session: message.sessionID, cwd: rt.deps.directory, prompt: text }
  const r = await step(onPrompt, ev, rt.deps.stateEnv())
  if (r.context) message.system = [message.system, r.context].filter(Boolean).join('\n\n')
  rt.deps.log({ session: message.sessionID, recall: r.context.length })
}

export async function onMessage(rt, input, output) {
  const message = output.message
  const s = track(rt, message.sessionID)
  const text = textOf(output.parts)
  const continuing = Boolean(s.continuing) && text === s.continuing
  s.gen += 1
  s.continuing = ''
  s.turn = s.echo ? 'echo' : continuing ? 'continue' : 'person'
  s.echo = false
  if (s.turn === 'echo') return useModel(rt, message, AUTO)
  if (s.turn === 'continue') return useModel(rt, message, s.model || message.model.modelID)
  if (isPalgu(rt, message.model.providerID)) await route(rt, s, message, text)
  await recall(rt, message, text)
}

// The key goes only to Palgu: x-api-key on its Anthropic endpoint, a bearer token on the others.
function keyHeader(rt, key) {
  if (!key || !rt.baseURL.startsWith('https://api.palgu.ai/')) return {}
  return rt.baseURL.includes('/anthropic') ? { 'x-api-key': key } : { authorization: 'Bearer ' + key }
}

// OpenCode's own small requests (a session title, a summary) go to Palgu unpinned. Compaction
// keeps the session's model on purpose: it reads the whole conversation, which a cheap tier's
// context window may not hold.
const HELPERS = ['title', 'summary']

export async function onHeaders(rt, input, output) {
  if (!input.model || !isPalgu(rt, input.model.providerID)) return
  const model = HELPERS.includes(input.agent) ? AUTO : track(rt, input.sessionID).model || input.model.id
  const env = rt.deps.stateEnv()
  Object.assign(output.headers, routeHeaders(model, rt.deps.directory, rt.deps.version), keyHeader(rt, env.io.key))
  rt.deps.log({ session: input.sessionID, request: input.model.id, pin: output.headers['x-srooter-pin'] || '' })
}
