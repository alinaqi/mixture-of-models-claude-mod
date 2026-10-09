import { expect, test } from 'claude-code/testing'
import { DEFAULT_ROUTES } from '../hooks/lib/config.js'
import { bandButtons, bandText, bandTree, reportText, tagText, tagTree } from '../hooks/lib/ui.js'

// Fake elements: each returns plain data so the tree can be inspected.
const el = {
  Box: (p) => ({ type: 'Box', ...p }),
  Text: (p) => ({ type: 'Text', ...p }),
  Button: (p) => ({ type: 'Button', ...p }),
}
const SESSION = 'claude-opus-5'
const base = { disabled: false, ready: true, isWorking: false, sessionModel: SESSION, pin: { mode: 'auto' }, decision: { label: 'coding', model: 'glm-5.3', source: 'ollama' } }

test('bandButtons derives one button per provider plus auto, claude and off', async () => {
  expect(bandButtons(DEFAULT_ROUTES)).toEqual([
    { key: 'pin-auto', label: 'auto', hotkey: '1', arg: 'auto' },
    { key: 'pin-glm', label: 'glm', hotkey: '2', arg: 'glm' },
    { key: 'pin-kimi', label: 'kimi', hotkey: '3', arg: 'kimi' },
    { key: 'pin-claude', label: 'claude', hotkey: '4', arg: 'claude' },
    { key: 'pin-off', label: 'off', hotkey: '5', arg: 'off' },
  ])
})

test('bandText describes each state', async () => {
  expect(bandText({ ...base, disabled: true })).toBe('mixture-of-models · inactive inside a child session')
  expect(bandText({ ...base, ready: false })).toBe('mixture-of-models · observe-only: no gateway key for the child')
  expect(bandText({ ...base, pin: { mode: 'off' } })).toBe('mixture-of-models · off · everything on claude-opus-5')
  expect(bandText({ ...base, pin: { mode: 'model', model: 'kimi-k3' }, decision: { label: 'pinned', model: 'kimi-k3', source: 'pin' } })).toBe('mixture-of-models · pinned kimi-k3')
  expect(bandText({ ...base, pin: { mode: 'label', label: 'analysis' }, decision: { label: 'analysis', model: 'kimi-k3', source: 'pin' } })).toBe('mixture-of-models · pinned analysis → kimi-k3')
  expect(bandText(base)).toBe('mixture-of-models · auto · last: glm-5.3 (coding via ollama)')
  expect(bandText({ ...base, decision: { ...base.decision, score: 5 } })).toBe('mixture-of-models · auto · last: glm-5.3 (coding 5/10 via ollama)')
  expect(bandText({ ...base, decision: { label: 'critical', model: '', source: 'default' } })).toBe('mixture-of-models · auto · no prompt yet')
  expect(bandText({ ...base, isWorking: true })).toBe('mixture-of-models · running glm-5.3 in a child…')
  expect(bandText({ ...base, isWorking: true, decision: { label: 'critical', model: SESSION, source: 'rule' } })).toBe('mixture-of-models · running claude-opus-5 in the main session…')
})

test('bandTree draws the text, the buttons with the active one bright, and keeps what others drew', async () => {
  const pressed = []
  const tree = bandTree(el, { ...base, routes: DEFAULT_ROUTES, theirs: { type: 'engine', ref: 1 } }, (arg) => pressed.push(arg))
  expect(tree.type).toBe('Box')
  const row = tree.children[0]
  expect(row.children[0]).toEqual({ type: 'Text', dimColor: true, children: ['mixture-of-models · auto · last: glm-5.3 (coding via ollama)  '] })
  const buttons = row.children.slice(1)
  expect(buttons.map((b) => b.label)).toEqual(['auto', 'glm', 'kimi', 'claude', 'off'])
  expect(buttons.map((b) => b.dimColor)).toEqual([false, true, true, true, true])
  expect(buttons.every((b) => b.plain === true)).toBe(true)
  buttons[2].onPress()
  expect(pressed).toEqual(['kimi'])
  expect(tree.children[1]).toEqual({ type: 'engine', ref: 1 })
})

test('bandTree marks the pinned provider active and omits a missing "theirs"', async () => {
  const tree = bandTree(el, { ...base, routes: DEFAULT_ROUTES, pin: { mode: 'model', model: 'kimi-k3' }, theirs: undefined }, () => {})
  const buttons = tree.children[0].children.slice(1)
  expect(buttons.map((b) => b.dimColor)).toEqual([true, true, false, true, true])
  expect(tree.children.length).toBe(1)
})

test('tagText names the child model or the main session', async () => {
  expect(tagText('glm-5.3', SESSION)).toBe('⇢ glm-5.3 · child on gateway')
  expect(tagText(SESSION, SESSION)).toBe('⇢ claude-opus-5 · main session')
})

test('tagTree puts a dim tag above what Claude Code drew', async () => {
  const tree = tagTree(el, '⇢ glm-5.3 · child on gateway', { type: 'engine', ref: 7 })
  expect(tree).toEqual({ type: 'Box', flexDirection: 'column', children: [{ type: 'Text', dimColor: true, children: ['⇢ glm-5.3 · child on gateway'] }, { type: 'engine', ref: 7 }] })
})

test('reportText is the /route answer: state, mode and the current decision', async () => {
  expect(reportText(base)).toBe('mixture-of-models live · mode auto · current route: glm-5.3 · coding via ollama · main session')
  expect(reportText({ ...base, ready: false, pin: { mode: 'off' } })).toBe('mixture-of-models observe-only (no gateway key for the child) · mode off · current route: glm-5.3 · coding via ollama · main session')
  expect(reportText({ ...base, disabled: true, pin: { mode: 'model', model: 'kimi-k3' } })).toBe('mixture-of-models disabled (child session) · mode model kimi-k3 · current route: glm-5.3 · coding via ollama · main session')
})
