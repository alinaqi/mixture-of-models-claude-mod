// A Model Context Protocol server's message handling (JSON-RPC 2.0 over newline-delimited stdio):
// initialize, ping, tools/list, tools/call, and the client's roots when it has them. Tool-neutral:
// the tools and what they do come in from the caller (mcp.js). No I/O here.
import { fileURLToPath } from 'node:url'

export const DEFAULT_PROTOCOL = '2025-06-18'
const ROOTS_ID = 'mom-roots'

const reply = (id, result) => ({ jsonrpc: '2.0', id, result })
const failure = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })

// One line of stdin: { msg } to handle, { reply } to send back as is, or {} for a blank line.
export function parseLine(line) {
  if (!String(line).trim()) return {}
  let v
  try {
    v = JSON.parse(line)
  } catch {
    return { reply: failure(null, -32700, 'Parse error') }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? { msg: v } : { reply: failure(null, -32600, 'Invalid request') }
}

function rootPaths(result) {
  const roots = result && Array.isArray(result.roots) ? result.roots : []
  return roots.filter((r) => r && String(r.uri).startsWith('file://')).map((r) => fileURLToPath(r.uri))
}

function initialize(s, msg) {
  const p = msg.params || {}
  s.clientRoots = Boolean(p.capabilities && p.capabilities.roots)
  const result = { protocolVersion: String(p.protocolVersion || DEFAULT_PROTOCOL), capabilities: { tools: { listChanged: false } }, serverInfo: { name: s.info.name, version: s.info.version } }
  return [reply(msg.id, s.info.instructions ? { ...result, instructions: s.info.instructions } : result)]
}

async function callTool(s, msg) {
  const p = msg.params || {}
  if (!s.tools.some((t) => t.name === p.name)) return [failure(msg.id, -32602, 'Unknown tool: ' + p.name)]
  const out = await s.call(p.name, p.arguments || {}, { roots: s.roots }).catch((err) => ({ text: 'Failed: ' + (err && err.message), isError: true }))
  return [reply(msg.id, { content: [{ type: 'text', text: String(out.text) }], isError: Boolean(out.isError) })]
}

const askRoots = (s) => (s.clientRoots ? [{ jsonrpc: '2.0', id: ROOTS_ID + '-' + (s.asked += 1), method: 'roots/list' }] : [])

const METHODS = {
  initialize,
  ping: (s, msg) => [reply(msg.id, {})],
  'tools/list': (s, msg) => [reply(msg.id, { tools: s.tools })],
  'tools/call': callTool
}

const NOTICES = { 'notifications/initialized': askRoots, 'notifications/roots/list_changed': askRoots }

// A client's answer to our roots/list.
function answer(s, msg) {
  if (String(msg.id).startsWith(ROOTS_ID) && msg.result) s.roots = rootPaths(msg.result)
  return []
}

// { receive(msg) }: the messages to send for one message received (answers, or requests of ours).
export function makeServer({ info, tools, call }) {
  const s = { info, tools, call, roots: [], clientRoots: false, asked: 0 }
  return {
    async receive(msg) {
      if (!('method' in msg)) return 'id' in msg ? answer(s, msg) : []
      if (!('id' in msg)) return NOTICES[msg.method] ? NOTICES[msg.method](s) : []
      return METHODS[msg.method] ? METHODS[msg.method](s, msg) : [failure(msg.id, -32601, 'Method not found: ' + msg.method)]
    }
  }
}
