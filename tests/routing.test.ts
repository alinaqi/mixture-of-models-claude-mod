import { expect, test } from 'claude-code/testing'
import { DEFAULT_ROUTES } from '../hooks/lib/config.js'
import { adjustThresholds, bumpFailures, isBorderline, midTaskGuard, parseRouteArg, resolveModel, summaryLine } from '../hooks/lib/routing.js'

const SESSION = 'claude-opus-5'

test('resolveModel: the tier decides whether Claude is mandatory, the kind picks the cheaper model', async () => {
  expect(resolveModel({ label: 'simple', kind: 'code' }, DEFAULT_ROUTES, SESSION)).toBe('glm-5.3')
  expect(resolveModel({ label: 'coding', kind: 'code' }, DEFAULT_ROUTES, SESSION)).toBe('glm-5.3')
  expect(resolveModel({ label: 'coding', kind: 'research' }, DEFAULT_ROUTES, SESSION)).toBe('kimi-k3.1-pro')
  expect(resolveModel({ label: 'simple', kind: 'review' }, DEFAULT_ROUTES, SESSION)).toBe('kimi-k3.1-pro')
  expect(resolveModel({ label: 'simple', kind: 'multimodal' }, DEFAULT_ROUTES, SESSION)).toBe(SESSION)
  expect(resolveModel({ label: 'critical', kind: 'research' }, DEFAULT_ROUTES, SESSION)).toBe(SESSION)
})

test('resolveModel keeps the session model for "claude" and unknown labels', async () => {
  expect(resolveModel({ label: 'nonsense', kind: 'code' }, DEFAULT_ROUTES, SESSION)).toBe(SESSION)
  expect(resolveModel({ label: 'coding' }, DEFAULT_ROUTES, SESSION)).toBe('glm-5.3')
})

test('isBorderline is true on the coding threshold and one above it', async () => {
  const th = { simple: 3, coding: 7 }
  expect(isBorderline(7, th)).toBe(true)
  expect(isBorderline(8, th)).toBe(true)
  expect(isBorderline(6, th)).toBe(false)
  expect(isBorderline(9, th)).toBe(false)
  expect(isBorderline(3, th)).toBe(false)
})

test('adjustThresholds lowers the coding cut-off by one per two failures of that kind, never below simple + 1', async () => {
  const th = { simple: 3, coding: 7 }
  expect(adjustThresholds(th, {}, 'code')).toEqual(th)
  expect(adjustThresholds(th, { code: 1 }, 'code')).toEqual(th)
  expect(adjustThresholds(th, { code: 2 }, 'code')).toEqual({ simple: 3, coding: 6 })
  expect(adjustThresholds(th, { code: 5 }, 'code')).toEqual({ simple: 3, coding: 5 })
  expect(adjustThresholds(th, { code: 40 }, 'code')).toEqual({ simple: 3, coding: 4 })
  expect(adjustThresholds(th, { code: 4 }, 'docs')).toEqual(th)
})

test('parseRouteArg understands show, auto, off, labels and model ids', async () => {
  expect(parseRouteArg('', DEFAULT_ROUTES)).toEqual({ mode: 'show' })
  expect(parseRouteArg('auto', DEFAULT_ROUTES)).toEqual({ mode: 'auto' })
  expect(parseRouteArg('off', DEFAULT_ROUTES)).toEqual({ mode: 'off' })
  expect(parseRouteArg('coding', DEFAULT_ROUTES)).toEqual({ mode: 'label', label: 'coding' })
  expect(parseRouteArg('reset', DEFAULT_ROUTES)).toEqual({ mode: 'reset' })
  expect(parseRouteArg('stats', DEFAULT_ROUTES)).toEqual({ mode: 'stats' })
  expect(parseRouteArg('kimi-k3.1-pro', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'kimi-k3.1-pro' })
  expect(parseRouteArg('mercury-3', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'mercury-3' })
})

test('parseRouteArg expands a provider prefix to the configured model', async () => {
  expect(parseRouteArg('glm', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'glm-5.3' })
  expect(parseRouteArg('kimi', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'kimi-k3.1-pro' })
  // an old kimi-k3 pin expands to its successor
  expect(parseRouteArg('kimi-k3', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'kimi-k3.1-pro' })
  expect(parseRouteArg('claude', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'claude' })
})

test('summaryLine reports a main-session turn with context size and cache share', async () => {
  // input_tokens excludes cached tokens: context = 1.3k + 11k + 0 = 12.3k, of which 11k (89%) came from cache
  const usage = { input_tokens: 1_300, output_tokens: 800, cache_read_input_tokens: 11_000, cache_creation_input_tokens: 0, model: 'claude-opus-5' }
  const line = summaryLine({ label: 'critical', model: 'claude-opus-5', source: 'rule' }, usage)
  expect(line).toBe('route: claude-opus-5 · critical via rule · 12.3k in / 0.8k out · cache 89% · main session')
})

test('summaryLine survives a usage with no tokens', async () => {
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'x' }
  expect(summaryLine({ label: 'simple', model: 'x', source: 'pin' }, usage)).toBe('route: x · simple via pin · 0.0k in / 0.0k out · cache 0% · main session')
})

test('summaryLine works without usage', async () => {
  expect(summaryLine({ label: 'critical', model: 'claude-opus-5', source: 'pin' }, null)).toBe('route: claude-opus-5 · critical via pin · main session')
})

test('summaryLine shows the blast score and the kind when the classifier gave them', async () => {
  const d = { label: 'coding', score: 5, kind: 'research', model: 'kimi-k3.1-pro', source: 'claude-haiku-4-5', child: { ms: 8_000, exitCode: 0 } }
  expect(summaryLine(d, null)).toBe('route: kimi-k3.1-pro · coding 5/10 research via claude-haiku-4-5 · child 8s')
})

