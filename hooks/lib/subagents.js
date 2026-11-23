// Which Claude model a subagent runs on. A subagent runs inside the main Claude Code process, on the
// main session's own Anthropic connection, so only a Claude model can be chosen (ADR 0001: the main
// session is never re-pointed). The task is scored like a prompt; a simple one runs on Haiku, coding on
// Sonnet, a critical one keeps the parent's model. Only ever cheaper than the parent's. Pure.

const RULES = ['auto', 'simple', 'coding', 'critical']
const RANKS = [['haiku', 1], ['sonnet', 2], ['opus', 3]]
const ALIAS = /^(claude-)?(haiku|sonnet|opus)(-[a-z0-9.-]+)?$/

function rankOf(model) {
  const hit = RANKS.find(([name]) => String(model || '').toLowerCase().includes(name))
  return hit ? hit[1] : 0
}

// router.subagents' rule for this spawn ('auto' or a tier), or '' to leave it to Claude Code. Only a
// built-in agent: a plugin's or your own may set `model:` in its definition, which the event does not show.
export function subagentRule(spawn, rules) {
  if (spawn.model || spawn.fork || spawn.isTeammate || spawn.workflow) return ''
  if (!spawn.provider || spawn.provider.plugin !== 'engine') return ''
  const rule = String((rules || {})[spawn.subagentType] || '')
  return RULES.includes(rule) ? rule : ''
}

// The model for a subagent of `label`, or '' to keep what Claude Code picks: critical, a tier model
// that is not a plain Claude alias, or one no cheaper than the parent's.
export function subagentModel(label, parentModel, models) {
  const model = String((models || {})[label] || '')
  if (!model || !ALIAS.test(model)) return ''
  const parent = rankOf(parentModel)
  return parent && rankOf(model) < parent ? model : ''
}
