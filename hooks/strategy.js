// Reads the user's routing strategies from ~/.claude/mixture-of-models/strategies/*.md. A file that
// will not parse is named in the log and skipped; a file named like a built-in replaces it.
import { BUILTIN, STRATEGY_DIR, parseStrategy } from './lib/strategies.js'

export async function loadStrategies($, home) {
  const dir = home + STRATEGY_DIR
  const entries = await $.fs.list(dir).catch(() => [])
  const all = { ...BUILTIN }
  for (const e of entries.filter((x) => x.kind === 'file' && x.name.endsWith('.md'))) {
    const s = parseStrategy(await $.fs.read(dir + '/' + e.name).catch(() => ''), e.name.slice(0, -3))
    if (s.error) $.ui.log('routing strategy ' + e.name + ' skipped: ' + s.error)
    else all[s.name] = s
  }
  return all
}
