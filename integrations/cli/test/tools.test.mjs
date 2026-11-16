import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOL_DEFS, delegateRequest, delegateAnswer, modelsAnswer, pickFolder, SIGN_IN } from '../lib/tools.js'

test('the MCP tools are palgu_memory_search, palgu_delegate and palgu_models, each with an object input schema', () => {
  assert.deepEqual(TOOL_DEFS.map((t) => t.name), ['palgu_memory_search', 'palgu_delegate', 'palgu_models'])
  for (const t of TOOL_DEFS) {
    assert.equal(t.inputSchema.type, 'object')
    assert.ok(t.description.length > 20)
  }
  assert.deepEqual(TOOL_DEFS[0].inputSchema.required, ['query'])
  assert.deepEqual(TOOL_DEFS[1].inputSchema.required, ['prompt'])
  assert.match(SIGN_IN, /mom login/)
})

test('delegateRequest: auto when no model, a pinned model in body and x-srooter-pin, the client header; never a key', () => {
  const auto = delegateRequest({ prompt: 'write a test' }, 'cursor', '0.27.0')
  assert.equal(auto.body.model, 'auto')
  assert.deepEqual(auto.body.messages.at(-1), { role: 'user', content: 'write a test' })
  assert.equal(auto.headers['x-srooter-client'], 'mixture-of-models-cursor/0.27.0')
  assert.equal('x-srooter-pin' in auto.headers, false)
  const pinned = delegateRequest({ prompt: 'x', model: 'kimi-2.7' }, 'cursor', '0.27.0')
  assert.equal(pinned.body.model, 'kimi-2.7')
  assert.equal(pinned.headers['x-srooter-pin'], 'kimi-2.7')
  assert.match(delegateRequest({ prompt: '  ' }, 'cursor', '1').error, /prompt/)
  assert.match(delegateRequest({ prompt: 'x', model: 'bad model!' }, 'cursor', '1').error, /model/)
  assert.equal(delegateRequest({ prompt: 'x'.repeat(300000) }, 'cursor', '1').body.messages.at(-1).content.length, 200000)
})

test('delegateAnswer returns the model\'s text with the model that answered, or Palgu\'s error', () => {
  const ok = { ok: true, status: 200, text: JSON.stringify({ model: 'deepseek-v4-pro', choices: [{ message: { content: 'pong' } }] }) }
  assert.deepEqual(delegateAnswer(ok), { text: 'pong\n\n(answered by deepseek-v4-pro on Palgu)', isError: false })
  const down = { ok: false, status: 503, text: JSON.stringify({ error: { message: 'glm-5.3 is temporarily unavailable.' } }) }
  assert.deepEqual(delegateAnswer(down), { text: 'Palgu answered 503: glm-5.3 is temporarily unavailable.', isError: true })
  assert.equal(delegateAnswer({ ok: false, status: 403, text: '{"detail":"pin \'x\' not allowed by policy"}' }).text, 'Palgu answered 403: pin \'x\' not allowed by policy')
  assert.equal(delegateAnswer(null).isError, true)
  assert.equal(delegateAnswer({ ok: true, status: 200, text: '{}' }).isError, true)
})

test('modelsAnswer lists the healthy models and the down ones, or says the list could not be read', () => {
  assert.match(modelsAnswer({ at: '2026-11-16T06:02:39Z', served: ['kimi-2.7', 'gpt-6-sol'], down: ['glm-5.3'] }), /^Palgu serves 2 models \(health checked 06:02 UTC\): kimi-2\.7, gpt-6-sol · down: glm-5\.3/)
  assert.match(modelsAnswer(null), /could not be read/)
})

test('pickFolder: an absolute folder argument, else MOM_PROJECT_DIR, else the client\'s first root, else the cwd', () => {
  assert.equal(pickFolder({ arg: '/a', env: '/b', roots: ['/c'], cwd: '/d' }), '/a')
  assert.equal(pickFolder({ arg: 'rel', env: '/b', roots: ['/c'], cwd: '/d' }), '/b')
  assert.equal(pickFolder({ env: '${workspaceFolder}', roots: ['/c'], cwd: '/d' }), '/c')
  assert.equal(pickFolder({ roots: [], cwd: '/d' }), '/d')
})
