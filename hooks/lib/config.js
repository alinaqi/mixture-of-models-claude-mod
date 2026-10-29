// Routing configuration: defaults and the ~/.claude/model-config.json overlay.
// Pure: no mods API here, so every function is unit-testable.
import { PALGU_MODELS, PROVIDERS, providerDefaults, providerOf } from './providers.js'

export const LABELS = ['simple', 'coding', 'critical']

// The defaults with no gateway, or a generic one: Palgu's model ids. Each provider's own
// routes, families and catalogue come from providers.js.
const GENERIC = providerDefaults('anthropic-compatible')

// Tier → model, and kind → model for the non-critical tiers. 'claude' means "keep the session's own model".
export const DEFAULT_ROUTES = GENERIC.routes

// Models the gateway serves that a pin or a route may name; `/route <prefix>` expands to the
// first one that matches when no configured route does.
export const GATEWAY_MODELS = PALGU_MODELS

const CLAUDE_FAMILY = {
  members: { fable: 'claude-fable-5-1', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' },
  auto: { simple: 'haiku', coding: 'sonnet', critical: 'opus' },
}

// `<family>/<member>` and `<family>/auto` route values. `auto` maps a tier to a member, and
// `criticalPlus` (opt-in) to the member a 10/10 critical turn takes. Codex takes any model id.
function familiesFor(p) {
  return { claude: CLAUDE_FAMILY, ...p.families, codex: { members: {}, auto: {} } }
}

export const DEFAULT_FAMILIES = familiesFor(GENERIC)

// Maggy's "followed" primary, as model-config.json names it, to the route the provider resolves.
// `claude` is deliberately absent: following Claude keeps critical work there, not coding work.
export const PRIMARY_MODELS = GENERIC.primary

export const DEFAULTS = {
  // Which gateway the child talks to: palgu, openrouter, litellm or anthropic-compatible (providers.js).
  provider: 'anthropic-compatible',
  catalogue: GATEWAY_MODELS,
  routes: DEFAULT_ROUTES,
  subagents: { Explore: 'simple' },
  // Blast score 1-10 → tier: ≤ simple is simple, ≤ coding is coding, above is critical.
  thresholds: { simple: 3, coding: 7 },
  ollama: { model: 'qwen2.5-coder:3b' },
  // Fallback classifier when Ollama is down. Undated alias: Claude Code resolves it to the current snapshot.
  classifier: 'claude-haiku-4-5',
  // The delegate: a headless claude on the gateway, in its own process and environment.
  child: {
    baseUrl: '',
    // --bare: no inherited hooks or plugins, strictly API-key auth, so the child never touches the subscription.
    args: ['--bare', '--permission-mode', 'acceptEdits'],
    maxTurns: 25,
    timeoutMs: 600000,
    // Retries per failed gateway request (Claude Code's own default is 10, minutes of backoff).
    maxRetries: 2,
    contextMessages: 12,
    // How many times a routed turn may pause to ask the user about commands the child was refused.
    relayRounds: 2,
    // A Claude-family member runs on your subscription: no --bare, which would force API-key auth.
    subscriptionArgs: ['--permission-mode', 'acceptEdits'],
    // Extra permission deny rules for every Claude child, on top of child.js SECRET_DENY.
    deny: [],
    // How the gateway child sends its key (x-api-key or bearer), and whether it sends the
    // x-srooter-* headers. Set from the provider; router.child.auth overrides.
    auth: GENERIC.auth,
    identify: GENERIC.identify,
  },
  families: DEFAULT_FAMILIES,
  // The Codex child: `palgu` sends it to the gateway's /v1/responses with your gateway key,
  // `chatgpt` leaves it on your own Codex login and config. baseUrl overrides the derived /v1 URL.
  // sandbox: read-only unless you opt in (codex exec cannot ask before a write); allowOutsideGit
  // adds --skip-git-repo-check; args adds flags but never widens the sandbox (codex.js).
  codex: { auth: 'palgu', baseUrl: '', sandbox: 'read-only', allowOutsideGit: false, args: [] },
  // The band above the prompt, and which replies get a provenance tag: 'routed', 'all' or 'off'.
  ui: { band: true, tags: 'routed' },
  summary: true,
  // $ per million tokens for gateway models, for the savings estimate: { "<id>": { input, output } }.
  prices: {},
  // The routing strategy (router.strategy): a built-in or one of yours; '' is the default, complexity.
  strategyName: '',
}

function parseJson(text) {
  try {
    return JSON.parse(text || '{}')
  } catch {
    return {}
  }
}

function mergeFamilies(own, base) {
  const out = { ...base }
  for (const [name, f] of Object.entries(own || {})) {
    const b = base[name] || { members: {}, auto: {} }
    out[name] = { members: { ...b.members, ...(f.members || {}) }, auto: { ...b.auto, ...(f.auto || {}) } }
  }
  return out
}

function mergeRoutes(raw, p) {
  const own = (raw.router || {}).routes || {}
  const routes = { ...p.routes, ...own, kinds: { ...p.routes.kinds, ...(own.kinds || {}) } }
  if (raw.primary && !own.coding && p.primary[raw.primary]) routes.coding = p.primary[raw.primary]
  return routes
}

// The provider: gateway_provider from the plugin's options, else router.provider, else detected
// from the gateway URL (the option's, else router.child.baseUrl).
function providerFrom(router, options) {
  const o = options || {}
  const choice = PROVIDERS.includes(o.gateway_provider) ? o.gateway_provider : router.provider
  return providerOf(o.gateway_url || (router.child || {}).baseUrl || '', choice)
}

export function parseConfig(text, options) {
  const raw = parseJson(text)
  const router = raw.router || {}
  const provider = providerFrom(router, options)
  const p = providerDefaults(provider)
  return {
    provider,
    catalogue: p.catalogue,
    routes: mergeRoutes(raw, p),
    subagents: { ...DEFAULTS.subagents, ...(router.subagents || {}) },
    thresholds: { ...DEFAULTS.thresholds, ...(router.thresholds || {}) },
    ollama: { ...DEFAULTS.ollama, ...(router.ollama || {}) },
    classifier: router.classifier || DEFAULTS.classifier,
    child: { ...DEFAULTS.child, auth: p.auth, identify: p.identify, ...(router.child || {}) },
    families: mergeFamilies(router.families, familiesFor(p)),
    codex: { ...DEFAULTS.codex, ...(router.codex || {}) },
    ui: { ...DEFAULTS.ui, ...(router.ui || {}) },
    summary: router.summary === undefined ? DEFAULTS.summary : router.summary,
    prices: { ...DEFAULTS.prices, ...(router.prices || {}) },
    strategyName: String(router.strategy || DEFAULTS.strategyName),
  }
}
