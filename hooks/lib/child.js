// The delegate: a headless `claude -p` child on the gateway. Argument vector,
// scoped environment, readiness, env-file parsing and the context brief. Pure.

const MESSAGE_CHARS = 1200

export function childReady(child, key) {
  return Boolean(child.baseUrl && key)
}

export function childEnv(child, key) {
  const env = { MAGGY_ROUTER_CHILD: '1' }
  if (child.baseUrl) Object.assign(env, { ANTHROPIC_BASE_URL: child.baseUrl, ANTHROPIC_API_KEY: key })
  return env
}

// The flags after the program name (`claude`, written as fixed text at the $.process.run call).
// --add-dir keeps the project's CLAUDE.md in reach even when --bare skips auto-discovery.
export function childArgs(child, model, cwd) {
  return ['-p', '--model', model, '--output-format', 'json', '--max-turns', String(child.maxTurns), '--add-dir', cwd, ...child.args]
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
  if (!history.length) return prompt
  return 'Context from the main session:\n' + history.map(describe).join('\n') + '\n\nTask:\n' + prompt
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

// The headless child's JSON: its answer, its session id (for --resume), and every
// command the permission system refused, so the user can be asked for real.
export function parseChildOutput(raw, exitCode) {
  const r = resultOf(raw)
  const answer = String(r.result || '').trim()
  const ok = exitCode === 0 && !r.is_error && answer !== ''
  const seen = new Set()
  const denials = (r.permission_denials || []).map((d) => ({ tool: d.tool_name, command: d.tool_name === 'Bash' ? d.tool_input.command || '' : '' }))
    .filter((d) => !seen.has(d.tool + d.command) && seen.add(d.tool + d.command))
  return { ok, answer: ok ? answer : '', sessionId: ok ? String(r.session_id || '') : '', denials: ok ? denials : [] }
}

export function allowPatterns(denials) {
  return denials.map((d) => (d.tool === 'Bash' ? 'Bash(' + d.command + ')' : d.tool))
}

export function relayText(patterns) {
  return 'The user approved these, and they are now allowed: ' + patterns.join(', ') + '. Continue the task from where you stopped and run them.'
}
