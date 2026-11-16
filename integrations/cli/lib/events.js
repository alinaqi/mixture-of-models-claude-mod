// What a tool's hook sends on stdin, read into one shape, and what mom answers, written in that
// tool's shape (ADR 0005). Pure.

export const TOOLS = ['codex', 'cursor']

// Each tool's event names, mapped to mom's: start (session start), prompt (prompt submit), answer
// (the agent's answer, for a tool whose stop event lacks it) and stop.
const KINDS = {
  codex: { SessionStart: 'start', UserPromptSubmit: 'prompt', Stop: 'stop' },
  cursor: { sessionStart: 'start', beforeSubmitPrompt: 'prompt', afterAgentResponse: 'answer', stop: 'stop' }
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

// Cursor: one conversation across turns (conversation_id), the first workspace root as the project.
// Its stop says only how the turn ended; the answer came earlier, in afterAgentResponse. A turn the
// person aborted or that failed is not a stop to heal. beforeSubmitPrompt cannot add context, so
// recall is off on prompt submit (memory goes through the MCP tool instead).
function fromCursor(e, kind) {
  if (kind === 'stop' && e.status !== 'completed') return null
  const roots = Array.isArray(e.workspace_roots) ? e.workspace_roots : []
  const answer = kind === 'answer' ? String(e.text || '') : ''
  return { kind, session: String(e.conversation_id || e.session_id || ''), cwd: String(roots[0] || ''), prompt: String(e.prompt || ''), answer, continued: Number(e.loop_count) > 0, recall: false }
}

const READERS = { codex: fromCodex, cursor: fromCursor }

// { kind, session, cwd, prompt, answer, continued[, recall] }, or null when mom has nothing to do with it.
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

function cursorOut(kind, r) {
  if (kind === 'start' && r.note) return { additional_context: r.note }
  if (kind === 'prompt') return { continue: true }
  if (kind === 'stop' && r.reason) return { followup_message: r.reason }
  return null
}

const WRITERS = { codex: codexOut, cursor: cursorOut }

// The hook's stdout: JSON in the tool's shape, or '' (the tool goes on as if there were no hook).
export function render(tool, kind, result) {
  const out = WRITERS[tool] ? WRITERS[tool](kind, result || {}) : null
  return out ? JSON.stringify(out) : ''
}
