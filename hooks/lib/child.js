// The delegate: a headless `claude -p` child on the gateway. Argument vector,
// scoped environment, readiness, env-file parsing and the context brief. Pure.

import { VERSION } from './version.js'
import { usageOf } from './savings.js'

const MESSAGE_CHARS = 1200

// Read first by every child: what it cannot see, what it must not invent, how to hand back.
export const CHILD_PREAMBLE = [
  'You are a delegate in a separate headless process. You have no access to the main session: not its full conversation, teammates, background tasks, PRs, branches or tools.',
  'Never invent statuses, IDs, PR numbers, run results, commit counts or file changes. Report only what your own tool calls in this run showed or did.',
  'Never ask the user to approve or run anything, and do not narrate what you would do: do it with your tools, or hand back.',
  'If the task needs the main session\'s state or tools, reply with HANDBACK on the first line and one line saying why.',
].join('\n')

export function childReady(child, key) {
  return Boolean(child.baseUrl && key)
}

// The key goes in exactly one variable and the other is blanked, because the child inherits the
// parent's environment and Claude Code sends both when both are set: an ANTHROPIC_API_KEY from
// your shell would reach OpenRouter as x-api-key, a stray ANTHROPIC_AUTH_TOKEN Palgu as a bearer.
// ANTHROPIC_AUTH_TOKEN is sent as `Authorization: Bearer`, under --bare too (checked on 2.1.312).
function authEnv(child, key) {
  if (child.auth === 'bearer') return { ANTHROPIC_AUTH_TOKEN: key, ANTHROPIC_API_KEY: '' }
  return { ANTHROPIC_API_KEY: key, ANTHROPIC_AUTH_TOKEN: '' }
}

// The headers ride in the same branch as the base URL, so they only ever reach the gateway.
export function childEnv(child, key, headers) {
  const env = { MAGGY_ROUTER_CHILD: '1' }
  if (child.baseUrl) Object.assign(env, { ANTHROPIC_BASE_URL: child.baseUrl }, authEnv(child, key))
  if (child.baseUrl && headers) env.ANTHROPIC_CUSTOM_HEADERS = headers
  return env
}

// The cwd's folder name, slugged like the gateway's project_detect: runs outside [A-Za-z0-9._-]
// become '-', edges lose '-._', at most 64, lowercase. '' when nothing usable is left.
export function projectSlug(cwd) {
  const name = String(cwd || '').split(/[\\/]/).filter(Boolean).pop() || ''
  const slug = name.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-._]+|[-._]+$/g, '')
  return slug.slice(0, 64).toLowerCase()
}

// ANTHROPIC_CUSTOM_HEADERS for the child: the user's own lines first, then who the child is and
// which project it works in, each only if the user has not set that header already. Only Palgu
// (and generic gateways, as before) get ours: `identify` false keeps them from OpenRouter or LiteLLM.
export function childHeaders(cwd, theirs, identify = true) {
  const lines = String(theirs || '').split('\n').map((l) => l.trim()).filter(Boolean)
  if (!identify) return lines.join('\n')
  const has = (name) => lines.some((l) => l.toLowerCase().startsWith(name + ':'))
  const project = projectSlug(cwd)
  const ours = [['x-srooter-client', 'mixture-of-models/' + VERSION]]
  if (project && !project.includes('..')) ours.push(['x-srooter-project', project])
  for (const [name, value] of ours) if (!has(name)) lines.push(name + ': ' + value)
  return lines.join('\n')
}

// A Claude-family member runs on the user's own Claude login. An inherited gateway URL is cleared
// (empty counts as unset); ANTHROPIC_API_KEY is left alone, because an empty one counts as a key.
export function subscriptionEnv() {
  return { MAGGY_ROUTER_CHILD: '1', ANTHROPIC_BASE_URL: '' }
}

// Secrets the child may never read. --bare skips your hooks, so a hook guarding .env does not
// run in the child; these are Claude Code permission rules, which --bare keeps. Read rules also
// cover Grep and Glob. router.child.deny adds rules; nothing removes these.
export const SECRET_DENY = [
  'Read(**/.env)', 'Read(**/.env.*)', 'Read(**/*.pem)', 'Read(**/*.key)',
  'Read(**/id_rsa*)', 'Read(**/id_ed25519*)', 'Read(**/secrets/**)',
]

// The flags after the program name (`claude`, written as fixed text at the $.process.run call).
// --add-dir keeps the project's CLAUDE.md in reach even when --bare skips auto-discovery. The
// deny list comes after child.args, so custom args cannot drop it.
export function childArgs(child, model, cwd) {
  const deny = [...SECRET_DENY, ...(child.deny || [])]
  return ['-p', '--model', model, '--output-format', 'json', '--max-turns', String(child.maxTurns), '--add-dir', cwd, ...child.args, '--disallowedTools', ...deny]
}

function describe(m) {
  const text = m.text.length > MESSAGE_CHARS ? m.text.slice(0, MESSAGE_CHARS) + '…' : m.text
  const tools = (m.toolUses || []).map((t) => t.name)
  return m.role + ': ' + text + (tools.length ? ' [tools: ' + tools.join(', ') + ']' : '')
}

// What the child reads on stdin: the last few exchanges of the main session, then the task.
export function buildBrief(messages, prompt, limit) {
  let history = messages.filter((m) => m.text)
  const last = history[history.length - 1]
  if (last && last.role === 'user' && last.text === prompt) history = history.slice(0, -1)
  history = history.slice(-limit)
  const context = history.length ? '\n\nContext from the main session:\n' + history.map(describe).join('\n') : ''
  return CHILD_PREAMBLE + context + '\n\nTask:\n' + prompt
}

// Where the child's gateway comes from: the URL from the plugin's options or model-config,
// the key from the plugin's options only (masked, secure storage). Nothing is read from disk for it.
export function gatewayFrom(options, child) {
  const o = options || {}
  return { baseUrl: o.gateway_url || child.baseUrl || '', key: o.gateway_key || '' }
}

function resultOf(raw) {
  try {
    const d = JSON.parse(raw)
    const items = Array.isArray(d) ? d : [d]
    return items.find((x) => x && x.type === 'result') || items[items.length - 1] || {}
  } catch {
    return {}
  }
}

// The headless child's JSON: its answer, its session id (for --resume), every command the
// permission system refused (so the user can be asked for real), and its turn count
// (1 means it called no tools, which vet.js uses to spot unverified claims).
export function parseChildOutput(raw, exitCode) {
  const r = resultOf(raw)
  const answer = String(r.result || '').trim()
  const ok = exitCode === 0 && !r.is_error && answer !== ''
  const seen = new Set()
  const denials = (r.permission_denials || []).map((d) => ({ tool: d.tool_name, command: d.tool_name === 'Bash' ? d.tool_input.command || '' : '' }))
    .filter((d) => !seen.has(d.tool + d.command) && seen.add(d.tool + d.command))
  const turns = typeof r.num_turns === 'number' ? r.num_turns : undefined
  return { ok, answer: ok ? answer : '', sessionId: ok ? String(r.session_id || '') : '', denials: ok ? denials : [], turns, usage: usageOf(r.usage) }
}

export function allowPatterns(denials) {
  return denials.map((d) => (d.tool === 'Bash' ? 'Bash(' + d.command + ')' : d.tool))
}

export function relayText(patterns) {
  return 'The user approved these, and they are now allowed: ' + patterns.join(', ') + '. Continue the task from where you stopped and run them.'
}
