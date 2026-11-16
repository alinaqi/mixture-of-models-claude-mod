import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeServer, parseLine } from '../lib/mcp.js'

const TOOLS = [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }]

function server(calls = []) {
  return makeServer({
    info: { name: 'test', version: '1.0.0', instructions: 'Use echo.' },
    tools: TOOLS,
    async call(name, args, ctx) { calls.push([name, args, ctx]); return args.fail ? { text: 'bad', isError: true } : { text: 'you said ' + args.text } }
  })
}

const req = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })

test('initialize echoes the client\'s protocol version, else 2025-06-18, with tools and server info', async () => {
  const s = server()
  const [r] = await s.receive(req(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'c', version: '1' } }))
  assert.equal(r.id, 1)
  assert.equal(r.result.protocolVersion, '2025-03-26')
  assert.deepEqual(r.result.serverInfo, { name: 'test', version: '1.0.0' })
  assert.ok(r.result.capabilities.tools)
  assert.equal(r.result.instructions, 'Use echo.')
  const [r2] = await server().receive(req(2, 'initialize', {}))
  assert.equal(r2.result.protocolVersion, '2025-06-18')
})

test('tools/list, tools/call and ping answer; notifications get no answer', async () => {
  const calls = []
  const s = server(calls)
  assert.deepEqual((await s.receive(req(3, 'tools/list')))[0].result, { tools: TOOLS })
  const [r] = await s.receive(req(4, 'tools/call', { name: 'echo', arguments: { text: 'hi' } }))
  assert.deepEqual(r.result, { content: [{ type: 'text', text: 'you said hi' }], isError: false })
  const [bad] = await s.receive(req(5, 'tools/call', { name: 'echo', arguments: { fail: true } }))
  assert.equal(bad.result.isError, true)
  assert.deepEqual((await s.receive(req(6, 'ping')))[0], { jsonrpc: '2.0', id: 6, result: {} })
  assert.deepEqual(await s.receive({ jsonrpc: '2.0', method: 'notifications/cancelled', params: {} }), [])
  assert.equal(calls.length, 2)
})

test('an unknown method, an unknown tool and a failing tool are JSON-RPC errors or tool errors, never a crash', async () => {
  const s = makeServer({ info: { name: 't', version: '1' }, tools: TOOLS, async call() { throw new Error('boom') } })
  assert.equal((await s.receive(req(7, 'resources/list')))[0].error.code, -32601)
  assert.equal((await s.receive(req(8, 'tools/call', { name: 'nope', arguments: {} })))[0].error.code, -32602)
  const [r] = await s.receive(req(9, 'tools/call', { name: 'echo', arguments: {} }))
  assert.equal(r.result.isError, true)
  assert.match(r.result.content[0].text, /boom/)
})

test('roots: after initialized the server asks a client that has roots for them, and passes them to tools as paths', async () => {
  const calls = []
  const s = server(calls)
  await s.receive(req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: { roots: { listChanged: true } } }))
  const [ask] = await s.receive({ jsonrpc: '2.0', method: 'notifications/initialized' })
  assert.equal(ask.method, 'roots/list')
  assert.deepEqual(await s.receive({ jsonrpc: '2.0', id: ask.id, result: { roots: [{ uri: 'file:///Users/me/work%20dir', name: 'work' }, { uri: 'https://x' }] } }), [])
  await s.receive(req(2, 'tools/call', { name: 'echo', arguments: { text: 'x' } }))
  assert.deepEqual(calls[0][2].roots, ['/Users/me/work dir'])
  const plain = server()
  await plain.receive(req(1, 'initialize', { capabilities: {} }))
  assert.deepEqual(await plain.receive({ jsonrpc: '2.0', method: 'notifications/initialized' }), [])
})

test('parseLine: JSON-RPC 2.0 objects pass; anything else is a parse error or invalid request answer; blank lines are skipped', () => {
  assert.deepEqual(parseLine('{"jsonrpc":"2.0","id":1,"method":"ping"}'), { msg: { jsonrpc: '2.0', id: 1, method: 'ping' } })
  assert.equal(parseLine('not json').reply.error.code, -32700)
  assert.equal(parseLine('[1,2]').reply.error.code, -32600)
  assert.equal(parseLine('{}').reply.error.code, -32600)
  assert.deepEqual(parseLine('{"id":4,"method":"ping"}').reply, { jsonrpc: '2.0', id: 4, error: { code: -32600, message: 'Invalid request' } })
  assert.deepEqual(parseLine('   '), {})
})

test('a method named like an Object property (toString, constructor) is not found, not a crash', async () => {
  const s = server()
  for (const method of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    const [r] = await s.receive(req(1, method))
    assert.equal(r.error.code, -32601)
  }
  assert.deepEqual(await s.receive({ jsonrpc: '2.0', method: 'toString' }), [])
})

test('initialize answers a protocol version it does not know with its own', async () => {
  for (const v of ['2024-11-05', '2025-03-26', '2025-06-18']) assert.equal((await server().receive(req(1, 'initialize', { protocolVersion: v })))[0].result.protocolVersion, v)
  assert.equal((await server().receive(req(1, 'initialize', { protocolVersion: '2099-01-01' })))[0].result.protocolVersion, '2025-06-18')
})

test('tools/call with arguments that are not an object passes the tool an empty object', async () => {
  const calls = []
  await server(calls).receive(req(1, 'tools/call', { name: 'echo', arguments: 'text' }))
  assert.deepEqual(calls[0][1], {})
})
