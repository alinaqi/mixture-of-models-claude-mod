// Prompt classification: the rules Maggy's route-task-hook applies before
// asking a model, the blast-score prompt, and the Ollama wire format. Pure.

const CONTINUATIONS = new Set([
  'go ahead', 'go', 'go on', 'continue', 'proceed', 'keep going', 'carry on', 'do it', 'run it', 'run',
  'ok', 'okay', 'k', 'yes', 'yep', 'yeah', 'yes please', 'sure', 'next', 'next step', 'start', 'begin', 'execute',
])
const EXECUTION_INTENT = /validate[- ]plan|execute the plan|run the plan|implement the plan|start executing|begin implementation/
const ANALYSIS_INTENT = /^(review|summari[sz]e|explain|compare|research|describe|what does|how does)\b/
const SHORT_WORDS = 6

// The classifier answers with one of these; a label the model can't miss.
export const SCORES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

function normalize(text) {
  return text.toLowerCase().trim().replace(/[.!?]+$/, '')
}

// What to do with a prompt before any model is asked.
export function preClassify(text, lastHadTools) {
  const lower = normalize(text)
  if (lower.startsWith('/')) return { kind: 'skip' }
  if (/\buse claude\b/.test(lower) || EXECUTION_INTENT.test(lower)) return { kind: 'label', label: 'critical' }
  if (ANALYSIS_INTENT.test(lower)) return { kind: 'label', label: 'analysis' }
  if (CONTINUATIONS.has(lower)) return { kind: 'sticky' }
  const words = lower.split(/\s+/).filter(Boolean).length
  if (words <= SHORT_WORDS && lastHadTools) return { kind: 'sticky' }
  return { kind: 'classify' }
}

// Maggy's blast score: how much damage a wrong answer does, not how long the task is.
export function classifierPrompt(text) {
  return [
    'Rate the blast radius of this coding-assistant task from 1-10. Reply with the number only.',
    '1-2: lookups, grep, shell one-liners, syntax questions, reading logs, git status or diff.',
    '3-4: single-file edits, tests, docs, config changes, small bug fixes, scaffolding.',
    '5-6: multi-file features, wiring services or tools together, integrations, deployments that follow a known pattern.',
    '7-8: debugging across services, data migrations, performance work, changes that are awkward to undo.',
    '9-10: security or auth design, architecture decisions, production incidents, anything irreversible.',
    'Length, the number of services named, or pasted API keys do not raise the score by themselves.',
    '',
    'Task: ' + text,
  ].join('\n')
}

export function parseScore(raw) {
  const match = (raw || '').match(/\b([1-9]|10)\b/)
  return match ? Number(match[1]) : undefined
}

export function labelFor(score, thresholds) {
  if (score <= thresholds.simple) return 'simple'
  return score <= thresholds.coding ? 'coding' : 'critical'
}

export function ollamaBody(model, prompt) {
  return JSON.stringify({
    model,
    stream: false,
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: 0.1, num_predict: 8 },
  })
}

export function ollamaReply(text) {
  try {
    return JSON.parse(text).message.content || ''
  } catch {
    return ''
  }
}
