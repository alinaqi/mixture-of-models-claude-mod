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
