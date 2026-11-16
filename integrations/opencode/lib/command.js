// /route and /palgu. The config hook registers them as OpenCode commands; `command.execute.before`
// does the work in the plugin and swaps the command's prompt for a one-line echo of the result, so
// the model (Palgu's cheapest tier, `auto`) only repeats it. A TUI toast shows the same line.
import { PALGU_MODELS } from '../../../hooks/lib/providers.js'
import { knownModels, routeArg } from './route.js'
import { pinOf, savePin, track } from './runtime.js'

const COMMANDS = {
  route: { description: 'Mixture of Models: /route auto | <model> | status', template: 'Mixture of Models /route $ARGUMENTS' },
  palgu: { description: 'Mixture of Models: /palgu memory on|off|status, heartbeat palgu|local|off, status', template: 'Mixture of Models /palgu $ARGUMENTS' }
}
const PALGU_USAGE = 'Usage: /palgu memory on|off|status · /palgu heartbeat palgu|local|off · /palgu status'

export async function onConfig(rt, cfg) {
  if (!cfg || typeof cfg !== 'object') return
  rt.known = knownModels(cfg, rt.opts.provider)
  const provider = (cfg.provider || {})[rt.opts.provider] || {}
  rt.baseURL = String((provider.options || {}).baseURL || '')
  const theirs = cfg.command || {}
  rt.owned = new Set(Object.keys(COMMANDS).filter((name) => !(name in theirs)))
  cfg.command = { ...structuredClone(COMMANDS), ...theirs }
}

function routeStatus(rt) {
  const pin = pinOf(rt)
  const head = pin === 'auto' ? 'Route: auto (Palgu picks the model for each request)' : 'Route: ' + pin + ' (pinned; /route auto lets Palgu pick)'
  const tiers = Object.entries(rt.opts.routes).map(([k, v]) => k + ' → ' + v)
  return tiers.length ? head + ' · ' + tiers.join(', ') : head
}

function route(rt, arg) {
  const a = routeArg(arg, rt.known.length ? rt.known : ['auto', ...PALGU_MODELS])
  if (a.kind === 'error') return a.text
  if (a.kind === 'pin') savePin(rt, a.model)
  return routeStatus(rt)
}

const said = (r) => String((r && (r.out || r.err)) || '').trim()

async function palgu(rt, arg) {
  const [a, b] = String(arg || '').trim().split(/\s+/)
  const run = rt.deps.commands
  if (a === 'memory' && (!b || ['on', 'off', 'status'].includes(b))) return said(await run.memory(b || 'status', rt.deps.directory))
  if (a === 'heartbeat' && b) return said(await run.heartbeat(b))
  if (!a || a === 'status') return said(await run.status(rt.deps.directory))
  return PALGU_USAGE
}

const HANDLERS = { route, palgu }

export function echoText(line) {
  return 'A Mixture of Models command already ran. Reply with exactly the text between the lines, unchanged, and nothing else.\n---\n' + line + '\n---'
}

export async function onCommand(rt, input, output) {
  const run = rt.owned.has(input.command) && HANDLERS[input.command]
  if (!run || !output || !Array.isArray(output.parts)) return
  const line = (await run(rt, input.arguments || '')) || PALGU_USAGE
  track(rt, input.sessionID).echo = true
  output.parts.splice(0, output.parts.length, { type: 'text', text: echoText(line) })
  rt.deps.log({ session: input.sessionID, command: input.command, result: line })
  Promise.resolve(rt.deps.client.tui.showToast({ body: { title: 'Mixture of Models', message: line, variant: 'info' } })).catch(() => undefined)
}
