// An agent's last answer, read from its transcript, for a tool whose stop hook does not carry it
// (Antigravity: JSONL steps, the model's answers as PLANNER_RESPONSE). Pure.

function stepOf(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

export function lastAnswer(text) {
  const lines = String(text || '').split('\n')
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const s = stepOf(lines[i])
    if (s && s.type === 'PLANNER_RESPONSE' && typeof s.content === 'string') return s.content
  }
  return ''
}
