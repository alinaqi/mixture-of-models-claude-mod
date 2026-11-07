// The models Palgu serves right now, from GET /v1/models/health, so the mod's list follows Palgu
// instead of a release. Pure: the answer comes in, plain lists go out.

// Classes a routed turn never takes: Claude-priced models, Palgu's own internals, image models.
const SKIP_CLASSES = ['premium', 'internal', 'image']
// A versioned model name: `glm-5.3`, `gpt-6-sol`. Bare aliases (`deepseek`, `codex`) are Palgu's own
// routing words, not models a pin should name.
const MODEL_ID = /^[a-z0-9][a-z0-9.]*(-[a-z0-9.]+)+$/

function usable(m) {
  const id = m && m.model
  return typeof id === 'string' && id.length <= 64 && MODEL_ID.test(id) && !id.startsWith('claude') && !SKIP_CLASSES.includes(m.class)
}

function parsed(res) {
  if (!res || !res.ok) return null
  try {
    const body = JSON.parse(res.text)
    return Array.isArray(body.models) ? body : null
  } catch {
    return null
  }
}

// { at, served, down } from the answer, or null when there is nothing usable in it.
export function liveModels(res) {
  const body = parsed(res)
  const rows = body ? body.models.filter(usable) : []
  if (!rows.length) return null
  const served = rows.filter((m) => m.healthy !== false).map((m) => m.model)
  const down = rows.filter((m) => m.healthy === false).map((m) => m.model)
  return { at: String(body.run_at || ''), served, down }
}

// `catalogue`: what `/route <prefix>` matches, the curated models Palgu serves in their order, then
// the new ones. `band`: the curated ones only, so new families do not crowd the band's buttons.
export function liveCatalogue(curated, live) {
  if (!live) return { catalogue: curated, band: curated }
  const band = curated.filter((id) => live.served.includes(id))
  return { catalogue: [...band, ...live.served.filter((id) => !band.includes(id))], band }
}

// The /route models answer.
export function modelsText(live, provider) {
  if (provider !== 'palgu') return 'The live model list comes only from Palgu; this gateway uses the built-in list.'
  if (!live) return 'Palgu\'s model list could not be read; the mod uses its built-in list.'
  const when = live.at ? ' (health checked ' + live.at.slice(11, 16) + ' UTC)' : ''
  const down = live.down.length ? ' · down: ' + live.down.join(', ') : ''
  return 'Palgu serves ' + live.served.length + ' models' + when + ': ' + live.served.join(', ') + down + ' · pin one with /route <model>'
}
