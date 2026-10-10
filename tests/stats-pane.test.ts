import { expect, test } from 'claude-code/testing'
import { paneTree } from '../hooks/lib/stats-pane.js'
import { summarize } from '../hooks/lib/stats.js'

const el = {
  Box: (p) => ({ type: 'Box', ...p }),
  Text: (p) => ({ type: 'Text', ...p }),
  Button: (p) => ({ type: 'Button', ...p }),
}
const SESSION = 'claude-opus-5'
const LOG = [
  { day: '2026-10-10', model: 'glm-5.3', kind: 'code', label: 'coding', score: 5, source: 'ollama', child: { ms: 8000, exitCode: 0 } },
  { day: '2026-10-10', model: 'kimi-k3', kind: 'research', label: 'coding', score: 5, source: 'ollama', child: { ms: 12000, exitCode: 0 } },
  { day: '2026-10-10', model: SESSION, kind: 'code', label: 'critical', score: 9, source: 'ollama', child: null },
]
const view = { summary: summarize(LOG, SESSION), sessionModel: SESSION, thresholds: { simple: 3, coding: 7 }, columns: 60 }

// One string per drawn line: a row Box joins its texts, anything else recurses.
function texts(node, out = []) {
  if (!node) return out
  if (node.type === 'Text') out.push((node.children || []).join(''))
  else if (node.type === 'Box' && node.flexDirection === 'row') out.push((node.children || []).map((c) => (c.children || []).join('')).join(' '))
  else for (const c of node.children || []) if (c && typeof c === 'object') texts(c, out)
  return out
}

test('the models tab has a tab row, the headline and one bar per model', async () => {
  const pressed = []
  const tree = paneTree(el, { ...view, tab: 'models' }, (t) => pressed.push(t))
  const tabs = tree.children[0].children
  expect(tabs.map((b) => b.label)).toEqual(['models', 'kinds', 'scores', 'recent'])
  expect(tabs.map((b) => b.hotkey)).toEqual(['1', '2', '3', '4'])
  expect(tabs.map((b) => b.dimColor)).toEqual([false, true, true, true])
  tabs[2].onPress()
  expect(pressed).toEqual(['scores'])
  const all = texts(tree).join('\n')
  expect(all).toMatch(/2 of 3 turns off Claude \(67%\)/)
  expect(all).toMatch(/glm-5\.3 .*█.* 1 · 33%/)
  expect(all).toMatch(/claude-opus-5 .* 1 · 33%/)
})

test('the kinds tab lists each kind with its models', async () => {
  const all = texts(paneTree(el, { ...view, tab: 'kinds' }, () => {})).join('\n')
  expect(all).toMatch(/code .*2/)
  expect(all).toMatch(/glm-5\.3 1/)
  expect(all).toMatch(/research .*1/)
})

test('the scores tab is a 1-10 histogram with the cut-offs marked', async () => {
  const all = texts(paneTree(el, { ...view, tab: 'scores' }, () => {})).join('\n')
  expect(all).toMatch(/ 5 .*██/)
  expect(all).toMatch(/ 9 .*█/)
  expect(all).toMatch(/simple ≤ 3 · coding ≤ 7 · critical above/)
})

test('the recent tab lists the newest decisions first with score, kind, model and where they ran', async () => {
  const all = texts(paneTree(el, { ...view, tab: 'recent' }, () => {}))
  expect(all.join('\n')).toMatch(/9\/10 code .*claude-opus-5 .*main/)
  expect(all.join('\n')).toMatch(/5\/10 research .*kimi-k3 .*12s/)
  const idx = (s) => all.findIndex((t) => t.includes(s))
  expect(idx('claude-opus-5') < idx('kimi-k3')).toBe(true)
})

test('an empty log draws a hint instead of bars', async () => {
  const all = texts(paneTree(el, { ...view, summary: summarize([], SESSION), tab: 'models' }, () => {})).join('\n')
  expect(all).toMatch(/No turns recorded yet/)
})
