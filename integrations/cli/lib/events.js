// What a tool's hook sends on stdin, read into one shape, and what mom answers, written in that
// tool's shape (ADR 0005). Pure.

export const TOOLS = ['codex', 'cursor', 'antigravity']

// Each tool's event names, mapped to mom's: start (session start), prompt (prompt submit), answer
// (the agent's answer, for a tool whose stop event lacks it) and stop.
const KINDS = {
  codex: { SessionStart: 'start', UserPromptSubmit: 'prompt', Stop: 'stop' },
  cursor: { sessionStart: 'start', beforeSubmitPrompt: 'prompt', afterAgentResponse: 'answer', stop: 'stop' },
  antigravity: { SessionStart: 'start', PreInvocation: 'prompt', Stop: 'stop' }
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
  // null: this event does not carry the answer (decide.js reads the one afterAgentResponse kept).
  const answer = kind === 'answer' ? String(e.text || '') : kind === 'stop' ? null : ''
  return { kind, session: String(e.conversation_id || e.session_id || ''), cwd: String(roots[0] || ''), prompt: String(e.prompt || ''), answer, continued: Number(e.loop_count) > 0, recall: false }
}

// Antigravity: camelCase input with no event name (the hook command names it). PreInvocation runs
// before every model call of a turn; only the first (invocationNum 0) is the person's prompt. Stop
// carries no answer, only the transcript's path (hook.js reads the answer from it). A stop that
// was not the model's own, or that failed, is not healed.
// Seen live (agy 1.0.7): a turn that ends with an answer stops with NO_TOOL_CALL (its docs say
// model_stop), a failed one with ERROR; the input does carry hookEventName and cwd.
const MODEL_STOPS = ['no_tool_call', 'model_stop']

function fromAntigravity(e, kind) {
  if (kind === 'prompt' && Number(e.invocationNum) !== 0) return null
  if (kind === 'stop' && (!MODEL_STOPS.includes(String(e.terminationReason).toLowerCase()) || e.error)) return null
  const roots = Array.isArray(e.workspacePaths) ? e.workspacePaths : []
  const continued = e.continuationActive === true || e.continuation_active === true
  return { kind, session: String(e.conversationId || ''), cwd: String(e.cwd || roots[0] || ''), prompt: String(e.lastUserInput || ''), answer: kind === 'stop' ? null : '', continued, transcript: String(e.transcriptPath || '') }
}

const READERS = { codex: fromCodex, cursor: fromCursor, antigravity: fromAntigravity }

// { kind, session, cwd, prompt, answer, continued[, recall] }, or null when mom has nothing to do with it.
// `event`: the event's name from the hook command, for a tool whose input does not carry it.
export function parseEvent(tool, raw, event) {
  const e = readJson(raw)
  const kind = e && KINDS[tool] && KINDS[tool][e.hook_event_name || e.hookEventName || event]
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

function antigravityOut(kind, r) {
  if (kind === 'prompt' && r.context) return { injectSteps: [{ ephemeralMessage: r.context }] }
  if (kind === 'stop' && r.reason) return { decision: 'continue', reason: r.reason }
  return null
}

const WRITERS = { codex: codexOut, cursor: cursorOut, antigravity: antigravityOut }

// The hook's stdout: JSON in the tool's shape, or '' (the tool goes on as if there were no hook).
export function render(tool, kind, result) {
  const out = WRITERS[tool] ? WRITERS[tool](kind, result || {}) : null
  return out ? JSON.stringify(out) : ''
}
