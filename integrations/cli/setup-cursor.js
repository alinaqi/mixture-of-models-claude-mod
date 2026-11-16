// `mom setup cursor [--write]`: the project's .cursor/hooks.json and .cursor/mcp.json with mom's
// entries merged in, printed, or written with a .bak of a file that changes. For people who do not
// install the Cursor plugin.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cursorHooks, cursorMcp, mergeHooks, mergeMcp } from './lib/cursor-setup.js'

const FILES = [
  { name: 'hooks.json', merge: (cur) => mergeHooks(cur, cursorHooks()) },
  { name: 'mcp.json', merge: (cur) => mergeMcp(cur, cursorMcp(true)) }
]

// The file's JSON, null when there is none; throws on a file that is not JSON (it is never overwritten).
function current(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error(path + ' is not valid JSON: fix it, or add mom\'s entries by hand (mom setup cursor prints them)')
  }
}

function plan(cwd) {
  return FILES.map((f) => {
    const path = join(cwd, '.cursor', f.name)
    const before = existsSync(path) ? readFileSync(path, 'utf8') : null
    return { path, before, after: JSON.stringify(f.merge(current(path)), null, 2) + '\n' }
  })
}

function write(p) {
  if (p.before === p.after) return p.path + ' (unchanged)'
  if (p.before !== null) copyFileSync(p.path, p.path + '.bak')
  writeFileSync(p.path, p.after)
  return p.path + (p.before !== null ? ' (backup: ' + p.path + '.bak)' : '')
}

export function setupCursor(cwd, doWrite) {
  let plans
  try {
    plans = plan(cwd)
  } catch (err) {
    return { code: 1, err: err.message + '\n' }
  }
  if (!doWrite) return { code: 0, out: plans.map((p) => '# ' + p.path + '\n' + p.after).join('\n') + '\n# Write them with: mom setup cursor --write\n' }
  mkdirSync(join(cwd, '.cursor'), { recursive: true })
  const lines = plans.map(write)
  return { code: 0, out: 'Wrote ' + lines.join('\nWrote ') + '\nReload Cursor (Developer: Reload Window) to load the hooks and the MCP server.\n' }
}
