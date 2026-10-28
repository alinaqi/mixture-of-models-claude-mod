import { expect, test } from 'claude-code/testing'
import { DEFAULTS } from '../hooks/lib/config.js'
import { CHILD_PREAMBLE, allowPatterns, buildBrief, childArgs, childEnv, childReady, gatewayFrom, parseChildOutput, relayText } from '../hooks/lib/child.js'

const CHILD = { ...DEFAULTS.child, baseUrl: 'https://api.palgu.ai/anthropic' }

test('childArgs are the headless flags for the routed model, with the cwd added for CLAUDE.md', async () => {
  expect(childArgs(CHILD, 'glm-5.3', '/work')).toEqual([
    '-p', '--model', 'glm-5.3', '--output-format', 'json', '--max-turns', '25', '--add-dir', '/work',
    '--bare', '--permission-mode', 'acceptEdits',
  ])
})

test('childArgs honours custom args', async () => {
  const args = childArgs({ ...CHILD, args: ['--dangerously-skip-permissions'] }, 'kimi-k3.1-pro', '/work')
  expect(args).toContain('kimi-k3.1-pro')
  expect(args).toContain('--dangerously-skip-permissions')
  expect(args).not.toContain('--bare')
})

test('childEnv marks the child and scopes the gateway to it', async () => {
  expect(childEnv(CHILD, 'srt_key')).toEqual({
    MAGGY_ROUTER_CHILD: '1',
    ANTHROPIC_BASE_URL: 'https://api.palgu.ai/anthropic',
    ANTHROPIC_API_KEY: 'srt_key',
  })
})

test('childEnv without a base URL only marks the child', async () => {
  expect(childEnv({ ...CHILD, baseUrl: '' }, 'srt_key')).toEqual({ MAGGY_ROUTER_CHILD: '1' })
})

test('childReady needs a base URL plus a key', async () => {
  expect(childReady(CHILD, 'srt_key')).toBe(true)
  expect(childReady(CHILD, '')).toBe(false)
  expect(childReady({ ...CHILD, baseUrl: '' }, 'srt_key')).toBe(false)
})

test('buildBrief hands the child recent context and the task', async () => {
  const messages = [
    { role: 'user', text: 'add a login form', toolUses: [] },
    { role: 'assistant', text: 'Added src/Login.tsx', toolUses: [{ name: 'Write' }, { name: 'Bash' }] },
    { role: 'user', text: 'now add tests for it', toolUses: [] },
  ]
  const brief = buildBrief(messages, 'now add tests for it', 6)
  expect(brief).toContain('user: add a login form')
  expect(brief).toContain('assistant: Added src/Login.tsx [tools: Write, Bash]')
  expect(brief).toMatch(/Task:\nnow add tests for it$/)
  expect(brief.split('user: now add tests for it').length).toBe(1)
})

test('buildBrief with no history is the preamble and the task', async () => {
  expect(buildBrief([], 'grep for TODO', 6)).toBe(CHILD_PREAMBLE + '\n\nTask:\ngrep for TODO')
})

test('the child preamble says it has no session context, must not invent, and hands back with HANDBACK', async () => {
  const brief = buildBrief([{ role: 'user', text: 'hi', toolUses: [] }], 'merge the PR', 6)
  expect(brief.startsWith(CHILD_PREAMBLE)).toBe(true)
  expect(CHILD_PREAMBLE).toMatch(/no access to the main session/i)
  expect(CHILD_PREAMBLE).toMatch(/never invent/i)
  expect(CHILD_PREAMBLE).toMatch(/PR numbers/)
  expect(CHILD_PREAMBLE).toMatch(/^.*HANDBACK/m)
  expect(CHILD_PREAMBLE).toMatch(/never ask the user to approve or run/i)
})

