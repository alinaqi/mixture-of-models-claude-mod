import { expect, test } from 'claude-code/testing'
import { DEFAULT_ROUTES } from '../hooks/lib/config.js'
import { adjustThresholds, bumpFailures, isBorderline, parseRouteArg, resolveModel, summaryLine } from '../hooks/lib/routing.js'

const SESSION = 'claude-opus-5'

test('resolveModel: the tier decides whether Claude is mandatory, the kind picks the cheaper model', async () => {
  expect(resolveModel({ label: 'simple', kind: 'code' }, DEFAULT_ROUTES, SESSION)).toBe('glm-5.3')
  expect(resolveModel({ label: 'coding', kind: 'code' }, DEFAULT_ROUTES, SESSION)).toBe('glm-5.3')
  expect(resolveModel({ label: 'coding', kind: 'research' }, DEFAULT_ROUTES, SESSION)).toBe('kimi-k3')
  expect(resolveModel({ label: 'simple', kind: 'review' }, DEFAULT_ROUTES, SESSION)).toBe('kimi-k3')
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
  expect(parseRouteArg('kimi-k3', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'kimi-k3' })
})

test('parseRouteArg expands a provider prefix to the configured model', async () => {
  expect(parseRouteArg('glm', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'glm-5.3' })
  expect(parseRouteArg('kimi', DEFAULT_ROUTES)).toEqual({ mode: 'model', model: 'kimi-k3' })
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
  const d = { label: 'coding', score: 5, kind: 'research', model: 'kimi-k3', source: 'claude-haiku-4-5', child: { ms: 8_000, exitCode: 0 } }
  expect(summaryLine(d, null)).toBe('route: kimi-k3 · coding 5/10 research via claude-haiku-4-5 · child 8s')
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
