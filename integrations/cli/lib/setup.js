// The provider configuration each tool needs to talk to Palgu's router (ADR 0005). Pure: text out.

export function clientHeader(tool, version) {
  return 'mixture-of-models-' + tool + '/' + version
}

// ~/.codex/palgu.config.toml, layered with `codex -p palgu`. Palgu picks the model per request
// (`auto`); MOM_PIN, when set, pins one. The key comes from `mom token`, never from this file.
export function codexProfile(version) {
  return [
    '# Written by `mom setup codex` (mixture-of-models). Use with: codex -p palgu',
    'model_provider = "palgu"',
    'model = "auto"',
    '',
    '[model_providers.palgu]',
    'name = "Palgu"',
    'base_url = "https://api.palgu.ai/v1"',
    'wire_api = "responses"',
    'auth = { command = "mom", args = ["token"] }',
    'http_headers = { "x-srooter-client" = "' + clientHeader('codex', version) + '" }',
    'env_http_headers = { "x-srooter-pin" = "MOM_PIN", "x-srooter-project" = "MOM_PROJECT" }',
    ''
  ].join('\n')
}

const LIMIT = { context: 200000, output: 32000 }

// OpenCode's opencode.json: Palgu as one Anthropic-compatible provider whose models are `auto`
// (Palgu routes) and the models a pin may name, the default model palgu/auto, and the plugin.
// The key is not in it: `{env:PALGU_API_KEY}`, or the plugin adds mom's key to Palgu's requests.
export function opencodeConfig(version, models, pluginSpec) {
  const ids = ['auto', ...models.filter((m) => m !== 'auto')]
  const entries = ids.map((id) => [id, { name: id === 'auto' ? 'Palgu router (auto)' : id, limit: LIMIT }])
  return {
    $schema: 'https://opencode.ai/config.json',
    model: 'palgu/auto',
    provider: {
      palgu: {
        npm: '@ai-sdk/anthropic',
        name: 'Palgu',
        options: { baseURL: 'https://api.palgu.ai/anthropic/v1', apiKey: '{env:PALGU_API_KEY}', headers: { 'x-srooter-client': clientHeader('opencode', version) } },
        models: Object.fromEntries(entries)
      }
    },
    plugin: [pluginSpec]
  }
}

const specOf = (entry) => (Array.isArray(entry) ? entry[0] : entry)

// Ours merged into the person's config: other keys, providers and plugins (and their options for
// ours) stay; their default model stays if they set one.
export function mergeOpencode(theirs, ours) {
  const t = theirs || {}
  const plugins = Array.isArray(t.plugin) ? t.plugin : []
  const spec = ours.plugin[0]
  return {
    ...t,
    $schema: t.$schema || ours.$schema,
    model: t.model || ours.model,
    provider: { ...(t.provider || {}), palgu: ours.provider.palgu },
    plugin: plugins.some((p) => specOf(p) === spec) ? plugins : [...plugins, spec]
  }
}
