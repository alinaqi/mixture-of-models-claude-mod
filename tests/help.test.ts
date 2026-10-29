import { expect, test } from 'claude-code/testing'
import { helpLines, helpTree } from '../hooks/lib/help-pane.js'

const BASE = { pin: { mode: 'auto' }, ready: true, provider: 'palgu', sessionModel: 'claude-opus-5-5', saved: 'saved ~$1.00 (50%) vs all claude-opus-5-5, at API prices', buttons: ['auto', 'glm', 'kimi', 'claude', 'off'] }
const text = (v) => helpLines(v).map((l) => l.text).join('\n')

test('help explains what the mod does and what stays on Claude', async () => {
  const t = text(BASE)
  expect(t).toContain('scored 1-10')
  expect(t).toContain('claude-opus-5-5')
})

test('help says when routing is off, that the choice is remembered, and how to turn it on', async () => {
  const t = text({ ...BASE, pin: { mode: 'off' } })
  expect(t).toContain('Routing is off')
  expect(t).toContain('remembered')
  expect(t).toContain('press 1 or /route auto')
})

test('help names the gateway, or how to connect one when there is none', async () => {
  expect(text(BASE)).toContain('Gateway: Palgu')
  const none = text({ ...BASE, ready: false, provider: '' })
  expect(none).toContain('No gateway yet')
  expect(none).toContain('/palgu login')
  expect(none).toContain('/plugin configure mixture-of-models@mixture-of-models-claude-mod')
})

test('help lists every band button with its hotkey, and the commands', async () => {
  const t = text(BASE)
  for (const b of ['0  help', '1  auto', '2  glm', '4  claude', '5  off']) expect(t).toContain(b)
  for (const c of ['/route status', '/route stats', '/route reset', '/route claude/sonnet', '/palgu login', '/palgu upgrade']) expect(t).toContain(c)
  expect(t).toContain(BASE.saved)
})

test('helpTree draws each line as text in one column', async () => {
  const el = { Box: (p) => ({ type: 'Box', ...p }), Text: (p) => ({ type: 'Text', ...p }) }
  const tree = helpTree(el, BASE)
  expect(tree.type).toBe('Box')
  expect(tree.children.length).toBe(helpLines(BASE).length)
})

test('help names the routing strategy and how to change or write one', async () => {
  const t = text({ ...BASE, strategy: { name: 'cost', description: 'Cheapest models first.' } })
  expect(t).toContain('Strategy: cost · Cheapest models first.')
  for (const c of ['/route strategies', '/route strategy <name>', 'routing-strategy skill']) expect(t).toContain(c)
})
