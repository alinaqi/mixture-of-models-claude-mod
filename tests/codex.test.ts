import { expect, test } from 'claude-code/testing'
import { DEFAULTS, parseConfig } from '../hooks/lib/config.js'
import { CODEX_INSTALL, codexArgs, codexAsk, codexBaseUrl, codexBrief, codexEnv, codexReady, codexRelayText, codexResumeArgs, droppedArgs, missingCodex, parseCodexOutput } from '../hooks/lib/codex.js'

const CODEX = DEFAULTS.codex
const PALGU = 'https://api.palgu.ai/v1'

test('the codex block defaults to the Palgu gateway, a read-only sandbox, git repos only, and merges', async () => {
  expect(CODEX).toEqual({ auth: 'palgu', baseUrl: '', sandbox: 'read-only', allowOutsideGit: false, args: [] })
  expect(parseConfig('{"router":{"codex":{"auth":"chatgpt"}}}').codex).toEqual({ ...CODEX, auth: 'chatgpt' })
})

test('codexBaseUrl derives Palgu /v1 from the gateway /anthropic URL unless set', async () => {
  expect(codexBaseUrl(CODEX, 'https://api.palgu.ai/anthropic')).toBe(PALGU)
  expect(codexBaseUrl(CODEX, 'https://api.palgu.ai/anthropic/')).toBe(PALGU)
  expect(codexBaseUrl({ ...CODEX, baseUrl: 'https://edge.example/v1' }, 'https://api.palgu.ai/anthropic')).toBe('https://edge.example/v1')
  expect(codexBaseUrl(CODEX, '')).toBe('')
})

test('codexReady: the Palgu path needs a URL and key, the ChatGPT login needs neither', async () => {
  expect(codexReady(CODEX, { baseUrl: 'https://api.palgu.ai/anthropic', key: 'srt_k' })).toBe(true)
  expect(codexReady(CODEX, { baseUrl: 'https://api.palgu.ai/anthropic', key: '' })).toBe(false)
  expect(codexReady(CODEX, { baseUrl: '', key: 'srt_k' })).toBe(false)
  expect(codexReady({ ...CODEX, auth: 'chatgpt' }, { baseUrl: '', key: '' })).toBe(true)
})

test('codexArgs on Palgu: non-interactive exec, JSON events, a palgu provider on /v1/responses, the key by env name only', async () => {
  const args = codexArgs(CODEX, 'glm-5.3', { cwd: '/work', baseUrl: PALGU })
  expect(args).toEqual([
    'exec', '--json', '-C', '/work', '-m', 'glm-5.3',
    '-c', 'model_provider="palgu"',
    '-c', 'model_providers.palgu.name="palgu"',
    '-c', 'model_providers.palgu.base_url="https://api.palgu.ai/v1"',
    '-c', 'model_providers.palgu.env_key="PALGU_API_KEY"',
    '-c', 'model_providers.palgu.wire_api="responses"',
    '--sandbox', 'read-only', '-c', 'approval_policy="never"', '-',
  ])
  expect(args.join(' ')).not.toContain('srt_')
})

test('codexArgs on the ChatGPT login: no provider override, and no -m for the default model', async () => {
  const args = codexArgs({ ...CODEX, auth: 'chatgpt' }, '', { cwd: '/work', baseUrl: PALGU })
  expect(args).toEqual(['exec', '--json', '-C', '/work', '--sandbox', 'read-only', '-c', 'approval_policy="never"', '-'])
})

const CHATGPT = { ...CODEX, auth: 'chatgpt' }
const WHERE = { cwd: '/work', baseUrl: PALGU }

test('codexArgs runs outside a git repo only when router.codex.allowOutsideGit opts in', async () => {
  expect(codexArgs(CHATGPT, '', WHERE)).not.toContain('--skip-git-repo-check')
  expect(codexArgs({ ...CHATGPT, allowOutsideGit: true }, '', WHERE).slice(0, 3)).toEqual(['exec', '--json', '--skip-git-repo-check'])
})

