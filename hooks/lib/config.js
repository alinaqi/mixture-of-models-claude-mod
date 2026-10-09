// Routing configuration: defaults and the ~/.claude/model-config.json overlay.
// Pure: no mods API here, so every function is unit-testable.

export const LABELS = ['simple', 'coding', 'analysis', 'critical']

// 'claude' means "keep the session's own model".
export const DEFAULT_ROUTES = {
  simple: 'glm-5.3',
  coding: 'glm-5.3',
  analysis: 'kimi-k3',
  critical: 'claude',
}

// Maggy's "followed" primary, as model-config.json names it, to the model id a gateway resolves.
// `claude` is deliberately absent: following Claude keeps critical work there, not coding work.
export const PRIMARY_MODELS = {
  glm: 'glm-5.3',
  kimi: 'kimi-k3',
  deepseek: 'deepseek-v4-pro',
}

export const DEFAULTS = {
  routes: DEFAULT_ROUTES,
  subagents: { Explore: 'simple' },
  // Blast score 1-10 → tier: ≤ simple is simple, ≤ coding is coding, above is critical.
  thresholds: { simple: 3, coding: 7 },
  ollama: { base: 'http://localhost:11434', model: 'qwen2.5-coder:3b' },
  // Fallback classifier when Ollama is down. Undated alias: Claude Code resolves it to the current snapshot.
  classifier: 'claude-haiku-4-5',
  // The delegate: a headless claude on the gateway, in its own process and environment.
  child: {
    command: ['claude'],
    baseUrl: '',
    keyFile: '~/.maggy/.env',
    keyVar: 'SROOTER_API_KEY',
    // --bare: no inherited hooks or plugins, strictly API-key auth, so the child never touches the subscription.
    args: ['--bare', '--permission-mode', 'acceptEdits'],
    maxTurns: 25,
    timeoutMs: 600000,
    contextMessages: 6,
  },
  // The band above the prompt, and which replies get a provenance tag: 'routed', 'all' or 'off'.
  ui: { band: true, tags: 'routed' },
  summary: true,
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

export function parseConfig(text) {
  const raw = parseJson(text)
  const router = raw.router || {}
  const routes = { ...DEFAULT_ROUTES, ...(router.routes || {}) }
  if (raw.primary && !(router.routes || {}).coding) routes.coding = codingRoute(raw.primary, routes)
  return {
    routes,
    subagents: { ...DEFAULTS.subagents, ...(router.subagents || {}) },
    thresholds: { ...DEFAULTS.thresholds, ...(router.thresholds || {}) },
    ollama: { ...DEFAULTS.ollama, ...(router.ollama || {}) },
    classifier: router.classifier || DEFAULTS.classifier,
    child: { ...DEFAULTS.child, ...(router.child || {}) },
    ui: { ...DEFAULTS.ui, ...(router.ui || {}) },
    summary: router.summary === undefined ? DEFAULTS.summary : router.summary,
  }
}
