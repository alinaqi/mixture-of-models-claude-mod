// The Codex delegate: a non-interactive `codex exec` child. Argument vector, scoped
// environment, readiness and its JSONL output. Pure.

export const CODEX_INSTALL = 'codex is not installed: npm install -g @openai/codex (or brew install --cask codex), then codex login or a Palgu gateway key'

// The key's variable name in the child's environment; the key itself never goes on argv.
const KEY_ENV = 'PALGU_API_KEY'
const TOOL_ITEMS = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'web_search'])

// Palgu serves the Responses API under /v1, next to /anthropic.
export function codexBaseUrl(codex, gatewayUrl) {
  return codex.baseUrl || (gatewayUrl || '').replace(/\/anthropic\/?$/, '/v1')
}

export function codexReady(codex, gateway) {
  return codex.auth === 'chatgpt' || Boolean(codexBaseUrl(codex, gateway.baseUrl) && gateway.key)
}

// Palgu as an explicit provider: Codex ignores OPENAI_BASE_URL under a ChatGPT login.
function providerArgs(baseUrl) {
  const set = (k, v) => ['-c', k + '=' + JSON.stringify(v)]
  return [
    ...set('model_provider', 'palgu'), ...set('model_providers.palgu.name', 'palgu'),
    ...set('model_providers.palgu.base_url', baseUrl), ...set('model_providers.palgu.env_key', KEY_ENV),
    ...set('model_providers.palgu.wire_api', 'responses'),
  ]
}

// The flags after the program name (`codex`, written as fixed text at the $.process.run call).
// No -m means Codex's own default model. `-` reads the brief from stdin.
export function codexArgs(codex, model, where) {
  const provider = codex.auth === 'chatgpt' ? [] : providerArgs(where.baseUrl)
  return ['exec', '--json', '--skip-git-repo-check', '-C', where.cwd, ...(model ? ['-m', model] : []), ...provider, ...codex.args, '-']
}

export function codexEnv(codex, key) {
  const env = { MAGGY_ROUTER_CHILD: '1' }
  if (codex.auth !== 'chatgpt') env[KEY_ENV] = key
  return env
}

function events(raw) {
  return (raw || '').split('\n').map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return undefined
    }
  }).filter((e) => e && typeof e === 'object')
}

// Same shape as parseChildOutput. Codex has no permission-denial report (its sandbox makes a
// refused command fail inside the run), so denials is always empty and nothing is relayed.
// `turns` is 1 plus the tool calls, so vet.js can spot an answer that checked nothing.
export function parseCodexOutput(raw, exitCode) {
  const all = events(raw)
  const items = all.filter((e) => e.type === 'item.completed' && e.item).map((e) => e.item)
  const message = items.filter((i) => i.type === 'agent_message').pop()
  const answer = String((message && message.text) || '').trim()
  const failed = all.some((e) => e.type === 'turn.failed' || e.type === 'error')
  const ok = exitCode === 0 && !failed && answer !== ''
  const thread = all.find((e) => e.type === 'thread.started')
  const turns = all.length ? 1 + items.filter((i) => TOOL_ITEMS.has(i.type)).length : undefined
  return { ok, answer: ok ? answer : '', sessionId: ok && thread ? String(thread.thread_id || '') : '', denials: [], turns }
}

export function missingCodex(errText) {
  return /failed to start|ENOENT|not found/i.test(errText || '')
}
