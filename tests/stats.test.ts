import { expect, test } from 'claude-code/testing'
import { appendLog, bar, bumpStats, statsLine, summarize, usagePeriod, usageText } from '../hooks/lib/stats.js'

const SESSION = 'claude-opus-5'
const LOG = [
  { day: '2026-10-10', model: 'glm-5.3', kind: 'code', label: 'coding', score: 5, source: 'ollama', child: { ms: 8000, exitCode: 0 } },
  { day: '2026-10-10', model: 'glm-5.3', kind: 'docs', label: 'simple', score: 3, source: 'ollama', child: { ms: 4000, exitCode: 0 } },
  { day: '2026-10-10', model: 'kimi-k3.1-pro', kind: 'research', label: 'coding', score: 5, source: 'claude-haiku-4-5', child: { ms: 12000, exitCode: 0 } },
  { day: '2026-10-10', model: SESSION, kind: 'code', label: 'critical', score: 9, source: 'ollama', child: null },
  { day: '2026-10-09', model: 'glm-5.3', kind: 'code', label: 'coding', score: 6, source: 'ollama', child: { ms: 2000, exitCode: 1 } },
]

test('bumpStats counts routes per day and statsLine prints them', async () => {
  let stats = bumpStats({}, '2026-10-08', 'glm-5.3')
  stats = bumpStats(stats, '2026-10-08', 'glm-5.3')
  stats = bumpStats(stats, '2026-10-08', 'kimi-k3.1-pro')
  expect(stats['2026-10-08']).toEqual({ 'glm-5.3': 2, 'kimi-k3.1-pro': 1 })
  expect(statsLine(stats, '2026-10-08')).toBe('today: 3 turns, 3 off Claude (100%)')
  expect(statsLine(stats, '2026-10-09')).toBe('today: no turns yet')
  const mixed = { d: { 'claude-opus-5-5': 74, 'glm-5.3': 20, 'kimi-k3': 12, 'claude-opus-4-8': 9 } }
  expect(statsLine(mixed, 'd')).toBe('today: 115 turns, 32 off Claude (28%)')
  expect(statsLine({ d: { 'claude-opus-5': 1 } }, 'd')).toBe('today: 1 turn, 0 off Claude')
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
  expect(s.byModel).toEqual([{ model: 'glm-5.3', n: 3 }, { model: 'kimi-k3.1-pro', n: 1 }, { model: SESSION, n: 1 }])
  expect(s.byKind).toEqual([
    { kind: 'code', n: 3, models: { 'glm-5.3': 2, [SESSION]: 1 } },
    { kind: 'docs', n: 1, models: { 'glm-5.3': 1 } },
    { kind: 'research', n: 1, models: { 'kimi-k3.1-pro': 1 } },
  ])
  expect(s.byScore).toEqual([0, 0, 1, 0, 2, 1, 0, 0, 1, 0])
  expect(s.recent.length).toBe(5)
  expect(s.recent[0].model).toBe('glm-5.3')
  expect(s.child).toEqual({ runs: 4, failed: 1, avgMs: 6500 })
})

test('summarize of an empty log is all zeros', async () => {
  expect(summarize([], SESSION)).toEqual({ total: 0, offClaude: 0, byModel: [], byKind: [], byScore: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], recent: [], child: { runs: 0, failed: 0, avgMs: 0 } })
})

test('a turn on a Claude subscription child is not counted as off Claude', async () => {
  const log = [{ ...LOG[0], model: 'claude-sonnet-5-5' }, LOG[1]]
  expect(summarize(log, SESSION).offClaude).toBe(1)
})

const DAYS = {
  '2026-10-01': { 'glm-5.3': 9 },
  '2026-11-18': { 'glm-5.3': 3, 'claude-opus-5': 1 },
  '2026-11-23': { 'glm-5.3': 2, 'deepseek-pro': 1, 'claude-opus-5': 1 },
}
const SUBS = { '2026-11-20': { haiku: 3, sonnet: 1 }, '2026-11-23': { haiku: 1, 'claude-opus-5': 1 } }

test('usagePeriod reads today, week, month and all, and refuses anything else', async () => {
  expect(usagePeriod('')).toEqual({ days: 7, name: 'last 7 days' })
  expect(usagePeriod('today')).toEqual({ days: 1, name: 'today' })
  expect(usagePeriod('week')).toEqual({ days: 7, name: 'last 7 days' })
  expect(usagePeriod('month')).toEqual({ days: 30, name: 'last 30 days' })
  expect(usagePeriod('all')).toEqual({ days: 0, name: 'all time' })
  expect(usagePeriod('yesterday')).toBe(null)
})

test('usageText lists the models used in the period, most used first, with shares, the off-Claude share and subagent models', async () => {
  const text = usageText(DAYS, SUBS, { days: 7, name: 'last 7 days' }, '2026-11-23')
  expect(text).toBe([
    'Models used, last 7 days: 8 turns, 6 off Claude (75%)',
    '  glm-5.3        5  63%  ██████████',
    '  claude-opus-5  2  25%  ████░░░░░░',
    '  deepseek-pro   1  13%  ██░░░░░░░░',
    'Subagents: 6 · haiku 4 · sonnet 1 · claude-opus-5 1',
  ].join('\n'))
})

test('usageText over all time counts every day kept; with nothing in the period it says so', async () => {
  expect(usageText(DAYS, {}, { days: 0, name: 'all time' }, '2026-11-23').split('\n')[0]).toBe('Models used, all time: 17 turns, 15 off Claude (88%)')
  expect(usageText(DAYS, {}, { days: 1, name: 'today' }, '2026-11-24')).toBe('Models used, today: no turns yet')
})