test('buildBrief keeps only the last N messages and truncates long ones', async () => {
  const long = 'x'.repeat(2000)
  const messages = Array.from({ length: 10 }, (_, i) => ({ role: 'user', text: 'm' + i + ' ' + long, toolUses: [] }))
  const brief = buildBrief(messages, 'task', 3)
  expect(brief).not.toContain('m6 ')
  expect(brief).toContain('m7 ')
  expect(brief.length).toBe(brief.length)
  expect(brief.indexOf('x'.repeat(1300))).toBe(-1)
  expect(brief.indexOf('x'.repeat(1100))).not.toBe(-1)
})

test('gatewayFrom takes the URL from the options or the config, and the key from the options only', async () => {
  const child = { ...DEFAULTS.child, baseUrl: 'https://cfg.example/anthropic' }
  expect(gatewayFrom({ gateway_url: 'https://opt.example/anthropic', gateway_key: 'srt_from_options' }, child))
    .toEqual({ baseUrl: 'https://opt.example/anthropic', key: 'srt_from_options' })
  expect(gatewayFrom({ gateway_key: 'srt_from_options' }, child)).toEqual({ baseUrl: 'https://cfg.example/anthropic', key: 'srt_from_options' })
  expect(gatewayFrom({}, child)).toEqual({ baseUrl: 'https://cfg.example/anthropic', key: '' })
  expect(gatewayFrom(undefined, { ...child, baseUrl: '' })).toEqual({ baseUrl: '', key: '' })
})

const RESULT = { type: 'result', subtype: 'success', is_error: false, session_id: 'sid-1', result: 'done\n', permission_denials: [] }

test('parseChildOutput reads the answer, session id and denied commands from headless JSON, object or array', async () => {
  const denied = { ...RESULT, result: 'I need approval', permission_denials: [
    { tool_name: 'Bash', tool_input: { command: 'git pull --ff-only' } },
    { tool_name: 'Bash', tool_input: { command: 'git pull --ff-only', dangerouslyDisableSandbox: true } },
    { tool_name: 'WebFetch', tool_input: { url: 'https://x' } },
  ] }
  expect(parseChildOutput(JSON.stringify(RESULT), 0)).toEqual({ ok: true, answer: 'done', sessionId: 'sid-1', denials: [], turns: undefined })
  expect(parseChildOutput(JSON.stringify({ ...RESULT, num_turns: 3 }), 0).turns).toBe(3)
  expect(parseChildOutput(JSON.stringify([{ type: 'system' }, denied]), 0)).toEqual({
    ok: true, answer: 'I need approval', sessionId: 'sid-1',
    denials: [{ tool: 'Bash', command: 'git pull --ff-only' }, { tool: 'WebFetch', command: '' }], turns: undefined,
  })
})

test('parseChildOutput treats a non-zero exit, an error result or unparsable output as a failed child', async () => {
  expect(parseChildOutput(JSON.stringify(RESULT), 1).ok).toBe(false)
  expect(parseChildOutput(JSON.stringify({ ...RESULT, is_error: true }), 0).ok).toBe(false)
  expect(parseChildOutput('Not logged in', 0)).toEqual({ ok: false, answer: '', sessionId: '', denials: [], turns: undefined })
  expect(parseChildOutput(JSON.stringify({ ...RESULT, result: '   ' }), 0).ok).toBe(false)
})

test('allowPatterns turns denials into Claude Code permission patterns, exact for Bash', async () => {
  expect(allowPatterns([{ tool: 'Bash', command: 'git pull --ff-only' }, { tool: 'WebFetch', command: '' }, { tool: 'Bash', command: 'npm test' }]))
    .toEqual(['Bash(git pull --ff-only)', 'WebFetch', 'Bash(npm test)'])
})

test('relayText tells the resumed child what is now allowed', async () => {
  const text = relayText(['Bash(git pull --ff-only)'])
  expect(text).toContain('git pull --ff-only')
  expect(text).toMatch(/now allowed/)
  expect(text).toMatch(/continue/i)
})
