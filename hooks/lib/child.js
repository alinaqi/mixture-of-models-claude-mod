// The delegate: a headless `claude -p` child on the gateway. Argument vector,
// scoped environment, readiness, env-file parsing and the context brief. Pure.

const MESSAGE_CHARS = 600

export function expandHome(path, home) {
  return path.startsWith('~/') ? home + path.slice(1) : path
}

export function parseEnvFile(text) {
  const out = {}
  for (const line of (text || '').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)=["']?([^"'\n]*?)["']?\s*$/)
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2]
  }
  return out
}

// A custom launcher is trusted to bring its own auth; plain `claude` needs the gateway and a key.
export function childReady(child, key) {
  if (child.command[0] !== 'claude') return true
  return Boolean(child.baseUrl && key)
}

export function childEnv(child, key) {
  const env = { MAGGY_ROUTER_CHILD: '1' }
  if (child.baseUrl) Object.assign(env, { ANTHROPIC_BASE_URL: child.baseUrl, ANTHROPIC_API_KEY: key })
  return env
}

// --add-dir keeps the project's CLAUDE.md in reach even when --bare skips auto-discovery.
export function childArgv(child, model, cwd) {
  return [...child.command, '-p', '--model', model, '--output-format', 'text', '--max-turns', String(child.maxTurns), '--add-dir', cwd, ...child.args]
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

// Where the child's gateway comes from, in order: the plugin's userConfig (masked, secure
// storage), then model-config's child.baseUrl, then an env file only when keyFile names one.
export function gatewayFrom(options, child, fileEnv) {
  const o = options || {}
  return { baseUrl: o.gateway_url || child.baseUrl || '', key: o.gateway_key || fileEnv[child.keyVar] || '' }
}
