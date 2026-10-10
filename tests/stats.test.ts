import { expect, test } from 'claude-code/testing'
import { appendLog, bar, bumpStats, statsLine, summarize } from '../hooks/lib/stats.js'

const SESSION = 'claude-opus-5'
const LOG = [
  { day: '2026-10-10', model: 'glm-5.3', kind: 'code', label: 'coding', score: 5, source: 'ollama', child: { ms: 8000, exitCode: 0 } },
  { day: '2026-10-10', model: 'glm-5.3', kind: 'docs', label: 'simple', score: 3, source: 'ollama', child: { ms: 4000, exitCode: 0 } },
  { day: '2026-10-10', model: 'kimi-k3', kind: 'research', label: 'coding', score: 5, source: 'claude-haiku-4-5', child: { ms: 12000, exitCode: 0 } },
  { day: '2026-10-10', model: SESSION, kind: 'code', label: 'critical', score: 9, source: 'ollama', child: null },
  { day: '2026-10-09', model: 'glm-5.3', kind: 'code', label: 'coding', score: 6, source: 'ollama', child: { ms: 2000, exitCode: 1 } },
]

test('bumpStats counts routes per day and statsLine prints them', async () => {
  let stats = bumpStats({}, '2026-10-08', 'glm-5.3')
  stats = bumpStats(stats, '2026-10-08', 'glm-5.3')
  stats = bumpStats(stats, '2026-10-08', 'kimi-k3')
  expect(stats['2026-10-08']).toEqual({ 'glm-5.3': 2, 'kimi-k3': 1 })
  expect(statsLine(stats, '2026-10-08')).toBe('today: glm-5.3 ×2, kimi-k3 ×1')
  expect(statsLine(stats, '2026-10-09')).toBe('today: no routed turns yet')
})

test('appendLog keeps the newest entries up to the cap', async () => {
  const log = appendLog([{ n: 1 }, { n: 2 }], { n: 3 }, 2)
  expect(log).toEqual([{ n: 2 }, { n: 3 }])
  expect(appendLog(undefined, { n: 1 }, 5)).toEqual([{ n: 1 }])
})

test('bar draws a proportional block bar of the given width', async () => {
  expect(bar(5, 10, 10)).toBe('█████░░░░░')
  expect(bar(10, 10, 4)).toBe('████')
  expect(bar(0, 10, 4)).toBe('░░░░')
  expect(bar(1, 0, 4)).toBe('░░░░')
})

test('summarize gives model shares, the off-Claude headline, kinds by model, a score histogram and recent turns', async () => {
  const s = summarize(LOG, SESSION)
  expect(s.total).toBe(5)
  expect(s.offClaude).toBe(4)
  expect(s.byModel).toEqual([{ model: 'glm-5.3', n: 3 }, { model: 'kimi-k3', n: 1 }, { model: SESSION, n: 1 }])
  expect(s.byKind).toEqual([
    { kind: 'code', n: 3, models: { 'glm-5.3': 2, [SESSION]: 1 } },
    { kind: 'docs', n: 1, models: { 'glm-5.3': 1 } },
    { kind: 'research', n: 1, models: { 'kimi-k3': 1 } },
  ])
  expect(s.byScore).toEqual([0, 0, 1, 0, 2, 1, 0, 0, 1, 0])
  expect(s.recent.length).toBe(5)
  expect(s.recent[0].model).toBe('glm-5.3')
  expect(s.child).toEqual({ runs: 4, failed: 1, avgMs: 6500 })
})

test('summarize of an empty log is all zeros', async () => {
  expect(summarize([], SESSION)).toEqual({ total: 0, offClaude: 0, byModel: [], byKind: [], byScore: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], recent: [], child: { runs: 0, failed: 0, avgMs: 0 } })
})
