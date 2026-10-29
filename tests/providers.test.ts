import { expect, test } from 'claude-code/testing'
import { PROVIDERS, gatewayName, providerDefaults, providerOf } from '../hooks/lib/providers.js'

const PALGU_IDS = ['glm-5.3', 'deepseek-pro', 'gemini-3.8-flash', 'minimax-m3', 'minimax-m2.5', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra', 'kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed', 'mercury-3']

test('the providers are palgu, openrouter, litellm and any other anthropic-compatible gateway', async () => {
  expect(PROVIDERS).toEqual(['palgu', 'openrouter', 'litellm', 'anthropic-compatible'])
})

test('auto detects Palgu and OpenRouter by host; any other host is a generic anthropic-compatible gateway', async () => {
  expect(providerOf('https://api.palgu.ai/anthropic', 'auto')).toBe('palgu')
  expect(providerOf('https://API.Palgu.AI/anthropic')).toBe('palgu')
  expect(providerOf('https://openrouter.ai/api', '')).toBe('openrouter')
  expect(providerOf('https://eu.openrouter.ai/api')).toBe('openrouter')
  expect(providerOf('http://localhost:4000')).toBe('anthropic-compatible')
  expect(providerOf('https://api.z.ai/api/anthropic')).toBe('anthropic-compatible')
  expect(providerOf('')).toBe('anthropic-compatible')
  expect(providerOf('not a url')).toBe('anthropic-compatible')
})

test('a host that only looks like Palgu or OpenRouter is not detected as one', async () => {
  expect(providerOf('https://palgu.ai.evil.example/anthropic')).toBe('anthropic-compatible')
  expect(providerOf('https://notopenrouter.ai/api')).toBe('anthropic-compatible')
  expect(providerOf('https://openrouter.ai@evil.example/api')).toBe('anthropic-compatible')
})

test('an explicit provider wins over the host; an unknown value falls back to auto', async () => {
  expect(providerOf('http://localhost:4000', 'litellm')).toBe('litellm')
  expect(providerOf('https://llm.example.com', 'openrouter')).toBe('openrouter')
  expect(providerOf('https://api.palgu.ai/anthropic', 'bogus')).toBe('palgu')
})

test('Palgu and generic gateways send the key as x-api-key; OpenRouter and LiteLLM as a bearer token', async () => {
  expect(providerDefaults('palgu').auth).toBe('x-api-key')
  expect(providerDefaults('anthropic-compatible').auth).toBe('x-api-key')
  expect(providerDefaults('openrouter').auth).toBe('bearer')
  expect(providerDefaults('litellm').auth).toBe('bearer')
})

test('only Palgu and generic gateways get the x-srooter identification headers', async () => {
  expect(providerDefaults('palgu').identify).toBe(true)
  expect(providerDefaults('anthropic-compatible').identify).toBe(true)
  expect(providerDefaults('openrouter').identify).toBe(false)
  expect(providerDefaults('litellm').identify).toBe(false)
})

test('Palgu, LiteLLM and generic gateways keep the Palgu catalogue and routes', async () => {
  for (const name of ['palgu', 'litellm', 'anthropic-compatible']) {
    const p = providerDefaults(name)
    expect(p.catalogue).toEqual(PALGU_IDS)
    expect(p.routes.simple).toBe('glm-5.3')
    expect(p.routes.kinds.research).toBe('deepseek-pro')
    expect(p.families.kimi.members).toEqual({ pro: 'kimi-k3.1-pro', highspeed: 'kimi-k3.1-pro-highspeed' })
  }
})

test('OpenRouter maps each family to an OpenRouter slug, and routes name families, not slugs', async () => {
  const p = providerDefaults('openrouter')
  expect(p.families.glm.members).toEqual({ '5.3': 'z-ai/glm-5.3' })
  expect(p.families.kimi.members).toEqual({ pro: 'moonshotai/kimi-k3.1-pro' })
  expect(p.families.deepseek.members).toEqual({ 'v4-pro': 'deepseek/deepseek-v4-pro' })
  expect(p.families.gemini.members).toEqual({ '3.8-flash': 'google/gemini-3.8-flash' })
  expect(p.families.mercury.members).toEqual({ 3: 'inception/mercury-3' })
  expect(p.families.kimi.auto).toEqual({ simple: 'pro', coding: 'pro', critical: 'pro' })
  expect(p.catalogue).toEqual(['glm/5.3', 'kimi/pro', 'deepseek/v4-pro', 'gemini/3.8-flash', 'minimax/m3', 'gpt/sol', 'mercury/3'])
  expect(p.routes).toEqual({ simple: 'glm/5.3', coding: 'glm/5.3', critical: 'claude', kinds: { research: 'kimi/pro', review: 'kimi/pro', multimodal: 'claude' } })
  expect(p.primary).toEqual({ glm: 'glm/5.3', kimi: 'kimi/pro', deepseek: 'deepseek/v4-pro' })
})

test('an unknown provider name gets the generic defaults', async () => {
  expect(providerDefaults('nope')).toEqual(providerDefaults('anthropic-compatible'))
})

test('OpenRouter serves MiniMax and GPT-6 under their own slugs, GPT-6 picking Luna, Sol or Astra by tier', async () => {
  const p = providerDefaults('openrouter')
  expect(p.families.minimax.members).toEqual({ m3: 'minimax/minimax-m3', 'm3.1-flash': 'minimax/minimax-m3.1-flash' })
  expect(p.families.gpt.members).toEqual({ sol: 'openai/gpt-6-sol', luna: 'openai/gpt-6-luna', astra: 'openai/gpt-6-astra' })
  expect(p.families.gpt.auto).toEqual({ simple: 'luna', coding: 'sol', critical: 'astra' })
})

test('gatewayName gives Palgu its pin names, so an old deepseek-v4-pro route or pin still runs', async () => {
  expect(gatewayName('palgu', 'deepseek-v4-pro')).toBe('deepseek-pro')
  expect(gatewayName('palgu', 'glm-5.3')).toBe('glm-5.3')
  expect(gatewayName('openrouter', 'deepseek/deepseek-v4-pro')).toBe('deepseek/deepseek-v4-pro')
})

test('on Palgu research and review go to DeepSeek, not Kimi, which Palgu does not answer today', async () => {
  expect(providerDefaults('palgu').routes.kinds).toEqual({ research: 'deepseek-pro', review: 'deepseek-pro', multimodal: 'claude' })
  expect(providerDefaults('palgu').families.deepseek.members).toEqual({ 'v4-pro': 'deepseek-pro' })
})
