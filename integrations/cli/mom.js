#!/usr/bin/env node
// mom: Mixture of Models for coding agents other than Claude Code (ADR 0005).
import { runHook } from './hook.js'
import { runMcp } from './mcp.js'
import { heartbeat, login, logout, memory, setup, status, token } from './commands.js'

const HELP = `mom — Mixture of Models for Codex, Cursor, OpenCode and other coding agents

  mom login                 sign in to Palgu (device code in the browser)
  mom logout                forget the key
  mom status                who is signed in, heartbeat, Palgu memory here
  mom memory on|off|status  Palgu memory for this project folder (on uploads its source to Palgu)
  mom heartbeat palgu|local|off   continue a turn that stopped mid-task (default palgu)
  mom setup codex [--write] Codex profile for Palgu (codex -p palgu)
  mom setup cursor [--write]  this project's .cursor/hooks.json and .cursor/mcp.json
  mom setup opencode [--write]    Palgu provider and the plugin in opencode.json (backed up first)
  mom token                 print the Palgu key, for a tool's token command
  mom hook <tool> [event]   run as a tool's hook (stdin: the tool's hook JSON)
  mom mcp [tool]            MCP server on stdio: Palgu memory search, delegation, model list
`

const COMMANDS = {
  login: () => login(),
  logout: () => logout(),
  token: () => token(),
  status: () => status(process.cwd()),
  memory: (a) => memory(a[0] || 'status', process.cwd()),
  heartbeat: (a) => heartbeat(a[0]),
  setup: (a) => setup(a[0], a.includes('--write'))
}

async function main(argv) {
  const [name, ...rest] = argv
  if (name === 'hook') return runHook(rest[0], rest[1])
  if (name === 'mcp') return runMcp(rest[0])
  if (!name || name === 'help' || name === '--help') return process.stdout.write(HELP)
  if (!COMMANDS[name]) {
    process.stdout.write(HELP)
    process.exitCode = 2
    return
  }
  const r = await COMMANDS[name](rest)
  if (r.out) process.stdout.write(r.out)
  if (r.err) process.stderr.write(r.err)
  process.exitCode = r.code
}

main(process.argv.slice(2))
