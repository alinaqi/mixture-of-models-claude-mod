// Prompt classification: the heuristics Maggy's route-task-hook applies before
// asking a model, the classifier prompt, and the Ollama wire format. Pure.
import { LABELS } from './config.js'

const CONTINUATIONS = new Set([
  'go ahead', 'go', 'go on', 'continue', 'proceed', 'keep going', 'carry on', 'do it', 'run it', 'run',
  'ok', 'okay', 'k', 'yes', 'yep', 'yeah', 'yes please', 'sure', 'next', 'next step', 'start', 'begin', 'execute',
])
const EXECUTION_INTENT = /validate[- ]plan|execute the plan|run the plan|implement the plan|start executing|begin implementation/
const SHORT_WORDS = 6

function normalize(text) {
  return text.toLowerCase().trim().replace(/[.!?]+$/, '')
}

// What to do with a prompt before any model is asked.
export function preClassify(text, lastHadTools) {
  const lower = normalize(text)
  if (lower.startsWith('/')) return { kind: 'skip' }
  if (/\buse claude\b/.test(lower) || EXECUTION_INTENT.test(lower)) return { kind: 'label', label: 'critical' }
  if (CONTINUATIONS.has(lower)) return { kind: 'sticky' }
  const words = lower.split(/\s+/).filter(Boolean).length
  if (words <= SHORT_WORDS && lastHadTools) return { kind: 'sticky' }
  return { kind: 'classify' }
}

export function classifierPrompt(text) {
  return [
    'Classify this coding-assistant task into exactly ONE tier. Reply with the tier name only.',
    '- simple: grep, find, shell one-liners, syntax lookups, log reading, short summaries, git status/log/diff',
    '- coding: single-file fixes, boilerplate, CRUD endpoints, tests, config changes, small refactors, docs',
    '- analysis: reviewing a diff or long document, summarising, research questions, commit or changelog text',
    '- critical: architecture, security-sensitive code, complex multi-service debugging, system design, ADRs',
    '',
    'Task: ' + text,
  ].join('\n')
}

export function parseLabel(raw) {
  const match = (raw || '').toLowerCase().match(new RegExp('\\b(' + LABELS.join('|') + ')\\b'))
  return match ? match[1] : undefined
}

export function ollamaBody(model, prompt) {
  return JSON.stringify({
    model,
    stream: false,
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: 0.1, num_predict: 20 },
  })
}

export function ollamaReply(text) {
  try {
    return JSON.parse(text).message.content || ''
  } catch {
    return ''
  }
}
