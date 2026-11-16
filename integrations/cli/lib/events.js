// What a tool's hook sends on stdin, read into one shape, and what mom answers, written in that
// tool's shape (ADR 0005). Pure.

export const TOOLS = ['codex']

// Each tool's event names, mapped to mom's three: start (session start), prompt (prompt submit), stop.
const KINDS = {
  codex: { SessionStart: 'start', UserPromptSubmit: 'prompt', Stop: 'stop' }
}

function readJson(raw) {
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

function fromCodex(e, kind) {
  return { kind, session: String(e.session_id || ''), cwd: String(e.cwd || ''), prompt: String(e.prompt || ''), answer: String(e.last_assistant_message || ''), continued: e.stop_hook_active === true }
}

const READERS = { codex: fromCodex }

// { kind, session, cwd, prompt, answer, continued }, or null when mom has nothing to do with it.
export function parseEvent(tool, raw) {
  const e = readJson(raw)
  const kind = e && KINDS[tool] && KINDS[tool][e.hook_event_name]
  return kind ? READERS[tool](e, kind) : null
}

function codexOut(kind, r) {
  if (kind === 'prompt' && r.context) return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: r.context } }
  if (kind === 'stop' && r.reason) return { decision: 'block', reason: r.reason }
  return null
}

const WRITERS = { codex: codexOut }

// The hook's stdout: JSON in the tool's shape, or '' (the tool goes on as if there were no hook).
export function render(tool, kind, result) {
  const out = WRITERS[tool] ? WRITERS[tool](kind, result || {}) : null
  return out ? JSON.stringify(out) : ''
}
