import { expect, test } from 'claude-code/testing'
import { DEFAULTS } from '../hooks/lib/config.js'
import { buildBrief, childArgv, childEnv, childReady, gatewayFrom } from '../hooks/lib/child.js'

const CHILD = { ...DEFAULTS.child, baseUrl: 'https://api.palgu.ai/anthropic' }

test('childArgv runs a bare headless claude on the routed model, with the cwd added for CLAUDE.md', async () => {
  expect(childArgv(CHILD, 'glm-5.3', '/work')).toEqual([
    'claude', '-p', '--model', 'glm-5.3', '--output-format', 'text', '--max-turns', '25', '--add-dir', '/work',
    '--bare', '--permission-mode', 'acceptEdits',
  ])
})

test('childArgv honours a custom launcher command and custom args', async () => {
  const argv = childArgv({ ...CHILD, command: ['claude-palgu'], args: [] }, 'kimi-k3', '/work')
  expect(argv[0]).toBe('claude-palgu')
  expect(argv).toContain('kimi-k3')
  expect(argv).not.toContain('--bare')
  expect(argv).not.toContain('--permission-mode')
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

test('childReady needs a base URL plus key, or a custom launcher', async () => {
  expect(childReady(CHILD, 'srt_key')).toBe(true)
  expect(childReady(CHILD, '')).toBe(false)
  expect(childReady({ ...CHILD, baseUrl: '' }, 'srt_key')).toBe(false)
  expect(childReady({ ...CHILD, baseUrl: '', command: ['claude-palgu'] }, '')).toBe(true)
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

test('buildBrief with no history is just the task', async () => {
  expect(buildBrief([], 'grep for TODO', 6)).toBe('grep for TODO')
})

test('buildBrief keeps only the last N messages and truncates long ones', async () => {
  const long = 'x'.repeat(2000)
  const messages = Array.from({ length: 10 }, (_, i) => ({ role: 'user', text: 'm' + i + ' ' + long, toolUses: [] }))
  const brief = buildBrief(messages, 'task', 3)
  expect(brief).not.toContain('m6 ')
  expect(brief).toContain('m7 ')
  expect(brief.length).toBe(brief.length)
  expect(brief.indexOf('x'.repeat(700))).toBe(-1)
})

test('gatewayFrom takes the URL from the options or the config, and the key from the options only', async () => {
  const child = { ...DEFAULTS.child, baseUrl: 'https://cfg.example/anthropic' }
  expect(gatewayFrom({ gateway_url: 'https://opt.example/anthropic', gateway_key: 'srt_from_options' }, child))
    .toEqual({ baseUrl: 'https://opt.example/anthropic', key: 'srt_from_options' })
  expect(gatewayFrom({ gateway_key: 'srt_from_options' }, child)).toEqual({ baseUrl: 'https://cfg.example/anthropic', key: 'srt_from_options' })
  expect(gatewayFrom({}, child)).toEqual({ baseUrl: 'https://cfg.example/anthropic', key: '' })
  expect(gatewayFrom(undefined, { ...child, baseUrl: '' })).toEqual({ baseUrl: '', key: '' })
})
