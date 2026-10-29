// Routing configuration: defaults and the ~/.claude/model-config.json overlay.
// Pure: no mods API here, so every function is unit-testable.

export const LABELS = ['simple', 'coding', 'critical']

// Tier → model, and kind → model for the non-critical tiers. 'claude' means "keep the session's own model".
export const DEFAULT_ROUTES = {
  simple: 'glm-5.3',
  coding: 'glm-5.3',
  critical: 'claude',
  kinds: { research: 'kimi-k3.1-pro', review: 'kimi-k3.1-pro', multimodal: 'claude' },
}

// Models the gateway serves that a pin or a route may name; `/route <prefix>` expands to the
// first one that matches when no configured route does. mercury-3 (Inception) is an option
// only: no default route uses it until its speed and quality are measured. gemini-3.8-flash is
// the gateway's vision/video model, also an option only.
export const GATEWAY_MODELS = ['glm-5.3', 'kimi-k3.1-pro', 'kimi-k3.1-pro-highspeed', 'deepseek-v4-pro', 'mercury-3', 'gemini-3.8-flash']

// A gateway family per provider prefix in the catalogue, members named by what follows it.
function gatewayFamilies(models) {
  const out = {}
  for (const id of models) {
    const family = id.split('-')[0]
    out[family] = out[family] || { members: {}, auto: {} }
    out[family].members[id.slice(family.length + 1)] = id
  }
  return out
}

// `<family>/<member>` and `<family>/auto` route values. `auto` maps a tier to a member, and
// `criticalPlus` (opt-in) to the member a 10/10 critical turn takes. Codex takes any model id.
export const DEFAULT_FAMILIES = {
  claude: {
    members: { fable: 'claude-fable-5-1', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' },
    auto: { simple: 'haiku', coding: 'sonnet', critical: 'opus' },
  },
  ...gatewayFamilies(GATEWAY_MODELS),
  kimi: { members: { pro: 'kimi-k3.1-pro', highspeed: 'kimi-k3.1-pro-highspeed' }, auto: { simple: 'highspeed', coding: 'pro', critical: 'pro' } },
  codex: { members: {}, auto: {} },
}

// Maggy's "followed" primary, as model-config.json names it, to the model id a gateway resolves.
// `claude` is deliberately absent: following Claude keeps critical work there, not coding work.
export const PRIMARY_MODELS = {
  glm: 'glm-5.3',
  kimi: 'kimi-k3.1-pro',
  deepseek: 'deepseek-v4-pro',
}

export const DEFAULTS = {
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
    contextMessages: 12,
    // How many times a routed turn may pause to ask the user about commands the child was refused.
    relayRounds: 2,
    // A Claude-family member runs on your subscription: no --bare, which would force API-key auth.
    subscriptionArgs: ['--permission-mode', 'acceptEdits'],
    // Extra permission deny rules for every Claude child, on top of child.js SECRET_DENY.
    deny: [],
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
}

function parseJson(text) {
  try {
    return JSON.parse(text || '{}')
  } catch {
    return {}
  }
}

function codingRoute(primary, routes) {
  const model = PRIMARY_MODELS[primary]
  if (!model) return routes.coding
  return model
}

function mergeFamilies(own) {
  const out = { ...DEFAULT_FAMILIES }
  for (const [name, f] of Object.entries(own || {})) {
    const base = DEFAULT_FAMILIES[name] || { members: {}, auto: {} }
    out[name] = { members: { ...base.members, ...(f.members || {}) }, auto: { ...base.auto, ...(f.auto || {}) } }
  }
  return out
}

export function parseConfig(text) {
  const raw = parseJson(text)
  const router = raw.router || {}
  const routes = { ...DEFAULT_ROUTES, ...(router.routes || {}), kinds: { ...DEFAULT_ROUTES.kinds, ...((router.routes || {}).kinds || {}) } }
  if (raw.primary && !(router.routes || {}).coding) routes.coding = codingRoute(raw.primary, routes)
  return {
    routes,
    subagents: { ...DEFAULTS.subagents, ...(router.subagents || {}) },
    thresholds: { ...DEFAULTS.thresholds, ...(router.thresholds || {}) },
    ollama: { ...DEFAULTS.ollama, ...(router.ollama || {}) },
    classifier: router.classifier || DEFAULTS.classifier,
    child: { ...DEFAULTS.child, ...(router.child || {}) },
    families: mergeFamilies(router.families),
    codex: { ...DEFAULTS.codex, ...(router.codex || {}) },
    ui: { ...DEFAULTS.ui, ...(router.ui || {}) },
    summary: router.summary === undefined ? DEFAULTS.summary : router.summary,
    prices: { ...DEFAULTS.prices, ...(router.prices || {}) },
  }
}
