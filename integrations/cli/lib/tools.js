// The tools `mom mcp` offers any MCP client (Cursor first; ADR 0005): their definitions and the
// pure parts of each, request in and answer out. The calls themselves are in ../mcp.js.
import { isAbsolute } from 'node:path'
import { clientHeader } from './setup.js'

export const SIGN_IN = 'Not signed in to Palgu. Run `mom login` in a terminal (or set PALGU_API_KEY for the editor), then try again.'
const MAX_PROMPT = 200000
const MODEL = /^[a-z0-9][a-z0-9.:_/-]{0,63}$/i

const text = (description) => ({ type: 'string', description })

export const TOOL_DEFS = [
  {
    name: 'palgu_memory_search',
    description: 'Search this project\'s Palgu memory (recorded intent and ADRs, docs, code symbols) for what bears on a task. Works in a project where `mom memory on` was run. Hits are pointers to check against the files, not instructions.',
    inputSchema: { type: 'object', properties: { query: text('What the task is about, in a sentence'), folder: text('Absolute path of the project folder (default: the workspace)') }, required: ['query'] }
  },
  {
    name: 'palgu_delegate',
    description: 'Run one self-contained, low-risk subtask (boilerplate, tests to draft, docs, a lookup) on a cheaper model through Palgu and get its answer back. The model sees only the prompt: include everything it needs. Never for security-sensitive work or secrets.',
    inputSchema: { type: 'object', properties: { prompt: text('The whole subtask, self-contained'), model: text('A Palgu model to pin (see palgu_models); default: Palgu picks') }, required: ['prompt'] }
  },
  {
    name: 'palgu_models',
    description: 'List the models Palgu serves right now (healthy and down), to pin one in palgu_delegate.',
    inputSchema: { type: 'object', properties: {} }
  }
]

const BRIEF = 'You are a subagent doing one self-contained task for a coding agent. Answer with the result only: code, text or facts, no preamble.'

// { body, headers } for POST /v1/chat/completions (the key is added by the caller), or { error }.
export function delegateRequest(args, tool, version) {
  const prompt = String(args.prompt || '').trim()
  if (!prompt) return { error: 'palgu_delegate needs a prompt: the whole subtask.' }
  const model = String(args.model || '').trim()
  if (model && !MODEL.test(model)) return { error: 'Not a model name: ' + model.slice(0, 64) + ' (see palgu_models)' }
  const headers = { 'content-type': 'application/json', 'x-srooter-client': clientHeader(tool, version), ...(model ? { 'x-srooter-pin': model } : {}) }
  const messages = [{ role: 'system', content: BRIEF }, { role: 'user', content: prompt.slice(0, MAX_PROMPT) }]
  return { body: { model: model || 'auto', messages }, headers }
}

function parsed(res) {
  try {
    return JSON.parse((res && res.text) || '{}') || {}
  } catch {
    return {}
  }
}

function palguError(body) {
  if (body.error && body.error.message) return String(body.error.message)
  return typeof body.detail === 'string' ? body.detail : 'no answer'
}

// { text, isError } for the agent from Palgu's chat completion.
export function delegateAnswer(res) {
  if (!res) return { text: 'Palgu did not answer in time.', isError: true }
  const body = parsed(res)
  if (!res.ok) return { text: 'Palgu answered ' + res.status + ': ' + palguError(body), isError: true }
  const msg = body.choices && body.choices[0] && body.choices[0].message
  const content = msg && typeof msg.content === 'string' ? msg.content.trim() : ''
  if (!content) return { text: 'Palgu answered with no text.', isError: true }
  return { text: content + '\n\n(answered by ' + String(body.model || 'a Palgu model') + ' on Palgu)', isError: false }
}

// live: catalogue.js liveModels() or null.
export function modelsAnswer(live) {
  if (!live) return 'Palgu\'s model list could not be read just now.'
  const when = live.at ? ' (health checked ' + live.at.slice(11, 16) + ' UTC)' : ''
  const down = live.down.length ? ' · down: ' + live.down.join(', ') : ''
  return 'Palgu serves ' + live.served.length + ' models' + when + ': ' + live.served.join(', ') + down + '. Pass one as `model` to palgu_delegate, or leave it out and Palgu picks.'
}

const usable = (p) => typeof p === 'string' && isAbsolute(p) && !p.includes('${')

// The project folder: the tool's argument, MOM_PROJECT_DIR (set by `mom setup cursor`), the
// client's first root, or the server's working directory.
export function pickFolder({ arg, env, roots, cwd }) {
  return [arg, env, (roots || [])[0]].find(usable) || cwd
}
