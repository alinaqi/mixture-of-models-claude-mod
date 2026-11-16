// Routing and memory recall through a fake OpenCode (fake.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CFG, MODELS, send, setup } from './fake.mjs'

test('critical work goes to the configured critical model: the message\'s model and the pin header', async () => {
  const { hooks } = setup({ options: { critical: 'claude-opus' } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'use claude to plan the database migration')
  assert.deepEqual(r.message.model, { providerID: 'palgu', modelID: 'claude-opus' })
  assert.equal(r.headers['x-srooter-pin'], 'claude-opus')
  assert.equal(r.headers['x-srooter-client'], 'mixture-of-models-opencode/9.9.9')
  assert.equal(r.headers['x-srooter-project'], 'work')
  assert.equal(r.headers['x-api-key'], 'k-123456789')
})

test('OpenCode\'s own title and summary requests are not pinned: Palgu serves them from its cheap tier', async () => {
  const { hooks } = setup({ options: { critical: 'claude-opus' } })
  await hooks.config(structuredClone(CFG))
  await send(hooks, 'use claude to plan the database migration')
  const out = { headers: {} }
  await hooks['chat.headers']({ sessionID: 's1', agent: 'title', model: { id: 'auto', providerID: 'palgu' } }, out)
  assert.equal('x-srooter-pin' in out.headers, false)
  assert.equal(out.headers['x-srooter-client'], 'mixture-of-models-opencode/9.9.9')
})

test('without routes Palgu routes: the model stays auto and no pin is sent', async () => {
  const { hooks } = setup()
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'add a retry to the http client and test it')
  assert.equal(r.message.model.modelID, 'auto')
  assert.equal('x-srooter-pin' in r.headers, false)
})

test('the classifier\'s tier picks its route; a model the config does not list is pinned by header only', async () => {
  const { hooks } = setup({ options: { routes: { simple: 'gemini-3.8-flash' } }, classified: { score: 2, kind: 'docs' } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'fix the typo in the readme intro please')
  assert.equal(r.message.model.modelID, 'auto')
  assert.equal(r.headers['x-srooter-pin'], 'gemini-3.8-flash')
})

test('another provider is left alone, and the key never goes to a host that is not Palgu', async () => {
  const { hooks } = setup({ options: { critical: 'claude-opus' } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'use claude to plan the database migration', 'claude-sonnet-5', 'anthropic')
  assert.equal(r.message.model.modelID, 'claude-sonnet-5')
  assert.deepEqual(r.headers, {})
  const other = setup()
  await other.hooks.config({ provider: { palgu: { options: { baseURL: 'https://example.com/v1' }, models: MODELS } } })
  assert.equal('x-api-key' in (await send(other.hooks, 'add a retry to the http client please')).headers, false)
})

test('Palgu memory is recalled into the message\'s system text where memory is on', async () => {
  const { hooks, calls } = setup({ state: { memory: { '/work': true } } })
  await hooks.config(structuredClone(CFG))
  const r = await send(hooks, 'refactor the config loader to cache reads')
  assert.match(r.message.system, /^Palgu memory for work/)
  assert.deepEqual(calls.find((c) => c[0] === 'search'), ['search', 'work', 'refactor the config loader to cache reads'])
  const off = setup()
  assert.equal((await send(off.hooks, 'refactor the config loader to cache reads')).message.system, undefined)
})

test('a Palgu model the person picked stays picked on every following prompt', async () => {
  const { hooks } = setup({ options: { critical: 'claude-opus' } })
  await hooks.config(structuredClone(CFG))
  for (let i = 0; i < 3; i += 1) assert.equal((await send(hooks, 'add a retry to the http client please', 'deepseek-pro')).message.model.modelID, 'deepseek-pro')
  assert.equal((await send(hooks, 'use claude to plan the database migration')).message.model.modelID, 'claude-opus')
})

test('every hook fails open', async () => {
  const { hooks } = setup()
  await hooks.config(null)
  await hooks['chat.message']({}, {})
  await hooks['chat.headers']({}, {})
  await hooks.event({})
  await hooks['command.execute.before']({ command: 'route' }, {})
})
