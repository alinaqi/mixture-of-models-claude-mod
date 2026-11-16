// An agent's last answer, read from its transcript, for a tool whose stop hook does not carry it.
// Both are JSONL: Antigravity's steps keep the model's answers as PLANNER_RESPONSE `content`,
// Copilot CLI's events as assistant.message `data.content` (empty when the message is only tool
// calls). Pure.

function stepOf(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function answerOf(s) {
  if (!s) return ''
  if (s.type === 'PLANNER_RESPONSE' && typeof s.content === 'string') return s.content
  if (s.type === 'assistant.message' && s.data && typeof s.data.content === 'string') return s.data.content
  return ''
}

export function lastAnswer(text) {
  const lines = String(text || '').split('\n')
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const s = stepOf(lines[i])
    const text = answerOf(s)
    if (text) return text
  }
  return ''
}
