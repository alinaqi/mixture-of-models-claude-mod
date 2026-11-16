// A fake OpenCode for the plugin's hooks: its SDK client, chat.message / chat.headers payloads
// and bus events as OpenCode 1.19 sends them (packages/plugin/src/index.ts), and a fake mom io.
import { makeHooks } from '../lib/hooks.js'
import { REASONS } from '../../../hooks/lib/heartbeat.js'

const ok = (body) => ({ ok: true, status: 200, text: JSON.stringify(body) })
const HITS = ok({ project: 'work', indexed: true, hits: [{ kind: 'intent', ref: 'adr:ADR-001', title: 'ADR-001: Delegate routed turns', snippet: '', meta: {} }] })
export const MODELS = { auto: {}, 'claude-opus': {}, 'deepseek-pro': {} }
export const CFG = { provider: { palgu: { options: { baseURL: 'https://api.palgu.ai/anthropic/v1' }, models: MODELS } } }

function fakeIo(calls, verdict) {
  return {
    key: 'k-123456789', now: 1000, tool: 'opencode',
    async projectName() { return 'work' },
    async search(project, q) { calls.push(['search', project, q]); return HITS },
    async heartbeat(body) { calls.push(['heartbeat', body]); return ok(verdict) },
    indexInBackground(cwd) { calls.push(['index', cwd]) }
  }
}

function fakeClient(calls, data) {
  return {
    session: {
      get: async ({ path }) => ({ data: { id: path.id, parentID: data.parentID } }),
      messages: async () => { if (data.fail) throw new Error('down'); return { data: data.messages || [] } },
      promptAsync: async (o) => { calls.push(['prompt', o]); return { data: {} } }
    },
    tui: { showToast: async (o) => { calls.push(['toast', o.body.message]) } }
  }
}

export const PREMATURE = { assessment: 'premature', should_continue: true, reason: REASONS.premature }
export const COMPLETE = { assessment: 'complete', should_continue: false, reason: '' }

export function setup(o = {}) {
  const calls = []
  let disk = o.state || {}
  const deps = {
    client: fakeClient(calls, o),
    directory: '/work',
    options: o.options || {},
    version: '9.9.9',
    stateEnv: () => ({ io: fakeIo(calls, o.verdict || COMPLETE), read: () => disk, write: (s) => { disk = s } }),
    classify: async () => o.classified,
    commands: { memory: async (w) => ({ out: 'Palgu memory: ' + w + '\n' }), heartbeat: (m) => ({ out: 'Heartbeat: ' + m + '\n' }), status: async () => ({ out: 'Palgu: signed in\n' }) },
    log: () => undefined
  }
  const hooks = makeHooks(deps)
  return { hooks, calls, disk: () => disk }
}

function userTurn(text, modelID = 'auto', providerID = 'palgu') {
  const message = { id: 'm1', sessionID: 's1', role: 'user', agent: 'build', model: { providerID, modelID } }
  return [{ sessionID: 's1', agent: 'build', model: { providerID, modelID } }, { message, parts: [{ type: 'text', text }] }]
}

export async function send(hooks, text, modelID, providerID) {
  const [input, output] = userTurn(text, modelID, providerID)
  await hooks['chat.message'](input, output)
  const headers = { headers: {} }
  const used = output.message.model
  await hooks['chat.headers']({ sessionID: 's1', agent: 'build', model: { id: used.modelID, providerID: used.providerID }, provider: { info: { id: used.providerID } }, message: output.message }, headers)
  return { message: output.message, parts: output.parts, headers: headers.headers }
}

export const idle = (hooks) => hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's1' } } })
export const history = (answer, error) => [
  { info: { role: 'user', agent: 'build', model: { providerID: 'palgu', modelID: 'auto' } }, parts: [{ type: 'text', text: 'fix the loader' }] },
  { info: { role: 'assistant', ...(error ? { error } : {}) }, parts: [{ type: 'text', text: answer }] }
]