test('workspace-write is an explicit opt-in, and keeps the network off', async () => {
  expect(codexArgs({ ...CHATGPT, sandbox: 'workspace-write' }, '', WHERE)).toEqual([
    'exec', '--json', '-C', '/work', '--sandbox', 'workspace-write', '-c', 'approval_policy="never"', '-c', 'sandbox_workspace_write.network_access=false', '-',
  ])
  expect(codexArgs({ ...CHATGPT, sandbox: 'danger-full-access' }, '', WHERE)).toContain('danger-full-access')
})

test('an unknown sandbox value falls back to read-only', async () => {
  expect(codexArgs({ ...CHATGPT, sandbox: 'yolo' }, '', WHERE)).toContain('read-only')
  expect(codexArgs({ ...CHATGPT, sandbox: 'yolo' }, '', WHERE)).not.toContain('yolo')
})

const UNSAFE = ['--sandbox', 'danger-full-access', '--dangerously-bypass-approvals-and-sandbox', '--approve-for-me', '-c', 'approval_policy="on-request"',
  '--config', 'sandbox_mode="danger-full-access"', '-c', 'sandbox_workspace_write.network_access=true', '--skip-git-repo-check', '--add-dir', '/', '--sandbox=workspace-write', '-s', 'workspace-write', '--full-auto']

test('router.codex.args cannot widen the sandbox or the approval policy: those flags are dropped and listed', async () => {
  const codex = { ...CHATGPT, args: ['--ephemeral', ...UNSAFE, '-c', 'model_reasoning_effort="high"'] }
  const args = codexArgs(codex, '', WHERE)
  expect(args).toEqual(['exec', '--json', '-C', '/work', '--sandbox', 'read-only', '-c', 'approval_policy="never"', '--ephemeral', '-c', 'model_reasoning_effort="high"', '-'])
  expect(droppedArgs(codex)).toEqual(UNSAFE)
  expect(droppedArgs(CODEX)).toEqual([])
})

test('codexResumeArgs resumes the same thread in the project with edits allowed for this turn, network still off', async () => {
  expect(codexResumeArgs(CHATGPT, 'gpt-5.6-terra', { ...WHERE, thread: 'th-1' })).toEqual([
    'exec', '-C', '/work', 'resume', '--json', '-m', 'gpt-5.6-terra',
    '-c', 'sandbox_mode="workspace-write"', '-c', 'approval_policy="never"', '-c', 'sandbox_workspace_write.network_access=false', 'th-1', '-',
  ])
  const palgu = codexResumeArgs({ ...CODEX, allowOutsideGit: true }, '', { ...WHERE, thread: 'th-1' })
  expect(palgu.join(' ')).toContain('--skip-git-repo-check')
  expect(palgu.join(' ')).toContain('model_providers.palgu.base_url="https://api.palgu.ai/v1"')
})

test('codexBrief tells Codex its sandbox and to name each refused command on a NEEDS-APPROVAL line', async () => {
  const brief = codexBrief('the brief', 'read-only')
  expect(brief.startsWith('the brief')).toBe(true)
  expect(brief).toContain('read-only')
  expect(brief).toContain('NEEDS-APPROVAL: <exact command>')
})

test('codexAsk names the commands and says what approving allows; codexRelayText tells Codex to run them', async () => {
  const q = codexAsk('codex/default', ['touch made.txt', 'npm test'])
  expect(q).toContain('touch made.txt · npm test')
  expect(q).toContain('edit files in the project')
  expect(q).toContain('no network')
  expect(codexRelayText(['touch made.txt'])).toContain('touch made.txt')
})

test('codexEnv marks the child and passes the Palgu key in the environment, never for the ChatGPT login', async () => {
  expect(codexEnv(CODEX, 'srt_k')).toEqual({ MAGGY_ROUTER_CHILD: '1', PALGU_API_KEY: 'srt_k' })
  expect(codexEnv({ ...CODEX, auth: 'chatgpt' }, 'srt_k')).toEqual({ MAGGY_ROUTER_CHILD: '1' })
})

// What `codex exec --json` printed in a live run through Palgu (thread id shortened).
const RUN = [
  { type: 'thread.started', thread_id: 'th-1' },
  { type: 'item.completed', item: { id: 'item_0', type: 'error', message: 'Model metadata for `glm-5.3` not found.' } },
  { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: "/bin/zsh -lc 'cat a.txt'", aggregated_output: 'hello\n', exit_code: 0, status: 'completed' } },
  { type: 'item.completed', item: { id: 'item_2', type: 'agent_message', text: 'hello' } },
  { type: 'turn.completed', usage: { input_tokens: 17730, output_tokens: 60 } },
].map((e) => JSON.stringify(e)).join('\n') + '\n'

