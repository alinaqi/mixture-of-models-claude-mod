// Gateway providers: which one a gateway URL is, how the child authenticates to it, and which
// models it serves under which family. Pure.

export const PROVIDERS = ['palgu', 'openrouter', 'litellm', 'anthropic-compatible']

// Palgu's catalogue. LiteLLM and other gateways default to the same ids: a LiteLLM proxy serves
// whatever `model_name`s its config defines, so name yours the same or override router.routes.
// Palgu's pin names (its policy allowlist), each run on 2026-10-29 as a pinned `claude -p --bare`
// research turn. Kimi's earlier failures were Moonshot answering 429 engine_overloaded, which the
// child retried for ~2-3 minutes (child.maxRetries now bounds that). mercury-3 is pin-only.
export const PALGU_MODELS = ['glm-5.3', 'deepseek-pro', 'gemini-3.8-flash', 'minimax-m3', 'minimax-m2.5', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra', 'kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed', 'mercury-3']

// Older ids Palgu refuses as a pin, to the name it takes; a saved pin or route keeps working.
const PALGU_NAMES = { 'deepseek-v4-pro': 'deepseek-pro' }

export function gatewayName(provider, id) {
  return provider === 'palgu' ? PALGU_NAMES[id] || id : id
}

// GPT-6 by tier: Luna is the small fast one, Sol the default, Astra the largest.
const GPT_AUTO = { simple: 'luna', coding: 'sol', critical: 'astra' }

// OpenRouter slugs per family member, as listed by https://openrouter.ai/api/v1/models on
// 2026-10-29. OpenRouter has no Kimi highspeed variant, so Kimi is `pro` for every tier.
const OPENROUTER_FAMILIES = {
  glm: { members: { '5.3': 'z-ai/glm-5.3' }, auto: {} },
  kimi: { members: { pro: 'moonshotai/kimi-k3.1-pro' }, auto: { simple: 'pro', coding: 'pro', critical: 'pro' } },
  deepseek: { members: { 'v4-pro': 'deepseek/deepseek-v4-pro' }, auto: {} },
  mercury: { members: { 3: 'inception/mercury-3' }, auto: {} },
  gemini: { members: { '3.8-flash': 'google/gemini-3.8-flash' }, auto: {} },
  minimax: { members: { m3: 'minimax/minimax-m3', 'm3.1-flash': 'minimax/minimax-m3.1-flash' }, auto: {} },
  gpt: { members: { sol: 'openai/gpt-6-sol', luna: 'openai/gpt-6-luna', astra: 'openai/gpt-6-astra' }, auto: GPT_AUTO },
}

// A gateway family per prefix in a plain-id catalogue, members named by what follows it.
function familiesOf(models) {
  const out = {}
  for (const id of models) {
    const family = id.split('-')[0]
    out[family] = out[family] || { members: {}, auto: {} }
    out[family].members[id.slice(family.length + 1)] = id
  }
  out.kimi = { members: { pro: 'kimi-k3.1-pro', highspeed: 'kimi-k3.1-pro-highspeed' }, auto: { simple: 'highspeed', coding: 'pro', critical: 'pro' } }
  if (out.deepseek) out.deepseek = { members: { 'v4-pro': 'deepseek-pro' }, auto: {} }
  if (out.gpt) out.gpt = { members: { sol: 'gpt-6-sol', luna: 'gpt-6-luna', astra: 'gpt-6-astra' }, auto: GPT_AUTO }
  return out
}

function routesOf(cheap, long) {
  return { simple: cheap, coding: cheap, critical: 'claude', kinds: { research: long, review: long, multimodal: 'claude' } }
}

// `auth`: how the child sends the key (x-api-key: ANTHROPIC_API_KEY; bearer: ANTHROPIC_AUTH_TOKEN).
// `identify`: whether the child sends the x-srooter-* headers, which only Palgu reads.
// `catalogue`: route values `/route <prefix>` and the band can pick. `primary`: model-config.json's primary.
const PALGU_LIKE = {
  catalogue: PALGU_MODELS,
  families: familiesOf(PALGU_MODELS),
  routes: routesOf('glm-5.3', 'deepseek-pro'),
  primary: { glm: 'glm-5.3', kimi: 'kimi-k3.1-pro', deepseek: 'deepseek-pro' },
}

const OPENROUTER = {
  catalogue: ['glm/5.3', 'kimi/pro', 'deepseek/v4-pro', 'gemini/3.8-flash', 'minimax/m3', 'gpt/sol', 'mercury/3'],
  families: OPENROUTER_FAMILIES,
  routes: routesOf('glm/5.3', 'kimi/pro'),
  primary: { glm: 'glm/5.3', kimi: 'kimi/pro', deepseek: 'deepseek/v4-pro' },
}

const DEFAULTS = {
  palgu: { auth: 'x-api-key', identify: true, ...PALGU_LIKE },
  openrouter: { auth: 'bearer', identify: false, ...OPENROUTER },
  litellm: { auth: 'bearer', identify: false, ...PALGU_LIKE },
  'anthropic-compatible': { auth: 'x-api-key', identify: true, ...PALGU_LIKE },
}

export function providerDefaults(name) {
  return DEFAULTS[name] || DEFAULTS['anthropic-compatible']
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

const onHost = (host, domain) => host === domain || host.endsWith('.' + domain)

// An explicit provider wins; `auto` (or anything unknown) detects Palgu and OpenRouter by host.
// LiteLLM runs on your own host, so it is never detected: name it with gateway_provider.
export function providerOf(url, choice) {
  if (PROVIDERS.includes(choice)) return choice
  const host = hostOf(url)
  if (onHost(host, 'palgu.ai')) return 'palgu'
  if (onHost(host, 'openrouter.ai')) return 'openrouter'
  return 'anthropic-compatible'
}
