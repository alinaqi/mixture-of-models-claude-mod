// Hand off the current coding-agent session to Palgu's own transcript reader. The mod never
// rebuilds or sends a summary: only a checked session id and a shell command the user can inspect.
// An absent or malformed id is refused; silently continuing the newest session could select a
// different conversation in the same project. Pure.

const AGENTS = { claude: '--continue-claude=', codex: '--continue-codex=' }
const NAMES = { claude: 'Claude Code', codex: 'Codex' }
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isSessionId(id) {
  const value = String(id || '')
  // "latest" is deliberately not an id: Palgu's no-id form would pick a different conversation.
  return ID.test(value) && !['.', '..', 'latest', 'last', 'newest'].includes(value.toLowerCase())
}

export function continueArgs(agent, id) {
  const flag = AGENTS[agent]
  if (!flag) return { error: 'No Palgu handoff for ' + String(agent || 'this agent') + ' yet.' }
  if (!String(id || '').trim()) return { error: NAMES[agent] + ' did not provide this session\'s id; cannot select the exact session.' }
  if (!isSessionId(id)) return { error: 'Invalid ' + NAMES[agent] + ' session id; cannot select the exact session.' }
  return [flag + id]
}

// POSIX sh single-quote escaping. This command is displayed and copied, and optionally run by the
// macOS Terminal; a cwd containing spaces, quotes or metacharacters must remain one path argument.
export function shellQuote(value) {
  return "'" + String(value || '').replace(/'/g, "'\\''") + "'"
}

const pathArg = (cwd) => /^[A-Za-z0-9_./-]+$/.test(cwd) && !cwd.includes('..') ? cwd : shellQuote(cwd)

export function handoffCommand(agent, id, cwd) {
  const args = continueArgs(agent, id)
  if (args.error) return args
  return 'cd ' + pathArg(String(cwd || '').trim()) + ' && palgu ' + args[0]
}

export function parseContinue(args) {
  const words = String(args || '').trim().split(/\s+/).filter(Boolean)
  if (words[0] !== 'continue') return null
  if (words.length > 2 || (words.length === 2 && words[1] !== '--open')) return { error: 'Usage: /palgu continue [--open]' }
  return { open: words[1] === '--open' }
}

export function handoffText(command, opening) {
  return (opening ? 'Opening a new Terminal tab for Palgu. ' : 'Command copied to your clipboard. ') +
    'It hands Palgu this exact session; Palgu reads its transcript and redacts credentials.\n' + command
}

// AppleScript is fixed code. JSON string escaping handles quotes, backslashes and control characters
// in the one data value (the shell command); no part of it becomes AppleScript source.
export function launchScript(command) {
  return 'tell application "Terminal" to activate\ntell application "Terminal" to do script ' + JSON.stringify(command)
}