test('summaryLine reports a child run instead of API usage', async () => {
  const d = { label: 'coding', model: 'glm-5.3', source: 'ollama', child: { ms: 42_300, exitCode: 0 } }
  expect(summaryLine(d, null)).toBe('route: glm-5.3 · coding via ollama · child 42s')
  const failed = { ...d, child: { ms: 1_000, exitCode: 1 } }
  expect(summaryLine(failed, null)).toBe('route: glm-5.3 · coding via ollama · child failed, main model answered')
})

test('bumpFailures counts a failure against its kind, defaulting to code', async () => {
  expect(bumpFailures(undefined, 'docs')).toEqual({ docs: 1 })
  expect(bumpFailures({ docs: 1 }, 'docs')).toEqual({ docs: 2 })
  expect(bumpFailures({ docs: 1 }, undefined)).toEqual({ docs: 1, code: 1 })
})

test('midTaskGuard keeps coding work on the main session while it is mid-task, lets lookups through', async () => {
  expect(midTaskGuard('coding', { lastHadTools: true })).toBe(true)
  expect(midTaskGuard('simple', { lastHadTools: true })).toBe(false)
  expect(midTaskGuard('coding', { lastHadTools: false })).toBe(false)
  expect(midTaskGuard('critical', { lastHadTools: true })).toBe(false)
})

test('summaryLine says when a child answer was discarded and why', async () => {
  const d = { label: 'simple', model: 'glm-5.3', source: 'ollama', child: { ms: 4000, exitCode: 1, rejected: 'unverified claim' } }
  expect(summaryLine(d, null)).toBe('route: glm-5.3 · simple via ollama · child answer discarded (unverified claim), main model answered')
})

test('parseRouteArg expands a prefix to a gateway model that no route names', async () => {
  expect(parseRouteArg('mercury', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'mercury-3' })
  expect(parseRouteArg('kimi-k3.1-pro-h', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'kimi-k3.1-pro-highspeed' })
  expect(parseRouteArg('deepseek', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'deepseek-v4-pro' })
  expect(parseRouteArg('gemini', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'gemini-3.8-flash' })
  // a configured route still wins over the catalogue
  const routes = { ...DEFAULT_ROUTES, simple: 'mercury-2' }
  expect(parseRouteArg('mercury', routes)).toEqual({ mode: 'model', model: 'mercury-2' })
})

test('parseRouteArg keeps <family>/<member> and family pins as written, and reads status', async () => {
  expect(parseRouteArg('claude/sonnet', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'claude/sonnet' })
  expect(parseRouteArg('Kimi/Auto', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'kimi/auto' })
  expect(parseRouteArg('codex', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'codex' })
  expect(parseRouteArg('codex/gpt-5.6-terra', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'codex/gpt-5.6-terra' })
  expect(parseRouteArg('status', DEFAULT_ROUTES)).toEqual({ mode: 'show' })
})

test('resolveModel keeps a Claude-family tier whatever the kind, and returns family routes as written', async () => {
  const routes = { ...DEFAULT_ROUTES, critical: 'claude/opus', simple: 'claude/auto' }
  expect(resolveModel({ label: 'critical', kind: 'research' }, routes, SESSION)).toBe('claude/opus')
  expect(resolveModel({ label: 'simple', kind: 'review' }, routes, SESSION)).toBe('claude/auto')
})

test('summaryLine names the family and the member, and marks an auto pick', async () => {
  const d = { label: 'coding', score: 5, kind: 'code', model: 'claude-sonnet-5-5', source: 'ollama', family: 'claude', member: 'sonnet', auto: true, child: { ms: 9_000, exitCode: 0 } }
  expect(summaryLine(d, null)).toBe('route: claude-sonnet-5-5 (claude/auto → sonnet) · coding 5/10 code via ollama · child 9s')
  const pinned = { label: 'pinned', model: 'kimi-k3.1-pro-highspeed', source: 'pin', family: 'kimi', member: 'highspeed', auto: false }
  expect(summaryLine(pinned, null)).toBe('route: kimi-k3.1-pro-highspeed (kimi/highspeed) · pinned via pin · main session')
  const codex = { label: 'coding', model: 'codex', source: 'pin', family: 'codex', member: '', auto: false, child: { ms: 3_000, exitCode: 0 } }
  expect(summaryLine(codex, null)).toBe('route: codex (codex/default) · coding via pin · child 3s')
})

test('summaryLine shows the Codex sandbox and every command it refused, named or not', async () => {
  const codex = { label: 'coding', model: 'codex', source: 'pin', family: 'codex', member: '', auto: false }
  const child = { ms: 3_000, exitCode: 0, sandbox: 'read-only', refused: [], unnamed: 0 }
  expect(summaryLine({ ...codex, child }, null)).toBe('route: codex (codex/default) · coding via pin · child 3s · sandbox read-only')
  const refused = { ...child, refused: ['touch made.txt', 'npm test'] }
  expect(summaryLine({ ...codex, child: refused }, null)).toBe('route: codex (codex/default) · coding via pin · child 3s · sandbox read-only · refused: touch made.txt · npm test')
  expect(summaryLine({ ...codex, child: { ...child, unnamed: 2 } }, null)).toBe('route: codex (codex/default) · coding via pin · child 3s · sandbox read-only · refused: 2 unnamed')
  const discarded = { ...refused, exitCode: 1, rejected: 'narration' }
  expect(summaryLine({ ...codex, child: discarded }, null)).toContain('main model answered · sandbox read-only · refused: touch made.txt')
})
