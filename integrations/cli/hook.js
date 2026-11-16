// `mom hook <tool>`: one hook run. Reads the tool's JSON on stdin, decides (lib/decide.js), saves
// the state, prints the answer in the tool's shape. It fails open: any error prints nothing and
// exits 0, so a broken mom never blocks a prompt or a stop.
import { parseEvent, render } from './lib/events.js'
import { onPrompt, onStart, onStop } from './lib/decide.js'
import { mergeState, prune } from './lib/session.js'
import { loadKey, makeIo, readJson, writeJson } from './io.js'

const HANDLERS = { start: onStart, prompt: onPrompt, stop: onStop }

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

export async function runHook(tool) {
  try {
    const ev = parseEvent(tool, await readStdin())
    if (!ev) return
    const io = makeIo(tool, loadKey())
    const result = await HANDLERS[ev.kind](ev, readJson('state.json', {}) || {}, io)
    writeJson('state.json', prune(mergeState(readJson('state.json', {}), result.state, ev), io.now))
    const out = render(tool, ev.kind, result)
    if (out) process.stdout.write(out)
  } catch (err) {
    if (process.env.MOM_DEBUG) process.stderr.write('mom hook: ' + (err && err.message) + '\n')
  }
}
