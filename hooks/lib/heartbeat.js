// The heartbeat: when the main session stops mid-task (it announced an action and ended, or
// described edits instead of making them), continue it, a bounded number of times per prompt.
// Palgu's POST /anthropic/heartbeat decides when the gateway is Palgu (issue #25, srooter ADR-048);
// otherwise, or when Palgu does not answer, the same classifier runs here. Pure.

// Palgu's own continue prompts (srooter api/anthropic_native.py).
export const REASONS = {
  premature: 'You stopped mid-task — continue from where you left off and finish the work, or end with a question if you genuinely need input.',
  narration: 'You described the changes but did not apply them. Make the edits now using the Write/Edit tools and run the project — do not just describe what to do.',
}

// Palgu's classifier (srooter engine/heartbeat.py), ported as is.
const ACTION = '(check|look|read|list|run|search|find|wire|implement|add|create|fix|update|inspect|examine|explore|start|build|write|modify|review|see|verify|test|scan|fetch|generate|map|parse|refactor|set up|configure|continue|trace|debug|analy[sz]e|investigate|open|grep)'
const ANNOUNCE = '(let me|let\'s|let us|i\'?ll|i will|i\'?m going to|going to|next,?\\s+i|now\\s+i\'?ll|first,?\\s+i|then\\s+i)'
const MID_INTENT = new RegExp(':\\s*$|\\b' + ANNOUNCE + '\\b(?:\\s+\\w+){0,4}?\\s+' + ACTION + '\\b|\\b(searching|looking|checking|running|listing|scanning|inspecting|examining|tracing|grepping) for\\b', 'i')
const NARRATION = new RegExp([
  '\\bapply (?:the |these )?(?:edit|change|patch|diff|fix|update|following)',
  '\\bhere(?:\'?s| is| are)\\s+(?:the\\s+)?(?:change|edit|code|patch|diff|fix|snippet)\\w*\\s+(?:to|you|that|below)',
  '\\byou(?:\'?ll| will| should| can| could| need to| must|\'?d)\\b(?:\\s+\\w+){0,3}?\\s+(?:add|create|update|modify|change|wire|insert|replace|paste|put|write|apply)\\b',
  '\\breplace\\b.{1,80}?\\bwith\\b',
  '\\bcreate (?:a |the )?(?:new )?(?:file|module|function|class|method)\\b',
  '^\\s*---\\s+a/|^\\s*\\+\\+\\+\\s+b/|^\\s*@@ ',
].join('|'), 'im')

// 'premature' | 'narration' | 'question' | 'complete'. `usedTools`: the turn made a tool call.
export function assessStop(answer, usedTools) {
  const text = String(answer || '').trim()
  if (!text) return 'premature'
  if (text.endsWith('?')) return 'question'
  if (!usedTools && NARRATION.test(text)) return 'narration'
  const lines = text.split('\n')
  return MID_INTENT.test(lines[lines.length - 1].slice(-200)) ? 'premature' : 'complete'
}

// What Palgu reads: the session (one id per prompt, so its budget never carries over), the tail.
export function heartbeatBody(sessionId, answer) {
  return { session_id: sessionId, text: String(answer || '').slice(-600), stop_reason: 'end_turn', tools_present: true }
}

// { assessment, reason } from Palgu, reason '' when it says stop; null when there is no usable answer.
export function palguVerdict(res) {
  if (!res || !res.ok) return null
  try {
    const v = JSON.parse(res.text)
    const reason = v.should_continue === true ? String(v.reason || '') : ''
    if (v.should_continue === true && !reason) return null
    return typeof v.should_continue === 'boolean' ? { assessment: String(v.assessment || ''), reason } : null
  } catch {
    return null
  }
}

export function localVerdict(answer, usedTools) {
  const assessment = assessStop(answer, usedTools)
  return { assessment, reason: REASONS[assessment] || '' }
}

export const HEARTBEAT_MODES = ['palgu', 'local', 'off']

// router.heartbeat: 'palgu' (default), 'local' or 'off' (false too). Palgu only on a Palgu gateway.
export function heartbeatMode(setting, onPalgu) {
  if (setting === false || setting === 'off') return 'off'
  if (setting === 'local' || !onPalgu) return 'local'
  return 'palgu'
}

// turn: the turn.complete input. s: { mode, used, max, child }. An interrupted, refused or failed
// turn is not a stop to heal; a child's answer is vetted for narration already (vet.js).
export function shouldCheck(turn, s) {
  if (s.mode === 'off' || s.child || turn.agentId || turn.isAborted) return false
  return (turn.reason === undefined || turn.reason === 'answer') && s.used < s.max
}

// Whether this turn called a tool: the assistant messages after the person's last prompt (a user
// message that is not tool results).
export function turnUsedTools(messages) {
  for (let i = (messages || []).length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role === 'user' && !(m.toolResults || []).length) return false
    if (m.role === 'assistant' && (m.toolUses || []).length) return true
  }
  return false
}
