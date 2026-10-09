import { expect, test } from 'claude-code/testing'
import { DEFAULT_ROUTES } from '../hooks/lib/config.js'
import { parseRouteArg, resolveModel, summaryLine } from '../hooks/lib/routing.js'

const SESSION = 'claude-opus-5'

test('resolveModel maps a label to its configured model', async () => {
  expect(resolveModel('simple', DEFAULT_ROUTES, SESSION)).toBe('glm-5.3')
  expect(resolveModel('analysis', DEFAULT_ROUTES, SESSION)).toBe('kimi-k3')
})

test('resolveModel keeps the session model for "claude" and unknown labels', async () => {
  expect(resolveModel('critical', DEFAULT_ROUTES, SESSION)).toBe(SESSION)
  expect(resolveModel('nonsense', DEFAULT_ROUTES, SESSION)).toBe(SESSION)
})

test('parseRouteArg understands show, auto, off, labels and model ids', async () => {
  expect(parseRouteArg('', DEFAULT_ROUTES)).toEqual({ mode: 'show' })
  expect(parseRouteArg('auto', DEFAULT_ROUTES)).toEqual({ mode: 'auto' })
  expect(parseRouteArg('off', DEFAULT_ROUTES)).toEqual({ mode: 'off' })
  expect(parseRouteArg('analysis', DEFAULT_ROUTES)).toEqual({ mode: 'label', label: 'analysis' })
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

test('summaryLine shows the blast score when the classifier gave one', async () => {
  const d = { label: 'coding', score: 5, model: 'glm-5.3', source: 'claude-haiku-4-5', child: { ms: 8_000, exitCode: 0 } }
  expect(summaryLine(d, null)).toBe('route: glm-5.3 · coding 5/10 via claude-haiku-4-5 · child 8s')
})

test('summaryLine reports a child run instead of API usage', async () => {
  const d = { label: 'coding', model: 'glm-5.3', source: 'ollama', child: { ms: 42_300, exitCode: 0 } }
  expect(summaryLine(d, null)).toBe('route: glm-5.3 · coding via ollama · child 42s')
  const failed = { ...d, child: { ms: 1_000, exitCode: 1 } }
  expect(summaryLine(failed, null)).toBe('route: glm-5.3 · coding via ollama · child failed, main model answered')
})
