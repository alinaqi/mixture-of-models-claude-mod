// Routing strategies: what the classifier scores and what each tier runs on. A strategy is a
// markdown file like a skill: JSON frontmatter (name, description, score, thresholds, routes) and a
// rubric body that tells the classifier what each score means. The reply stays "<score> <kind>", so
// the pre-classify safety rules, tiers, families and failure memory work the same for every one. Pure.
import { COMPLEXITY_RUBRIC, promptWith } from './classify.js'

export const STRATEGY_DIR = '/.claude/mixture-of-models/strategies'

// Routes name family members, so each strategy works on Palgu, OpenRouter and LiteLLM alike.
export const BUILTIN = {
  complexity: {
    name: 'complexity',
    description: 'Route by blast radius, how much a wrong answer could break (the default).',
    score: 'blast radius',
    rubric: COMPLEXITY_RUBRIC,
  },
  cost: {
    name: 'cost',
    description: 'Send as much as possible to the cheapest models; only risky work stays on Claude.',
    score: 'risk',
    thresholds: { simple: 4, coding: 8 },
    routes: { simple: 'glm/5.3', coding: 'deepseek/v4-pro', critical: 'claude', kinds: { research: 'kimi/pro', review: 'kimi/pro', docs: 'glm/5.3', multimodal: 'gemini/3.8-flash' } },
    rubric: [
      'Risk: how bad a wrong answer from a cheaper model would be. When unsure, score lower: the cheapest capable model should take it.',
      '1-4: lookups, explanations, docs, tests, single-file edits, config, small fixes, scaffolding.',
      '5-8: multi-file features, integrations, refactors that tests cover, debugging inside one service.',
      '9-10: security or auth, production incidents, data migrations, architecture, anything irreversible.',
    ].join('\n'),
  },
  speed: {
    name: 'speed',
    description: 'Fastest answers: quick models for most work, Sonnet rather than Opus for the hard part.',
    score: 'reasoning depth',
    thresholds: { simple: 3, coding: 7 },
    routes: { simple: 'mercury/3', coding: 'kimi/auto', critical: 'claude/sonnet', kinds: { research: 'gemini/3.8-flash', multimodal: 'gemini/3.8-flash' } },
    rubric: [
      'Reasoning depth: how much careful thinking the task needs. Fast models take everything they can answer well.',
      '1-3: lookups, one-liners, quick edits, short explanations.',
      '4-7: ordinary features, tests, docs, reviews of a few files.',
      '8-10: hard debugging, concurrency, security, architecture, anything irreversible.',
    ].join('\n'),
  },
  quality: {
    name: 'quality',
    description: 'Keep most work on Claude: only lookups and small, low-stakes edits leave it.',
    score: 'stakes',
    thresholds: { simple: 2, coding: 5 },
    routes: { simple: 'glm/5.3', coding: 'claude/sonnet', critical: 'claude' },
    rubric: [
      'Stakes: how much it matters that the answer is exactly right. When unsure, score higher: Claude takes it.',
      '1-2: lookups, grep, reading logs, syntax questions.',
      '3-5: docs, tests, single-file edits, small fixes.',
      '6-10: features, refactors, debugging, migrations, security, architecture.',
    ].join('\n'),
  },
}

export function strategyPrompt(strategy, text) {
  return promptWith(strategy.score || 'score', strategy.rubric, text)
}

function fieldsOf(head) {
  const out = {}
  for (const line of head.split('\n')) {
    const at = line.indexOf(':')
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return out
}

function json(fields, key) {
  if (!fields[key]) return {}
  try {
    return { value: JSON.parse(fields[key]) }
  } catch {
    return { error: key + ' is not JSON: write it as {"simple": "glm/5.3"}' }
  }
}

function checkThresholds(t) {
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 9
  return !t || (ok(t.simple) && ok(t.coding) && t.simple < t.coding) ? '' : 'thresholds: simple must be below coding, both 1-9'
}

// A strategy file, or { error } saying what to fix. `fallbackName` is the file's name.
export function parseStrategy(text, fallbackName) {
  const m = String(text || '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { error: 'no frontmatter: start the file with a --- block' }
  const fields = fieldsOf(m[1])
  const thresholds = json(fields, 'thresholds'), routes = json(fields, 'routes')
  const error = thresholds.error || routes.error || checkThresholds(thresholds.value)
  if (error) return { error }
  const rubric = m[2].trim()
  if (!rubric) return { error: 'no rubric: say below the frontmatter what each score means' }
  const name = String(fields.name || fallbackName).toLowerCase()
  return { name, description: fields.description || '', score: fields.score || 'score', thresholds: thresholds.value, routes: routes.value, rubric }
}

// The config with the strategy's thresholds and routes over it; kinds merge, so a strategy can
// change one kind and keep the rest.
export function applyStrategy(cfg, strategy) {
  if (!strategy) return cfg
  const own = strategy.routes || {}
  const routes = { ...cfg.routes, ...own, kinds: { ...cfg.routes.kinds, ...(own.kinds || {}) } }
  return { ...cfg, thresholds: { ...cfg.thresholds, ...(strategy.thresholds || {}) }, routes, strategy }
}

export function strategiesText(all, current, dir) {
  const rows = Object.values(all).map((s) => (s.name === current ? '* ' : '  ') + s.name + (BUILTIN[s.name] === s ? '' : ' (yours)') + ' · ' + s.description)
  return ['routing strategies (/route strategy <name> to switch):', ...rows,
    'Write your own in ' + dir + '/<name>.md, or ask Claude to use the routing-strategy skill.'].join('\n')
}
