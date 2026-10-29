import { expect, test } from 'claude-code/testing'
import { DEFAULTS } from '../hooks/lib/config.js'
import { CHILD_PREAMBLE, SECRET_DENY, allowPatterns, buildBrief, childArgs, childEnv, childHeaders, childReady, gatewayFrom, parseChildOutput, projectSlug, relayText, subscriptionEnv } from '../hooks/lib/child.js'
import { VERSION } from '../hooks/lib/version.js'

const CHILD = { ...DEFAULTS.child, baseUrl: 'https://api.palgu.ai/anthropic' }

test('childArgs are the headless flags for the routed model, with the cwd added for CLAUDE.md', async () => {
  expect(childArgs(CHILD, 'glm-5.3', '/work')).toEqual([
    '-p', '--model', 'glm-5.3', '--output-format', 'json', '--max-turns', '25', '--add-dir', '/work',
    '--bare', '--permission-mode', 'acceptEdits', '--disallowedTools', ...SECRET_DENY,
  ])
})

test('SECRET_DENY keeps env files, keys and secrets folders out of the child', async () => {
  for (const rule of ['Read(**/.env)', 'Read(**/.env.*)', 'Read(**/*.pem)', 'Read(**/*.key)', 'Read(**/id_rsa*)', 'Read(**/secrets/**)']) {
    expect(SECRET_DENY).toContain(rule)
  }
  expect(DEFAULTS.child.deny).toEqual([])
})

test('the deny list is passed after custom args, so child.args cannot drop it, and router.child.deny adds to it', async () => {
  const args = childArgs({ ...CHILD, args: ['--dangerously-skip-permissions'], deny: ['Read(**/creds.json)'] }, 'glm-5.3', '/work')
  expect(args.slice(args.indexOf('--disallowedTools') + 1)).toEqual([...SECRET_DENY, 'Read(**/creds.json)'])
  expect(args.indexOf('--disallowedTools') > args.indexOf('--dangerously-skip-permissions')).toBe(true)
  const noExtra = childArgs({ ...CHILD, deny: undefined }, 'glm-5.3', '/work')
  expect(noExtra.slice(noExtra.indexOf('--disallowedTools') + 1)).toEqual(SECRET_DENY)
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

test('childEnv adds the identifying headers for the gateway, only when the child has one', async () => {
  const headers = childHeaders('/work/app', '')
  expect(childEnv(CHILD, 'srt_key', headers).ANTHROPIC_CUSTOM_HEADERS).toBe(headers)
  expect(childEnv({ ...CHILD, baseUrl: '' }, 'srt_key', headers)).toEqual({ MAGGY_ROUTER_CHILD: '1' })
})

test('childHeaders names the mod and its version, and the project folder', async () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  expect(childHeaders('/Users/me/code/palgu-web', '')).toBe('x-srooter-client: mixture-of-models/' + VERSION + '\nx-srooter-project: palgu-web')
})

test('childHeaders keeps the user\'s own custom headers and appends ours once', async () => {
  const theirs = 'X-Team: platform\nX-Trace: on\n'
  const merged = childHeaders('/work/app', theirs)
  expect(merged).toBe('X-Team: platform\nX-Trace: on\nx-srooter-client: mixture-of-models/' + VERSION + '\nx-srooter-project: app')
  expect(childHeaders('/work/app', merged)).toBe(merged)
  expect(childHeaders('/work/app', 'X-Srooter-Project: mine')).toBe('X-Srooter-Project: mine\nx-srooter-client: mixture-of-models/' + VERSION)
})

test('childHeaders leaves the project out when the folder name has no usable slug', async () => {
  expect(childHeaders('/', '')).toBe('x-srooter-client: mixture-of-models/' + VERSION)
  expect(childHeaders('/work/a..b', '')).toBe('x-srooter-client: mixture-of-models/' + VERSION)
})

test('projectSlug follows the gateway\'s project_detect rule: lowercase, [a-z0-9._-], at most 64', async () => {
  expect(projectSlug('/Users/me/My Project (v2)!')).toBe('my-project-v2')
  expect(projectSlug('/work/app/')).toBe('app')
  expect(projectSlug('C:\\Users\\me\\Repo.Name')).toBe('repo.name')
  expect(projectSlug('/work/_.-x_y-._')).toBe('x_y')
  expect(projectSlug('/work/' + 'A'.repeat(80))).toBe('a'.repeat(64))
  expect(projectSlug('/work/日本語')).toBe('')
  expect(projectSlug('')).toBe('')
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
  expect(parseChildOutput(JSON.stringify(RESULT), 0)).toEqual({ ok: true, answer: 'done', sessionId: 'sid-1', denials: [], turns: undefined, usage: null })
  expect(parseChildOutput(JSON.stringify({ ...RESULT, num_turns: 3 }), 0).turns).toBe(3)
  expect(parseChildOutput(JSON.stringify([{ type: 'system' }, denied]), 0)).toEqual({
    ok: true, answer: 'I need approval', sessionId: 'sid-1',
    denials: [{ tool: 'Bash', command: 'git pull --ff-only' }, { tool: 'WebFetch', command: '' }], turns: undefined, usage: null,
  })
})

test('parseChildOutput keeps the child usage, so the turn can be priced', async () => {
  const usage = { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 }
  expect(parseChildOutput(JSON.stringify({ ...RESULT, usage }), 0).usage).toEqual({ ...usage, cache_1h_input_tokens: 0 })
})

test('parseChildOutput treats a non-zero exit, an error result or unparsable output as a failed child', async () => {
  expect(parseChildOutput(JSON.stringify(RESULT), 1).ok).toBe(false)
  expect(parseChildOutput(JSON.stringify({ ...RESULT, is_error: true }), 0).ok).toBe(false)
  expect(parseChildOutput('Not logged in', 0)).toEqual({ ok: false, answer: '', sessionId: '', denials: [], turns: undefined, usage: null })
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

test('subscriptionEnv marks the child and clears an inherited gateway URL, but never sets an API key', async () => {
  // An empty ANTHROPIC_API_KEY counts as a key and breaks the subscription login, so it is left alone.
  expect(subscriptionEnv()).toEqual({ MAGGY_ROUTER_CHILD: '1', ANTHROPIC_BASE_URL: '' })
})

test('the subscription child drops --bare, which would force API-key auth, and keeps acceptEdits', async () => {
  expect(DEFAULTS.child.subscriptionArgs).toEqual(['--permission-mode', 'acceptEdits'])
  const args = childArgs({ ...CHILD, args: CHILD.subscriptionArgs }, 'claude-sonnet-5-5', '/work')
  expect(args).toContain('claude-sonnet-5-5')
  expect(args).not.toContain('--bare')
  expect(args).toContain('--disallowedTools')
})
