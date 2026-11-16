// Mixture of Models for OpenCode (ADR 0005): an OpenCode server plugin (V1 API: a default export
// `{ id, server }`). Per prompt it picks the Palgu model (auto, a /route pin, or the tier's route)
// and recalls Palgu memory; on idle it runs the heartbeat; on a new session it indexes memory.
// The decisions are mom's and the mod's (integrations/cli, hooks/lib); this file only wires them.
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { VERSION } from '../../hooks/lib/version.js'
import { heartbeat, memory, status } from '../cli/commands.js'
import { home, loadKey, makeIo, stateEnv } from '../cli/io.js'
import { makeHooks } from './lib/hooks.js'
import { askOllama } from './lib/ollama.js'
import { routingOptions } from './lib/route.js'

// MOM_DEBUG=1: one JSON line per decision and request in ~/.config/mixture-of-models/opencode.log.
// Model ids, pins and sizes only: never the key, a prompt or a recalled block.
function log(entry) {
  if (!process.env.MOM_DEBUG) return
  try {
    mkdirSync(home(), { recursive: true, mode: 0o700 })
    appendFileSync(join(home(), 'opencode.log'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', { mode: 0o600 })
  } catch {
    // logging never breaks a turn
  }
}

async function server(input, options) {
  const directory = input.directory || input.worktree || process.cwd()
  // OpenCode 1.19 can list one plugin twice (the package-directory form under `opencode run`);
  // a second copy for the same folder adds no hooks, or every prompt would be handled twice.
  if (active.has(directory)) return {}
  active.add(directory)
  const opts = routingOptions(options)
  const hooks = makeHooks({
    client: input.client,
    directory,
    options: options || {},
    version: VERSION,
    stateEnv: () => stateEnv(makeIo('opencode', loadKey())),
    classify: (text) => (opts.ollama ? askOllama(text, opts.ollamaModel) : Promise.resolve(undefined)),
    commands: { memory, heartbeat, status },
    log
  })
  return { ...hooks, dispose: async () => { active.delete(directory) } }
}

// The folders this process has a live copy of the plugin for.
const active = new Set()

export default { id: 'mixture-of-models', server }
