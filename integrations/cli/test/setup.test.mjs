import { test } from 'node:test'
import assert from 'node:assert/strict'
import { codexProfile, clientHeader } from '../lib/setup.js'

test('codexProfile points Codex at Palgu\'s router, keyed through mom token, with the pin from MOM_PIN', () => {
  const toml = codexProfile('0.26.0')
  assert.match(toml, /^model_provider = "palgu"$/m)
  assert.match(toml, /^model = "auto"$/m)
  assert.match(toml, /^\[model_providers\.palgu\]$/m)
  assert.match(toml, /^base_url = "https:\/\/api\.palgu\.ai\/v1"$/m)
  assert.match(toml, /^wire_api = "responses"$/m)
  assert.match(toml, /^auth = \{ command = "mom", args = \["token"\] \}$/m)
  assert.match(toml, /"x-srooter-client" = "mixture-of-models-codex\/0\.26\.0"/)
  assert.match(toml, /"x-srooter-pin" = "MOM_PIN"/)
  // never a key in the file
  assert.doesNotMatch(toml, /experimental_bearer_token|env_key/)
})

test('opencodeConfig: Palgu as an Anthropic-compatible provider with auto and the given models, the plugin, no key', async () => {
  const { opencodeConfig } = await import('../lib/setup.js')
  const c = opencodeConfig('0.27.0', ['deepseek-pro', 'auto'], '/x/plugin.js')
  const p = c.provider.palgu
  assert.equal(p.npm, '@ai-sdk/anthropic')
  assert.equal(p.options.baseURL, 'https://api.palgu.ai/anthropic/v1')
  assert.equal(p.options.apiKey, '{env:PALGU_API_KEY}')
  assert.equal(p.options.headers['x-srooter-client'], 'mixture-of-models-opencode/0.27.0')
  assert.deepEqual(Object.keys(p.models), ['auto', 'deepseek-pro'])
  assert.ok(p.models.auto.limit.context > 0)
  assert.equal(c.model, 'palgu/auto')
  assert.deepEqual(c.plugin, ['/x/plugin.js'])
  assert.doesNotMatch(JSON.stringify(c), /pk_|sk-/)
})

test('mergeOpencode adds Palgu and the plugin, and keeps everything else the person set', async () => {
  const { mergeOpencode, opencodeConfig } = await import('../lib/setup.js')
  const ours = opencodeConfig('0.27.0', ['deepseek-pro'], '/x/plugin.js')
  const theirs = { theme: 'tokyo', model: 'anthropic/claude-sonnet-5', provider: { other: { npm: 'x' }, palgu: { old: true } }, plugin: ['a-plugin', ['/x/plugin.js', { critical: 'claude-opus' }]] }
  const m = mergeOpencode(theirs, ours)
  assert.equal(m.theme, 'tokyo')
  assert.equal(m.model, 'anthropic/claude-sonnet-5')
  assert.deepEqual(m.provider.other, { npm: 'x' })
  assert.equal(m.provider.palgu.options.baseURL, 'https://api.palgu.ai/anthropic/v1')
  assert.deepEqual(m.plugin, ['a-plugin', ['/x/plugin.js', { critical: 'claude-opus' }]])
  assert.deepEqual(mergeOpencode({}, ours).plugin, ['/x/plugin.js'])
  assert.equal(mergeOpencode({}, ours).model, 'palgu/auto')
  assert.deepEqual(mergeOpencode(m, ours), m)
})

test('clientHeader names the adapter and version', () => {
  assert.equal(clientHeader('cursor', '1.2.3'), 'mixture-of-models-cursor/1.2.3')
})

test('the Codex plugin and the marketplace stay on the mod\'s version and point at each other', async () => {
  const { readFileSync } = await import('node:fs')
  const { VERSION } = await import('../../../hooks/lib/version.js')
  const root = new URL('../../../', import.meta.url)
  const plugin = JSON.parse(readFileSync(new URL('integrations/codex/.codex-plugin/plugin.json', root), 'utf8'))
  const market = JSON.parse(readFileSync(new URL('.agents/plugins/marketplace.json', root), 'utf8'))
  const hooks = JSON.parse(readFileSync(new URL('integrations/codex/hooks/hooks.json', root), 'utf8'))
  assert.equal(plugin.version, VERSION)
  assert.equal(market.plugins[0].name, plugin.name)
  assert.equal(market.plugins[0].source.path, './integrations/codex')
  assert.deepEqual(Object.keys(hooks.hooks).sort(), ['SessionStart', 'Stop', 'UserPromptSubmit'])
  for (const groups of Object.values(hooks.hooks)) assert.equal(groups[0].hooks[0].command, 'mom hook codex')
})