test('parseCodexOutput reads the last agent message, the thread id and the tool count', async () => {
  expect(parseCodexOutput(RUN, 0)).toEqual({ ok: true, answer: 'hello', sessionId: 'th-1', denials: [], refused: 0, reason: '', turns: 2 })
})

const asked = (text) => [{ type: 'thread.started', thread_id: 'th-2' }, { type: 'item.completed', item: { type: 'agent_message', text } }].map((e) => JSON.stringify(e)).join('\n')

test('parseCodexOutput turns NEEDS-APPROVAL lines into denials, once each, and strips them from the answer', async () => {
  const out = parseCodexOutput(asked('The sandbox is read-only.\nNEEDS-APPROVAL: touch made.txt\nNEEDS-APPROVAL:  npm test \nNEEDS-APPROVAL: touch made.txt'), 0)
  expect(out.denials).toEqual([{ tool: 'codex', command: 'touch made.txt' }, { tool: 'codex', command: 'npm test' }])
  expect(out.answer).toBe('The sandbox is read-only.')
  expect(out.ok).toBe(true)
})

test('parseCodexOutput counts escalations Codex rejected on stderr, which --json does not report', async () => {
  const err = 'ERROR codex_core::tools::router: error=approval policy is Never; reject command — you cannot ask for escalated permissions if the approval policy is Never\n'
  expect(parseCodexOutput(RUN, 0, err + err).refused).toBe(2)
  expect(parseCodexOutput(RUN, 0, '').refused).toBe(0)
})

test('parseCodexOutput says when Codex refused to start outside a git repo', async () => {
  const out = parseCodexOutput('', 1, 'Not inside a trusted directory and --skip-git-repo-check was not specified.\n')
  expect(out.ok).toBe(false)
  expect(out.reason).toBe('outside a git repo; set router.codex.allowOutsideGit')
})

test('parseCodexOutput: no tool calls is one turn, so vetting can spot unverified claims', async () => {
  const lines = [{ type: 'thread.started', thread_id: 't' }, { type: 'item.completed', item: { type: 'agent_message', text: 'I added it.' } }]
  expect(parseCodexOutput(lines.map((l) => JSON.stringify(l)).join('\n'), 0).turns).toBe(1)
})

test('parseCodexOutput treats a failed turn, a non-zero exit, no answer or garbage as a failed child', async () => {
  const failed = RUN + JSON.stringify({ type: 'turn.failed', error: { message: '401' } }) + '\n'
  expect(parseCodexOutput(failed, 0).ok).toBe(false)
  expect(parseCodexOutput(RUN, 1).ok).toBe(false)
  expect(parseCodexOutput(JSON.stringify({ type: 'error', message: 'stream error' }), 0).ok).toBe(false)
  expect(parseCodexOutput('not json at all', 0)).toEqual({ ok: false, answer: '', sessionId: '', denials: [], refused: 0, reason: '', turns: undefined })
})

test('missingCodex spots a binary that could not start, and the hint says how to install it', async () => {
  expect(missingCodex('codex: $.process.run(codex) failed to start: ENOENT: no such file or directory')).toBe(true)
  expect(missingCodex('timed out')).toBe(false)
  expect(CODEX_INSTALL).toMatch(/npm install -g @openai\/codex/)
})

test('an answer that is only NEEDS-APPROVAL lines is still a refusal to relay, not an empty child', async () => {
  const out = parseCodexOutput(asked('NEEDS-APPROVAL: touch made.txt'), 0)
  expect(out.ok).toBe(true)
  expect(out.answer).toBe('')
  expect(out.denials).toEqual([{ tool: 'codex', command: 'touch made.txt' }])
})

test('joined --config=… and -c… forms cannot widen the sandbox either', async () => {
  const joined = ['--config=sandbox_mode="danger-full-access"', '-capproval_policy="on-request"', '--config=model="x"']
  expect(droppedArgs({ ...CODEX, args: joined })).toEqual(joined.slice(0, 2))
})
