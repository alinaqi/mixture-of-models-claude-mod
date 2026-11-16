// /route and /palgu through a fake OpenCode (fake.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CFG, PREMATURE, history, idle, send, setup } from './fake.mjs'

test('the config hook registers /route and /palgu without replacing the person\'s own commands', async () => {
  const { hooks } = setup()
  const cfg = { ...CFG, command: { palgu: { template: 'mine' } } }
  await hooks.config(cfg)
  assert.equal(cfg.command.palgu.template, 'mine')
  assert.match(cfg.command.route.template, /\$ARGUMENTS/)
})

test('/route <model> pins it for the next prompts; its own echo turn goes to auto without recall or heartbeat', async () => {
  const { hooks, calls, disk } = setup({ verdict: PREMATURE, messages: history('Let me check.'), state: { memory: { '/work': true } } })
  await hooks.config(structuredClone(CFG))
  const out = { parts: [{ type: 'text', text: 'Mixture of Models /route deepseek' }] }
  await hooks['command.execute.before']({ command: 'route', sessionID: 's1', arguments: 'deepseek' }, out)
  assert.equal(disk().opencode.pin, 'deepseek-pro')
  assert.match(out.parts[0].text, /Route: deepseek-pro/)
  assert.ok(calls.some((c) => c[0] === 'toast'))
  const echo = await send(hooks, out.parts[0].text)
  assert.equal(echo.message.model.modelID, 'auto')
  assert.equal(echo.message.system, undefined)
  await idle(hooks)
  assert.equal(calls.some((c) => c[0] === 'prompt'), false)
  assert.equal((await send(hooks, 'add a retry to the http client please')).message.model.modelID, 'deepseek-pro')
})

test('/palgu runs mom\'s own memory, heartbeat and status commands', async () => {
  const { hooks } = setup()
  await hooks.config(structuredClone(CFG))
  for (const [args, line] of [['memory on', /Palgu memory: on/], ['heartbeat off', /Heartbeat: off/], ['', /signed in/], ['bogus', /palgu memory on\|off\|status/]]) {
    const out = { parts: [{ type: 'text', text: 'x' }] }
    await hooks['command.execute.before']({ command: 'palgu', sessionID: 's1', arguments: args }, out)
    assert.match(out.parts[0].text, line)
  }
})

test('a /route or /palgu command of the person\'s own is left to them', async () => {
  const { hooks, disk } = setup()
  await hooks.config({ ...structuredClone(CFG), command: { palgu: { template: 'my own' } } })
  const out = { parts: [{ type: 'text', text: 'my own' }] }
  await hooks['command.execute.before']({ command: 'palgu', sessionID: 's1', arguments: 'memory on' }, out)
  assert.equal(out.parts[0].text, 'my own')
  const mine = { parts: [{ type: 'text', text: 'x' }] }
  await hooks['command.execute.before']({ command: 'route', sessionID: 's1', arguments: 'deepseek-pro' }, mine)
  assert.equal(disk().opencode.pin, 'deepseek-pro')
})
