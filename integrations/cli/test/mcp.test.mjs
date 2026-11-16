// `mom mcp` spoken to over stdio, as Cursor (or any MCP client) does. No key or memory off: the
// tools answer with how to enable them and make no network call.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VERSION } from '../../../hooks/lib/version.js'

const MOM = join(dirname(fileURLToPath(import.meta.url)), '..', 'mom.js')

// Sends each message as one line, collects one answer per request id, then closes stdin.
function session(messages, env = {}) {
  const home = mkdtempSync(join(tmpdir(), 'mom-mcp-'))
  const child = spawn(process.execPath, [MOM, 'mcp'], { env: { PATH: '/usr/bin:/bin', MOM_HOME: home, HOME: home, ...env } })
  const want = messages.filter((m) => 'id' in m).length
  return new Promise((resolve, reject) => {
    const answers = []
    let buf = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('timeout: ' + JSON.stringify(answers))) }, 10000)
    child.stdout.on('data', (d) => {
      buf += d
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const l of lines.filter(Boolean)) answers.push(JSON.parse(l))
      if (answers.length >= want) child.stdin.end()
    })
    child.on('close', (code) => { clearTimeout(timer); resolve({ answers, code }) })
    for (const m of messages) child.stdin.write(JSON.stringify(m) + '\n')
  })
}

const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }
const call = (id, name, args) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })
const text = (a) => a.result.content[0].text

test('mom mcp: initialize, tools/list and ping over stdio', async () => {
  const { answers, code } = await session([init, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', id: 3, method: 'ping' }])
  assert.equal(code, 0)
  const byId = Object.fromEntries(answers.map((a) => [a.id, a]))
  assert.equal(byId[1].result.protocolVersion, '2025-06-18')
  assert.deepEqual(byId[1].result.serverInfo, { name: 'mixture-of-models', version: VERSION })
  assert.deepEqual(byId[2].result.tools.map((t) => t.name), ['palgu_memory_search', 'palgu_delegate', 'palgu_models'])
  assert.deepEqual(byId[3].result, {})
})

test('mom mcp without a key: every tool answers with the sign-in hint', async () => {
  const { answers } = await session([init, call(2, 'palgu_memory_search', { query: 'config loader cache' }), call(3, 'palgu_delegate', { prompt: 'write a test' }), call(4, 'palgu_models', {})])
  for (const a of answers.filter((x) => x.id > 1)) {
    assert.equal(a.result.isError, true)
    assert.match(text(a), /mom login/)
  }
})

test('mom mcp with a key: memory search where memory is off says how to turn it on; a bad call is a tool error', async () => {
  const env = { PALGU_API_KEY: 'pk_test_123456789', MOM_PROJECT_DIR: '/nowhere/project' }
  const { answers } = await session([init, call(2, 'palgu_memory_search', { query: 'config loader cache' }), call(3, 'palgu_delegate', { prompt: '' })], env)
  const byId = Object.fromEntries(answers.map((a) => [a.id, a]))
  assert.match(text(byId[2]), /Palgu memory is off for \/nowhere\/project/)
  assert.match(text(byId[2]), /mom memory on/)
  assert.equal(byId[3].result.isError, true)
  assert.match(text(byId[3]), /prompt/)
})

test('mom mcp answers garbage with a parse error and keeps going', async () => {
  const home = mkdtempSync(join(tmpdir(), 'mom-mcp-'))
  const child = spawn(process.execPath, [MOM, 'mcp'], { env: { PATH: '/usr/bin:/bin', MOM_HOME: home, HOME: home } })
  const out = []
  child.stdout.on('data', (d) => out.push(String(d)))
  child.stdin.write('garbage\n')
  child.stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping' }) + '\n')
  await new Promise((r) => child.on('close', r))
  const lines = out.join('').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(lines[0].error.code, -32700)
  assert.deepEqual(lines[1], { jsonrpc: '2.0', id: 9, result: {} })
})

// Seen live (Copilot CLI 1.0.112): a plugin's MCP server starts in the plugin's folder; the session's folder is COPILOT_SESSION_CWD.
test('mom mcp takes the project folder from COPILOT_SESSION_CWD when the client sets it', async () => {
  const env = { PALGU_API_KEY: 'pk_test_123456789', COPILOT_SESSION_CWD: '/work/copilot-project' }
  const { answers } = await session([init, call(2, 'palgu_memory_search', { query: 'config loader cache' })], env)
  assert.match(text(answers.find((a) => a.id === 2)), /Palgu memory is off for \/work\/copilot-project/)
})
