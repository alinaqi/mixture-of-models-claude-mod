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

test('bandButtons shows the routed providers, then every gateway family, framed by auto, claude and off', async () => {
  expect(bandButtons(DEFAULT_ROUTES)).toEqual([
    { key: 'pin-help', label: 'help', hotkey: '0', arg: 'help' },
    { key: 'pin-auto', label: 'auto', hotkey: '1', arg: 'auto' },
    { key: 'pin-glm', label: 'glm', hotkey: '2', arg: 'glm' },
    { key: 'pin-kimi', label: 'kimi', hotkey: '3', arg: 'kimi' },
    { key: 'pin-deepseek', label: 'deepseek', hotkey: '4', arg: 'deepseek' },
    { key: 'pin-mercury', label: 'mercury', hotkey: '5', arg: 'mercury' },
    { key: 'pin-gemini', label: 'gemini', hotkey: '6', arg: 'gemini' },
    { key: 'pin-claude', label: 'claude', hotkey: '7', arg: 'claude' },
    { key: 'pin-off', label: 'off', hotkey: '8', arg: 'off' },
  ])
})

test('bandText describes each state', async () => {
  expect(bandText({ ...base, disabled: true })).toBe('mixture-of-models · inactive inside a child session')
  expect(bandText({ ...base, ready: false })).toBe('mixture-of-models · observe-only: no gateway key for the child')
  expect(bandText({ ...base, pin: { mode: 'off' } })).toBe('mixture-of-models · off · everything on claude-opus-5')
  expect(bandText({ ...base, pin: { mode: 'model', model: 'kimi-k3.1-pro' }, decision: { label: 'pinned', model: 'kimi-k3.1-pro', source: 'pin' } })).toBe('mixture-of-models · pinned kimi-k3.1-pro')
  expect(bandText({ ...base, pin: { mode: 'label', label: 'coding' }, decision: { label: 'coding', model: 'glm-5.3', source: 'pin' } })).toBe('mixture-of-models · pinned coding → glm-5.3')
  expect(bandText(base)).toBe('mixture-of-models · auto · last: glm-5.3 (coding via ollama)')
  expect(bandText({ ...base, decision: { ...base.decision, score: 5, kind: 'code' } })).toBe('mixture-of-models · auto · last: glm-5.3 (coding 5/10 code via ollama)')
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
  expect(buttons.map((b) => b.label)).toEqual(['help', 'auto', 'glm', 'kimi', 'deepseek', 'mercury', 'gemini', 'claude', 'off'])
  expect(buttons.map((b) => b.dimColor)).toEqual([true, false, true, true, true, true, true, true, true])
  expect(buttons.every((b) => b.plain === true)).toBe(true)
  buttons[3].onPress()
  expect(pressed).toEqual(['kimi'])
  expect(tree.children[1]).toEqual({ type: 'engine', ref: 1 })
})

test('bandTree marks the pinned provider active and omits a missing "theirs"', async () => {
  const tree = bandTree(el, { ...base, routes: DEFAULT_ROUTES, pin: { mode: 'model', model: 'kimi-k3.1-pro' }, theirs: undefined }, () => {})
  const buttons = tree.children[0].children.slice(1)
  expect(buttons.map((b) => b.dimColor)).toEqual([true, true, true, false, true, true, true, true, true])
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
  expect(reportText({ ...base, disabled: true, pin: { mode: 'model', model: 'kimi-k3.1-pro' } })).toBe('mixture-of-models disabled (child session) · mode model kimi-k3.1-pro · current route: glm-5.3 · coding via ollama · main session')
})

test('tagText says where a child ran: gateway, Claude subscription or Codex', async () => {
  expect(tagText('glm-5.3', SESSION, 'gateway')).toBe('⇢ glm-5.3 · child on gateway')
  expect(tagText('claude-sonnet-5-5', SESSION, 'subscription')).toBe('⇢ claude-sonnet-5-5 · child on your Claude subscription')
  expect(tagText('codex', SESSION, 'codex')).toBe('⇢ codex · Codex child')
})

test('bandButtons gives family routes one button per family, and Claude members none of their own', async () => {
  const routes = { simple: 'claude/haiku', coding: 'kimi/auto', critical: 'claude/opus', kinds: { review: 'codex/auto' } }
  expect(bandButtons(routes).map((b) => b.arg)).toEqual(['help', 'auto', 'kimi', 'codex', 'glm', 'deepseek', 'mercury', 'gemini', 'claude', 'off'])
})

test('the band names a pinned family member, and a pinned member lights its family button', async () => {
  const pin = { mode: 'model', model: 'claude/sonnet' }
  const decision = { label: 'pinned', model: 'claude-sonnet-5-5', source: 'pin', family: 'claude', member: 'sonnet' }
  expect(bandText({ ...base, pin, decision })).toBe('mixture-of-models · pinned claude/sonnet → claude-sonnet-5-5')
  const tree = bandTree(el, { ...base, routes: DEFAULT_ROUTES, pin, decision }, () => {})
  const lit = tree.children[0].children.slice(1).filter((b) => !b.dimColor).map((b) => b.label)
  expect(lit).toEqual(['claude'])
})

test('bandButtons on OpenRouter shows its families, named by family not by vendor slug', async () => {
  const routes = { simple: 'glm/5.3', coding: 'glm/5.3', critical: 'claude', kinds: { research: 'kimi/pro', review: 'kimi/pro', multimodal: 'claude' } }
  const catalogue = ['glm/5.3', 'kimi/pro', 'deepseek/v4-pro', 'mercury/3', 'gemini/3.8-flash']
  expect(bandButtons(routes, catalogue).map((b) => b.arg)).toEqual(['help', 'auto', 'glm', 'kimi', 'deepseek', 'mercury', 'gemini', 'claude', 'off'])
})

test('bandTree takes the catalogue from the view', async () => {
  const catalogue = ['glm/5.3']
  const tree = bandTree(el, { ...base, routes: { simple: 'glm/5.3', critical: 'claude', kinds: {} }, catalogue }, () => {})
  expect(tree.children[0].children.slice(1).map((b) => b.label)).toEqual(['help', 'auto', 'glm', 'claude', 'off'])
})

test('the band and /route name a strategy other than the default', async () => {
  const fresh = { ...base, decision: { label: 'critical', model: '', source: 'default' } }
  expect(bandText({ ...fresh, strategy: 'cost' })).toBe('mixture-of-models · auto (cost) · no prompt yet')
  expect(bandText({ ...fresh, strategy: 'complexity' })).toBe('mixture-of-models · auto · no prompt yet')
  expect(reportText({ ...base, strategy: 'speed' })).toContain(' · strategy speed')
  expect(reportText({ ...base, strategy: 'complexity' })).not.toContain('strategy')
})
