// The OpenCode hooks (V1 plugin API, `server()` in @opencode-ai/plugin 1.19), built from injected
// effects so tests drive them with a fake OpenCode. Every hook fails open: an error is logged
// (MOM_DEBUG) and OpenCode goes on as if there were no plugin.
import { onCommand, onConfig } from './command.js'
import { onEvent } from './idle.js'
import { makeRuntime } from './runtime.js'
import { onHeaders, onMessage } from './turn.js'

function safe(rt, name, fn) {
  return async (input, output) => {
    try {
      await fn(rt, input, output)
    } catch (err) {
      rt.deps.log({ hook: name, error: String((err && err.message) || err) })
    }
  }
}

// deps: { client, directory, options, version, stateEnv, classify, commands, log } (plugin.js).
export function makeHooks(deps) {
  const rt = makeRuntime(deps)
  return {
    config: safe(rt, 'config', onConfig),
    'chat.message': safe(rt, 'chat.message', onMessage),
    'chat.headers': safe(rt, 'chat.headers', onHeaders),
    'command.execute.before': safe(rt, 'command.execute.before', onCommand),
    event: safe(rt, 'event', onEvent)
  }
}
