import { expect, test } from 'claude-code/testing'
import { DEFAULTS, parseConfig } from '../hooks/lib/config.js'
import { CODEX_INSTALL, codexArgs, codexBaseUrl, codexEnv, codexReady, missingCodex, parseCodexOutput } from '../hooks/lib/codex.js'

const CODEX = DEFAULTS.codex
const PALGU = 'https://api.palgu.ai/v1'

test('the codex block defaults to the Palgu gateway and a workspace-write sandbox, and merges', async () => {
  expect(CODEX).toEqual({ auth: 'palgu', baseUrl: '', args: ['--sandbox', 'workspace-write'] })
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
    'exec', '--json', '--skip-git-repo-check', '-C', '/work', '-m', 'glm-5.3',
    '-c', 'model_provider="palgu"',
    '-c', 'model_providers.palgu.name="palgu"',
    '-c', 'model_providers.palgu.base_url="https://api.palgu.ai/v1"',
    '-c', 'model_providers.palgu.env_key="PALGU_API_KEY"',
    '-c', 'model_providers.palgu.wire_api="responses"',
    '--sandbox', 'workspace-write', '-',
  ])
  expect(args.join(' ')).not.toContain('srt_')
})

test('codexArgs on the ChatGPT login: no provider override, and no -m for the default model', async () => {
  const args = codexArgs({ ...CODEX, auth: 'chatgpt' }, '', { cwd: '/work', baseUrl: PALGU })
  expect(args).toEqual(['exec', '--json', '--skip-git-repo-check', '-C', '/work', '--sandbox', 'workspace-write', '-'])
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
  expect(parseCodexOutput(RUN, 0)).toEqual({ ok: true, answer: 'hello', sessionId: 'th-1', denials: [], turns: 2 })
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
  expect(parseCodexOutput('not json at all', 0)).toEqual({ ok: false, answer: '', sessionId: '', denials: [], turns: undefined })
})

test('missingCodex spots a binary that could not start, and the hint says how to install it', async () => {
  expect(missingCodex('codex: $.process.run(codex) failed to start: ENOENT: no such file or directory')).toBe(true)
  expect(missingCodex('timed out')).toBe(false)
  expect(CODEX_INSTALL).toMatch(/npm install -g @openai\/codex/)
})
