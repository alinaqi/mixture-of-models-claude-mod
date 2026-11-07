import { expect, test } from 'claude-code/testing'
import { liveCatalogue, liveModels, modelsText } from '../hooks/lib/catalogue.js'

const row = (model, cls, healthy = true) => ({ model, class: cls, healthy })
const res = (models) => ({ ok: true, status: 200, text: JSON.stringify({ run_at: '2026-11-07T06:00:13+00:00', models }) })
const HEALTH = res([
  row('claude-opus', 'premium'), row('gpt-5.5', 'premium', false), row('gemini-classify', 'internal'), row('gemini-3.1-flash-image', 'image'),
  row('deepseek', 'workhorse'), row('codex', 'frontier'), row('glm-5.3', 'frontier'), row('deepseek-pro', 'frontier'),
  row('gpt-6-sol', 'frontier'), row('gpt-5.6-terra', 'frontier', false), row('grok-4.7', 'frontier'), row('mistral-large-4', 'workhorse')
])

test('liveModels keeps the versioned models a routed turn can use, apart from the unhealthy ones', async () => {
  // No Claude (that is the session's own), no premium, internal or image class, no bare alias like `deepseek` or `codex`.
  expect(liveModels(HEALTH)).toEqual({ at: '2026-11-07T06:00:13+00:00', served: ['glm-5.3', 'deepseek-pro', 'gpt-6-sol', 'grok-4.7', 'mistral-large-4'], down: ['gpt-5.6-terra'] })
})

test('liveModels is null for a failed, empty or malformed answer, so the built-in list stays', async () => {
  expect(liveModels({ ok: false, status: 401, text: '{}' })).toBe(null)
  expect(liveModels(res([]))).toBe(null)
  expect(liveModels({ ok: true, text: 'not json' })).toBe(null)
  expect(liveModels({ ok: true, text: '{"models":"x"}' })).toBe(null)
  expect(liveModels(undefined)).toBe(null)
})

test('liveModels refuses ids that are not plain model names', async () => {
  const out = liveModels(res([row('glm-5.3', 'frontier'), row('bad id; rm', 'fast'), row('x'.repeat(80) + '-1', 'fast'), row(42, 'fast')]))
  expect(out.served).toEqual(['glm-5.3'])
})

test('liveCatalogue: curated models Palgu serves first, then the new ones; the band keeps the curated families', async () => {
  const curated = ['glm-5.3', 'deepseek-pro', 'kimi-k3.1-pro', 'gpt-6-sol']
  const live = { served: ['gpt-6-sol', 'glm-5.3', 'deepseek-pro', 'grok-4.7'], down: ['kimi-k3.1-pro'] }
  expect(liveCatalogue(curated, live)).toEqual({ catalogue: ['glm-5.3', 'deepseek-pro', 'gpt-6-sol', 'grok-4.7'], band: ['glm-5.3', 'deepseek-pro', 'gpt-6-sol'] })
})

test('liveCatalogue without a live list is the curated list', async () => {
  expect(liveCatalogue(['glm-5.3'], null)).toEqual({ catalogue: ['glm-5.3'], band: ['glm-5.3'] })
})

test('modelsText says what Palgu serves now, what is down, and how to pin one', async () => {
  const t = modelsText({ at: '2026-11-07T06:00:13+00:00', served: ['glm-5.3', 'grok-4.7'], down: ['gpt-5.6-terra'] }, 'palgu')
  expect(t).toContain('Palgu serves 2 models')
  expect(t).toContain('glm-5.3, grok-4.7')
  expect(t).toContain('down: gpt-5.6-terra')
  expect(t).toContain('/route <model>')
  expect(modelsText(null, 'palgu')).toMatch(/built-in list/)
  expect(modelsText(null, 'openrouter')).toContain('only from Palgu')
})

test('modelsText says when the list is the last one read because Palgu did not answer now', async () => {
  const t = modelsText({ at: '2026-11-07T06:00:13+00:00', served: ['glm-5.3'], down: [] }, 'palgu', true)
  expect(t).toContain('Palgu did not answer; the last list read')
  expect(t).toContain('glm-5.3')
})
