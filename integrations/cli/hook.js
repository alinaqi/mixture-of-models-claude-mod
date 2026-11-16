// `mom hook <tool>`: one hook run. Reads the tool's JSON on stdin, decides (lib/decide.js), saves
// the state, prints the answer in the tool's shape. It fails open: any error prints nothing and
// exits 0, so a broken mom never blocks a prompt or a stop.
import { parseEvent, render } from './lib/events.js'
import { onAnswer, onPrompt, onStart, onStop } from './lib/decide.js'
import { step } from './lib/session.js'
import { loadKey, makeIo, stateEnv } from './io.js'

const HANDLERS = { start: onStart, prompt: onPrompt, answer: onAnswer, stop: onStop }

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

export async function runHook(tool) {
  try {
    const ev = parseEvent(tool, await readStdin())
    if (!ev) return
    const result = await step(HANDLERS[ev.kind], ev, stateEnv(makeIo(tool, loadKey())))
    const out = render(tool, ev.kind, result)
    if (out) process.stdout.write(out)
  } catch (err) {
    if (process.env.MOM_DEBUG) process.stderr.write('mom hook: ' + (err && err.message) + '\n')
  }
}
