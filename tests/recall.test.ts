import { expect, test } from 'claude-code/testing'
import { recallQuery, recallBlock, withRecall, RECALL_LIMIT } from '../hooks/lib/recall.js'

const hit = (kind, title, file, snippet, score = 0.7) => ({ kind, ref: title, title, snippet, score, meta: file ? { file } : {} })
const res = (hits, extra = {}) => ({ ok: true, status: 200, text: JSON.stringify({ project: 'work', hits, indexed: true, ...extra }) })

test('recallQuery: the prompt, trimmed and capped; nothing for a short follow-up or a slash command', async () => {
  expect(recallQuery('how does the heartbeat decide to continue a turn')).toBe('how does the heartbeat decide to continue a turn')
  expect(recallQuery('  fix   the\nloader  bug ')).toBe('fix the loader bug')
  expect(recallQuery('x '.repeat(400)).length < 301).toBe(true)
  expect(recallQuery('continue')).toBe('')
  expect(recallQuery('yes do it')).toBe('')
  expect(recallQuery('/route stats please now')).toBe('')
  expect(recallQuery(undefined)).toBe('')
})

test('recallBlock lists what Palgu memory recalls: intent first, with file and snippet', async () => {
  const block = recallBlock(res([
    hit('doc', 'README.md#4', 'README.md', 'Scores it on two axes with one classifier call'),
    hit('intent', 'ADR-001: Delegate routed turns to a child process', null, 'ADR-001: Delegate routed turns to a child process', 0.8),
    hit('code', 'ts:hooks.lib.heartbeat.assessStop', 'hooks/lib/heartbeat.js', 'hooks/lib/heartbeat.js', 3)
  ]), 'work')
  expect(block.startsWith('Palgu memory for work')).toBe(true)
  const lines = block.split('\n').filter((l) => l.startsWith('- '))
  expect(lines[0]).toContain('[intent] ADR-001')
  expect(lines.some((l) => l.includes('[code] ts:hooks.lib.heartbeat.assessStop (hooks/lib/heartbeat.js)'))).toBe(true)
  expect(lines.some((l) => l.includes('[doc] README.md#4 (README.md): Scores it on two axes'))).toBe(true)
  // a snippet that only repeats the title or the file is not shown twice
  expect(block).not.toContain('ADR-001: Delegate routed turns to a child process: ADR-001')
  expect(block).toContain('verify against the files')
})

test('recallBlock keeps it short: at most RECALL_LIMIT hits and 2,000 characters, one line each', async () => {
  const many = Array.from({ length: 30 }, (_, i) => hit('doc', 'README.md#' + i, 'README.md', 'y'.repeat(1000) + '\nsecond line'))
  const block = recallBlock(res(many), 'work')
  expect(block.split('\n').filter((l) => l.startsWith('- ')).length).toBe(RECALL_LIMIT)
  expect(block.length < 2001).toBe(true)
  expect(block).not.toContain('second line')
})

test('recallBlock is empty for no hits, an unindexed project, a failed or malformed answer', async () => {
  expect(recallBlock(res([]), 'work')).toBe('')
  expect(recallBlock(res([hit('doc', 'a', 'a', 'b')], { indexed: false }), 'work')).toBe('')
  expect(recallBlock({ ok: false, status: 403, text: '{}' }, 'work')).toBe('')
  expect(recallBlock({ ok: true, status: 200, text: 'nope' }, 'work')).toBe('')
  expect(recallBlock(undefined, 'work')).toBe('')
})

test('withRecall adds the block to a child brief before the task, or leaves the brief alone', async () => {
  const brief = 'Preamble\n\nTask:\nfix the loader'
  expect(withRecall(brief, '')).toBe(brief)
  const out = withRecall(brief, 'Palgu memory for work:\n- [doc] a')
  expect(out).toBe('Preamble\n\nPalgu memory for work:\n- [doc] a\n\nTask:\nfix the loader')
  expect(withRecall('no task marker', 'M')).toBe('no task marker\n\nM')
})
