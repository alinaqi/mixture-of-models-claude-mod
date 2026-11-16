import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { askOllama } from '../lib/ollama.js'

process.env.MOM_HOME = mkdtempSync(join(tmpdir(), 'mom-oc-'))

test('the module default-exports an OpenCode V1 plugin: an id and server(), and only that is required', async () => {
  const mod = await import('../plugin.js')
  assert.equal(mod.default.id, 'mixture-of-models')
  assert.equal(typeof mod.default.server, 'function')
  const hooks = await mod.default.server({ client: {}, directory: '/tmp/x', worktree: '/tmp/x' }, { critical: 'claude-opus' })
  assert.deepEqual(Object.keys(hooks).sort(), ['chat.headers', 'chat.message', 'command.execute.before', 'config', 'dispose', 'event'])
  await hooks.dispose()
})

test('a second copy of the plugin for the same folder adds no hooks until the first is disposed', async () => {
  const mod = await import('../plugin.js')
  const first = await mod.default.server({ client: {}, directory: '/tmp/y' }, {})
  assert.deepEqual(await mod.default.server({ client: {}, directory: '/tmp/y' }, {}), {})
  assert.ok((await mod.default.server({ client: {}, directory: '/tmp/z' }, {})).event)
  await first.dispose()
  assert.ok((await mod.default.server({ client: {}, directory: '/tmp/y' }, {})).event)
})

test('package.json exports the plugin where OpenCode looks for it (./server) and as ./opencode, and keeps the mom bin', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.exports['./opencode'], './integrations/opencode/plugin.js')
  assert.equal(pkg.exports['./server'], './integrations/opencode/plugin.js')
  assert.equal(pkg.bin.mom, 'integrations/cli/mom.js')
})

test('askOllama asks the local classifier with the mod\'s rubric and reads its verdict', async () => {
  const seen = []
  const fetchImpl = async (url, init) => { seen.push([url, JSON.parse(init.body)]); return { ok: true, text: async () => JSON.stringify({ message: { content: '8 code' } }) } }
  assert.deepEqual(await askOllama('debug the race in the job queue', 'qwen2.5-coder:3b', fetchImpl), { score: 8, kind: 'code' })
  assert.equal(seen[0][0], 'http://localhost:11434/api/chat')
  assert.equal(seen[0][1].model, 'qwen2.5-coder:3b')
  assert.match(seen[0][1].messages[0].content, /Blast radius/)
})

test('askOllama answers undefined when Ollama is down or says nothing usable', async () => {
  assert.equal(await askOllama('x y z w', 'm', async () => { throw new Error('ECONNREFUSED') }), undefined)
  assert.equal(await askOllama('x y z w', 'm', async () => ({ ok: false, text: async () => '' })), undefined)
})
