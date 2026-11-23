// `mom palgu codex`: continue the exact Codex conversation remembered from its latest mom hook in
// Palgu (`palgu --continue-codex=<id>`). Only the id and folder are kept, never prompts or answers;
// Palgu reads the transcript itself and redacts credentials. In a terminal mom starts Palgu there;
// elsewhere (inside an agent's shell tool) it copies the command, or with --open starts it in a new
// macOS Terminal tab.
import { execFileSync, spawnSync } from 'node:child_process'
import { continueArgs, handoffCommand, handoffText, launchScript } from '../../../hooks/lib/handoff.js'
import { readJson, writeJson } from '../io.js'

const HANDOFFS = { codex: 'codex' }
const USAGE = 'Usage: mom palgu codex [--session <id>] [--open]\nIn Claude Code: /palgu continue [--open]. Other agents: palgu --continue-from <transcript.jsonl>.\n'

export function rememberHandoff(state, event, tool) {
  if (!HANDOFFS[tool] || !event || !event.session || !event.cwd) return state || {}
  const handoffs = { ...((state || {}).handoffs || {}), [tool]: { session: String(event.session), cwd: String(event.cwd) } }
  return { ...(state || {}), handoffs }
}

function flagsOf(rest) {
  const out = { session: '', open: false }
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--open' && !out.open) out.open = true
    else if (rest[i] === '--session' && i + 1 < rest.length && !out.session) out.session = rest[++i]
    else return null
  }
  return out
}

// { code, out | err, command, args, cwd, open }: the handoff for `args`, from the saved hook session
// or an explicit --session (in the current folder).
export function handoffFor(args, env) {
  const [tool, ...rest] = args || []
  const flags = HANDOFFS[tool] ? flagsOf(rest) : null
  if (!flags) return { code: 2, err: USAGE }
  const saved = ((env.state || {}).handoffs || {})[tool] || {}
  const session = flags.session || saved.session || ''
  const cwd = flags.session ? env.cwd || saved.cwd : saved.cwd
  const command = handoffCommand(HANDOFFS[tool], session, cwd)
  if (command.error) return { code: 1, err: command.error + ' Start a turn in ' + tool + ' with its mom hooks, or pass --session <id>.\n' }
  return { code: 0, out: command + '\n', command, args: continueArgs(HANDOFFS[tool], session), cwd, open: flags.open }
}

// Read immediately before writing: another agent's hook may have saved its own session meanwhile.
export function rememberSession(tool, event) {
  if (HANDOFFS[tool]) writeJson('state.json', rememberHandoff(readJson('state.json', {}), event, tool))
}

function launch(r) {
  const run = spawnSync('palgu', r.args, { cwd: r.cwd, stdio: 'inherit' })
  if (run.error) return { code: 1, err: (run.error.code === 'ENOENT' ? 'palgu is not installed or not on PATH.' : 'palgu did not start.') + ' Run this once it is:\n' + r.command + '\n' }
  return { code: run.status === null ? 1 : run.status }
}

function copy(command) {
  try {
    execFileSync('pbcopy', { input: command, stdio: ['pipe', 'ignore', 'ignore'], timeout: 10000 })
    return true
  } catch {
    return false
  }
}

function openTab(command) {
  try {
    execFileSync('osascript', ['-e', launchScript(command)], { stdio: 'ignore', timeout: 10000 })
    return true
  } catch {
    return false
  }
}

function offTerminal(r) {
  const copied = copy(r.command)
  if (r.open && openTab(r.command)) return { code: 0, out: handoffText(r.command, true) + '\n' }
  const lead = r.open ? 'Could not open a Terminal tab (macOS only)' + (copied ? '; the command is on your clipboard' : '') + '. Run this in a terminal:\n' : ''
  if (lead) return { code: 1, err: lead + r.command + '\n' }
  return { code: 0, out: (copied ? handoffText(r.command, false) : 'Run this in a terminal (Palgu needs one of its own):\n' + r.command) + '\n' }
}

export function palgu(args, tty = process.stdin.isTTY && process.stdout.isTTY) {
  const r = handoffFor(args, { state: readJson('state.json', {}), cwd: process.cwd() })
  if (!r.command) return r
  return !r.open && tty ? launch(r) : offTerminal(r)
}
