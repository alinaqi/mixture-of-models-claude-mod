import { expect, test } from 'claude-code/testing'
import { DEFAULTS, parseConfig } from '../hooks/lib/config.js'

test('an empty or invalid file yields the defaults', async () => {
  expect(parseConfig('')).toEqual(DEFAULTS)
  expect(parseConfig('{not json')).toEqual(DEFAULTS)
})

test('a non-Claude primary becomes the coding route; primary claude keeps the cheap default', async () => {
  expect(parseConfig('{"primary":"glm"}').routes.coding).toBe('glm-5.3')
  expect(parseConfig('{"primary":"kimi"}').routes.coding).toBe('kimi-k3')
  expect(parseConfig('{"primary":"claude"}').routes.coding).toBe('glm-5.3')
  expect(parseConfig('{"primary":"claude","router":{"routes":{"coding":"claude"}}}').routes.coding).toBe('claude')
})

test('routes have a tier default and a per-kind matrix, each overridable on its own', async () => {
  expect(DEFAULTS.routes).toEqual({
    simple: 'glm-5.3', coding: 'glm-5.3', critical: 'claude',
    kinds: { research: 'kimi-k3', review: 'kimi-k3', multimodal: 'claude' },
  })
  const cfg = parseConfig('{"router":{"routes":{"kinds":{"research":"kimi-k3-long"},"coding":"deepseek-v4-pro"}}}')
  expect(cfg.routes.kinds.research).toBe('kimi-k3-long')
  expect(cfg.routes.kinds.review).toBe('kimi-k3')
  expect(cfg.routes.coding).toBe('deepseek-v4-pro')
  expect(cfg.routes.simple).toBe('glm-5.3')
})

test('router options override the defaults', async () => {
  const cfg = parseConfig('{"router":{"summary":false,"ollama":{"model":"qwen3:8b"}}}')
  expect(cfg.summary).toBe(false)
  expect(cfg.ollama.model).toBe('qwen3:8b')
  expect(cfg.ollama.base).toBeUndefined()
})


test('the fallback classifier is an undated current-generation alias, overridable', async () => {
  expect(DEFAULTS.classifier).toBe('claude-haiku-4-5')
  expect(parseConfig('')).toEqual({ ...DEFAULTS })
  expect(parseConfig('{"router":{"classifier":"claude-sonnet-5"}}').classifier).toBe('claude-sonnet-5')
})

test('no default names a dated model snapshot', async () => {
  const all = JSON.stringify(DEFAULTS)
  expect(all).not.toMatch(/\d{8}/)
})

test('the child block merges over its defaults', async () => {
  const cfg = parseConfig('{"router":{"child":{"baseUrl":"https://api.palgu.ai/anthropic","maxTurns":5}}}')
  expect(cfg.child.baseUrl).toBe('https://api.palgu.ai/anthropic')
  expect(cfg.child.maxTurns).toBe(5)
  expect(cfg.child.command).toBeUndefined()
  expect(cfg.child.keyFile).toBeUndefined()
  expect(cfg.child.timeoutMs).toBe(600000)
  expect(cfg.child.contextMessages).toBe(12)
})

test('the ui block defaults to the band on and tags on routed replies', async () => {
  expect(parseConfig('').ui).toEqual({ band: true, tags: 'routed' })
  expect(parseConfig('{"router":{"ui":{"tags":"all"}}}').ui).toEqual({ band: true, tags: 'all' })
  expect(parseConfig('{"router":{"ui":{"band":false}}}').ui.band).toBe(false)
})

test('thresholds default to 3/7 and can be moved', async () => {
  expect(parseConfig('').thresholds).toEqual({ simple: 3, coding: 7 })
  expect(parseConfig('{"router":{"thresholds":{"coding":8}}}').thresholds).toEqual({ simple: 3, coding: 8 })
})
