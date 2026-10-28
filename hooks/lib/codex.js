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

// `codex exec` never asks anyone: it runs with approval policy Never, so the sandbox is the only
// gate. read-only is the default because exec cannot gate writes; workspace-write and
// danger-full-access are explicit opt-ins through router.codex.sandbox.
const SANDBOXES = ['read-only', 'workspace-write', 'danger-full-access']
const NO_NETWORK = ['-c', 'sandbox_workspace_write.network_access=false']
const NEVER = ['-c', 'approval_policy="never"']

export function sandboxOf(codex) {
  return SANDBOXES.includes(codex.sandbox) ? codex.sandbox : 'read-only'
}

function safetyArgs(codex) {
  const mode = sandboxOf(codex)
  return ['--sandbox', mode, ...NEVER, ...(mode === 'workspace-write' ? NO_NETWORK : [])]
}

// router.codex.args may add flags but never set the sandbox, the approval policy, extra writable
// dirs or the git check: those have their own settings. `[kept, dropped]`.
const UNSAFE_FLAGS = new Set(['--dangerously-bypass-approvals-and-sandbox', '--approve-for-me', '--full-auto', '--skip-git-repo-check'])
const UNSAFE_WITH_VALUE = new Set(['-s', '--sandbox', '--add-dir', '-a', '--ask-for-approval'])
const UNSAFE_CONFIG = /^(approval_policy|sandbox_mode|sandbox_workspace_write|sandbox_permissions)\b/
// `--config=k=v` and `-ck=v`, the joined spellings of `-c k=v`.
const JOINED_CONFIG = /^(--config=|-c)(?=.)/

function unsafeSingle(a) {
  const joined = JOINED_CONFIG.test(a) && UNSAFE_CONFIG.test(a.replace(JOINED_CONFIG, ''))
  return joined || UNSAFE_FLAGS.has(a) || /^--(sandbox|add-dir|ask-for-approval)=/.test(a)
}

function splitArgs(args) {
  const kept = [], dropped = []
  for (let i = 0; i < args.length; i += 1) {
    const a = String(args[i]), value = args[i + 1]
    const config = (a === '-c' || a === '--config') && UNSAFE_CONFIG.test(String(value))
    const pair = config || UNSAFE_WITH_VALUE.has(a)
    const bad = pair || unsafeSingle(a)
    ;(bad ? dropped : kept).push(...(pair ? [a, value] : [a]))
    if (pair) i += 1
  }
  return [kept, dropped]
}

export function droppedArgs(codex) {
  return splitArgs(codex.args || [])[1]
}

function gitArgs(codex) {
  return codex.allowOutsideGit ? ['--skip-git-repo-check'] : []
}

function modelArgs(codex, model, where) {
  return [...(model ? ['-m', model] : []), ...(codex.auth === 'chatgpt' ? [] : providerArgs(where.baseUrl))]
}

// The flags after the program name (`codex`, written as fixed text at the $.process.run call).
// No -m means Codex's own default model. `-` reads the brief from stdin.
export function codexArgs(codex, model, where) {
  const extra = splitArgs(codex.args || [])[0]
  return ['exec', '--json', ...gitArgs(codex), '-C', where.cwd, ...modelArgs(codex, model, where), ...safetyArgs(codex), ...extra, '-']
}

// After the user approved refused commands: the same thread, in the project, with edits allowed
// for this turn and the network still off. `exec resume` has no --sandbox or -C of its own.
export function codexResumeArgs(codex, model, where) {
  const widened = ['-c', 'sandbox_mode="workspace-write"', ...NEVER, ...NO_NETWORK]
  return ['exec', '-C', where.cwd, 'resume', '--json', ...gitArgs(codex), ...modelArgs(codex, model, where), ...widened, where.thread, '-']
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

// `codex exec --json` reports neither a command its sandbox blocked nor an escalation it refused:
// neither appears as an item. So Codex is told to name each one on a NEEDS-APPROVAL line, and a
// refused escalation is also counted from the log line Codex writes to stderr.
const NEEDS = /^\s*NEEDS-APPROVAL:\s*(.+?)\s*$/gm
const REJECTED = /reject command/g
const OUTSIDE_GIT = /Not inside a trusted directory/
export const OUTSIDE_GIT_REASON = 'outside a git repo; set router.codex.allowOutsideGit'

export function codexBrief(brief, sandbox) {
  return brief + '\n\nYour sandbox is ' + sandbox + ' and nobody can approve anything during this run. ' +
    'If the sandbox blocks a command you need, do not retry it or work around it: finish what you can, then end your answer with one line per blocked command, exactly:\n' +
    'NEEDS-APPROVAL: <exact command>'
}

function needs(text) {
  const seen = new Set()
  return [...text.matchAll(NEEDS)].map((m) => m[1]).filter((c) => !seen.has(c) && seen.add(c)).map((command) => ({ tool: 'codex', command }))
}

function answerOf(items) {
  const message = items.filter((i) => i.type === 'agent_message').pop()
  return String((message && message.text) || '').replace(NEEDS, '').trim()
}

// Same shape as parseChildOutput, plus `refused` (escalations Codex rejected, from stderr) and
// `reason` (why it would not start). `turns` is 1 plus the tool calls, so vet.js can spot an
// answer that checked nothing.
export function parseCodexOutput(raw, exitCode, stderr) {
  const all = events(raw)
  const items = all.filter((e) => e.type === 'item.completed' && e.item).map((e) => e.item)
  const message = items.filter((i) => i.type === 'agent_message').pop()
  const answer = answerOf(items)
  const failed = all.some((e) => e.type === 'turn.failed' || e.type === 'error')
  const named = exitCode === 0 && !failed ? needs(String((message && message.text) || '')) : []
  // An answer that is only NEEDS-APPROVAL lines is a refusal to relay, not an empty child.
  const ok = exitCode === 0 && !failed && (answer !== '' || named.length > 0)
  const thread = all.find((e) => e.type === 'thread.started')
  const turns = all.length ? 1 + items.filter((i) => TOOL_ITEMS.has(i.type)).length : undefined
  const refused = (String(stderr || '').match(REJECTED) || []).length
  const reason = OUTSIDE_GIT.test(stderr || '') ? OUTSIDE_GIT_REASON : ''
  return { ok, answer: ok ? answer : '', sessionId: ok && thread ? String(thread.thread_id || '') : '', denials: named, refused, reason, turns }
}

// The question for a refused command, and what approving it changes: the rest of the turn runs
// in workspace-write, so Codex may edit files in the project, still with no network.
export function codexAsk(model, commands) {
  return 'Codex child on ' + model + ' was refused by its read-only sandbox: ' + commands.join(' · ') +
    '. Allow and continue resumes it for this turn with permission to edit files in the project and run commands there (no network).'
}

export function codexRelayText(commands) {
  return 'The user approved these, and your sandbox now allows edits in the project (still no network): ' + commands.join(', ') + '. Continue the task from where you stopped and run them.'
}

// Appended to an answer when refused commands were not approved, so the refusal is never silent.
export function refusalNote(commands) {
  return commands.length ? '\n\nCodex\'s sandbox refused, and nothing ran: ' + commands.map((c) => '`' + c + '`').join(', ') + '.' : ''
}

export function missingCodex(errText) {
  return /failed to start|ENOENT|not found/i.test(errText || '')
}
