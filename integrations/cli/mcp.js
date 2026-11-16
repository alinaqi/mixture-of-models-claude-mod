// `mom mcp [tool]`: an MCP server on stdio for any coding agent that speaks MCP (Cursor first;
// ADR 0005). Palgu memory search, delegation of a subtask to a Palgu model, and Palgu's model
// list. Protocol in lib/mcp.js, tool definitions in lib/tools.js; this file does the calls.
// stdout carries protocol messages only; the key is never written anywhere.
import { createInterface } from 'node:readline'
import { recallBlock } from '../../hooks/lib/recall.js'
import { memoryOn } from '../../hooks/lib/memory.js'
import { liveModels } from '../../hooks/lib/catalogue.js'
import { VERSION } from '../../hooks/lib/version.js'
import { makeServer, parseLine } from './lib/mcp.js'
import { delegateAnswer, delegateRequest, modelsAnswer, pickFolder, SIGN_IN, TOOL_DEFS } from './lib/tools.js'
import { call, loadKey, palguStatus, readJson, writeJson } from './io.js'

const INSTRUCTIONS = 'Mixture of Models (Palgu). palgu_memory_search: search this project\'s Palgu memory before a task. palgu_delegate: hand a self-contained, low-risk subtask to a cheaper Palgu model. palgu_models: the models Palgu serves.'
const say = (text, isError = false) => ({ text, isError })

async function projectOf(folder) {
  const known = ((readJson('state.json', {}) || {}).projects || {})[folder]
  if (known) return known
  const s = await palguStatus(folder, 8000)
  if (!s || !s.indexed) return ''
  const cur = readJson('state.json', {}) || {}
  writeJson('state.json', { ...cur, projects: { ...(cur.projects || {}), [folder]: s.project } })
  return s.project
}

async function memorySearch(args, ctx, key) {
  const folder = pickFolder({ arg: args.folder, env: process.env.MOM_PROJECT_DIR, roots: ctx.roots, cwd: process.cwd() })
  if (!memoryOn((readJson('state.json', {}) || {}).memory, folder)) return say('Palgu memory is off for ' + folder + '. To use it, run `mom memory on` in that folder (it uploads the project\'s source to Palgu for indexing).')
  const query = String(args.query || '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (!query) return say('palgu_memory_search needs a query.', true)
  const project = await projectOf(folder)
  if (!project) return say('Palgu memory is on for ' + folder + ' but it is not indexed yet. `mom memory status` there says why (it needs the palgu CLI: https://www.palgu.ai/install).')
  const res = await call('/v1/cortex/search?limit=8&project=' + encodeURIComponent(project) + '&q=' + encodeURIComponent(query), { headers: { authorization: 'Bearer ' + key } }, 8000).catch(() => null)
  if (!res || !res.ok) return say('Palgu memory search failed' + (res ? ' (' + res.status + ')' : ' (no answer)') + '.', true)
  return say(recallBlock(res, project) || 'Palgu memory has nothing on that in ' + project + '.')
}

async function delegate(args, tool, key) {
  const req = delegateRequest(args, tool, VERSION)
  if (req.error) return say(req.error, true)
  const init = { method: 'POST', headers: { ...req.headers, authorization: 'Bearer ' + key }, body: JSON.stringify(req.body) }
  return delegateAnswer(await call('/v1/chat/completions', init, 120000).catch(() => null))
}

async function models(key) {
  const res = await call('/v1/models/health', { headers: { 'x-api-key': key } }, 15000).catch(() => null)
  return say(modelsAnswer(liveModels(res)), !res || !res.ok)
}

function tools(tool) {
  return async (name, args, ctx) => {
    const key = loadKey()
    if (!key) return say(SIGN_IN, true)
    if (name === 'palgu_memory_search') return memorySearch(args, ctx, key)
    if (name === 'palgu_delegate') return delegate(args, tool, key)
    return models(key)
  }
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')

export async function runMcp(tool) {
  const name = /^[a-z0-9-]{1,32}$/.test(tool || '') ? tool : 'mcp'
  const server = makeServer({ info: { name: 'mixture-of-models', version: VERSION, instructions: INSTRUCTIONS }, tools: TOOL_DEFS, call: tools(name) })
  const pending = new Set()
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const { msg, reply } = parseLine(line)
    if (reply) send(reply)
    if (!msg) continue
    const p = server.receive(msg).then((out) => out.forEach(send), (err) => process.env.MOM_DEBUG && process.stderr.write('mom mcp: ' + err.message + '\n'))
    pending.add(p)
    p.finally(() => pending.delete(p))
  }
  await Promise.all(pending)
}
