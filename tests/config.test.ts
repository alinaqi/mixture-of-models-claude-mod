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

test('router.routes overrides one route and keeps the rest', async () => {
  const cfg = parseConfig('{"router":{"routes":{"analysis":"kimi-k3-long"}}}')
  expect(cfg.routes.analysis).toBe('kimi-k3-long')
  expect(cfg.routes.simple).toBe('glm-5.3')
})

test('router options override the defaults', async () => {
  const cfg = parseConfig('{"router":{"summary":false,"ollama":{"model":"qwen3:8b"}}}')
  expect(cfg.summary).toBe(false)
  expect(cfg.ollama.model).toBe('qwen3:8b')
  expect(cfg.ollama.base).toBe(DEFAULTS.ollama.base)
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
  const cfg = parseConfig('{"router":{"child":{"baseUrl":"https://api.srooter.ai/anthropic","maxTurns":5}}}')
  expect(cfg.child.baseUrl).toBe('https://api.srooter.ai/anthropic')
  expect(cfg.child.maxTurns).toBe(5)
  expect(cfg.child.command).toEqual(['claude'])
  expect(cfg.child.keyFile).toBe('')
  expect(cfg.child.keyVar).toBe('SROOTER_API_KEY')
  expect(cfg.child.timeoutMs).toBe(600000)
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

test('the env-file key lookup is opt-in', async () => {
  expect(DEFAULTS.child.keyFile).toBe('')
  expect(parseConfig('{"router":{"child":{"keyFile":"~/.maggy/.env"}}}').child.keyFile).toBe('~/.maggy/.env')
})
