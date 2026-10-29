import { expect, test } from 'claude-code/testing'
import { DEFAULTS, GATEWAY_MODELS, parseConfig } from '../hooks/lib/config.js'

test('an empty or invalid file yields the defaults', async () => {
  expect(parseConfig('')).toEqual(DEFAULTS)
  expect(parseConfig('{not json')).toEqual(DEFAULTS)
})

test('a non-Claude primary becomes the coding route; primary claude keeps the cheap default', async () => {
  expect(parseConfig('{"primary":"glm"}').routes.coding).toBe('glm-5.3')
  expect(parseConfig('{"primary":"kimi"}').routes.coding).toBe('kimi-k3.1-pro')
  expect(parseConfig('{"primary":"claude"}').routes.coding).toBe('glm-5.3')
  expect(parseConfig('{"primary":"claude","router":{"routes":{"coding":"claude"}}}').routes.coding).toBe('claude')
})

test('routes have a tier default and a per-kind matrix, each overridable on its own', async () => {
  expect(DEFAULTS.routes).toEqual({
    simple: 'glm-5.3', coding: 'glm-5.3', critical: 'claude',
    kinds: { research: 'kimi-k3.1-pro', review: 'kimi-k3.1-pro', multimodal: 'claude' },
  })
  const cfg = parseConfig('{"router":{"routes":{"kinds":{"research":"kimi-k3-long"},"coding":"deepseek-v4-pro"}}}')
  expect(cfg.routes.kinds.research).toBe('kimi-k3-long')
  expect(cfg.routes.kinds.review).toBe('kimi-k3.1-pro')
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
  expect(cfg.child.relayRounds).toBe(2)
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

test('the gateway catalogue lists the models a pin can name, kimi-k3 retired', async () => {
  expect(GATEWAY_MODELS).toEqual(['glm-5.3', 'kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed', 'deepseek-v4-pro', 'gemini-3.8-flash', 'minimax-m3', 'minimax-m2.5', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra'])
  expect(JSON.stringify(DEFAULTS)).not.toMatch(/kimi-k3"/)
})

test('mercury-3 is no Palgu model and no default route, but a route may still name it', async () => {
  expect(GATEWAY_MODELS).not.toContain('mercury-3')
  expect(JSON.stringify(DEFAULTS.routes)).not.toMatch(/mercury/)
  expect(parseConfig('{"router":{"routes":{"simple":"mercury-3"}}}').routes.simple).toBe('mercury-3')
})

const OPENROUTER = { gateway_url: 'https://openrouter.ai/api', gateway_key: 'sk-or-test' }

test('with no gateway the provider is generic and every default is as before', async () => {
  expect(DEFAULTS.provider).toBe('anthropic-compatible')
  expect(DEFAULTS.catalogue).toEqual(GATEWAY_MODELS)
  expect(DEFAULTS.child.auth).toBe('x-api-key')
  expect(DEFAULTS.child.identify).toBe(true)
  expect(parseConfig('', {})).toEqual(DEFAULTS)
})

test('the provider comes from the gateway URL in the options, or the config\'s child.baseUrl', async () => {
  expect(parseConfig('', { gateway_url: 'https://api.palgu.ai/anthropic' }).provider).toBe('palgu')
  expect(parseConfig('', OPENROUTER).provider).toBe('openrouter')
  expect(parseConfig('{"router":{"child":{"baseUrl":"https://openrouter.ai/api"}}}').provider).toBe('openrouter')
})

test('gateway_provider, or router.provider, names the provider explicitly; the option wins', async () => {
  expect(parseConfig('', { gateway_url: 'http://localhost:4000', gateway_provider: 'litellm' }).provider).toBe('litellm')
  expect(parseConfig('{"router":{"provider":"litellm"}}', { gateway_url: 'http://localhost:4000' }).provider).toBe('litellm')
  expect(parseConfig('{"router":{"provider":"litellm"}}', { gateway_url: 'http://x:4000', gateway_provider: 'openrouter' }).provider).toBe('openrouter')
  expect(parseConfig('', { gateway_url: 'http://localhost:4000', gateway_provider: 'auto' }).provider).toBe('anthropic-compatible')
})

test('OpenRouter defaults: bearer auth, no x-srooter headers, its slugs behind the families', async () => {
  const cfg = parseConfig('', OPENROUTER)
  expect(cfg.child.auth).toBe('bearer')
  expect(cfg.child.identify).toBe(false)
  expect(cfg.routes.simple).toBe('glm/5.3')
  expect(cfg.routes.kinds.review).toBe('kimi/pro')
  expect(cfg.families.glm.members['5.3']).toBe('z-ai/glm-5.3')
  expect(cfg.families.claude.members.opus).toBe('claude-opus-5-5')
  expect(cfg.families.codex).toEqual({ members: {}, auto: {} })
  expect(cfg.catalogue).toContain('deepseek/v4-pro')
  expect(parseConfig('{"primary":"kimi"}', OPENROUTER).routes.coding).toBe('kimi/pro')
})

test('OpenRouter routes and families stay overridable', async () => {
  const cfg = parseConfig('{"router":{"routes":{"simple":"glm/4.6"},"families":{"glm":{"members":{"4.6":"z-ai/glm-4.6"}}}}}', OPENROUTER)
  expect(cfg.routes.simple).toBe('glm/4.6')
  expect(cfg.routes.coding).toBe('glm/5.3')
  expect(cfg.families.glm.members).toEqual({ '5.3': 'z-ai/glm-5.3', '4.6': 'z-ai/glm-4.6' })
})

test('LiteLLM defaults: bearer auth, Palgu\'s model names, no x-srooter headers', async () => {
  const cfg = parseConfig('', { gateway_url: 'http://localhost:4000', gateway_provider: 'litellm' })
  expect(cfg.child.auth).toBe('bearer')
  expect(cfg.child.identify).toBe(false)
  expect(cfg.routes).toEqual(DEFAULTS.routes)
  expect(cfg.families).toEqual(DEFAULTS.families)
})

test('router.child.auth overrides the provider\'s auth for an unusual gateway', async () => {
  expect(parseConfig('{"router":{"child":{"auth":"bearer"}}}', { gateway_url: 'https://llm.example.com' }).child.auth).toBe('bearer')
})
