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
