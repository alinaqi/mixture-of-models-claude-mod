import { expect, test } from 'claude-code/testing'
import { bumpStats, statsLine } from '../hooks/lib/stats.js'

test('bumpStats counts routes per day and statsLine prints them', async () => {
  let stats = bumpStats({}, '2026-10-08', 'glm-5.3')
  stats = bumpStats(stats, '2026-10-08', 'glm-5.3')
  stats = bumpStats(stats, '2026-10-08', 'kimi-k3')
  expect(stats['2026-10-08']).toEqual({ 'glm-5.3': 2, 'kimi-k3': 1 })
  expect(statsLine(stats, '2026-10-08')).toBe('today: glm-5.3 ×2, kimi-k3 ×1')
  expect(statsLine(stats, '2026-10-09')).toBe('today: no routed turns yet')
})
