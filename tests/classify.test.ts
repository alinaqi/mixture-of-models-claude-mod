import { expect, test } from 'claude-code/testing'
import { KINDS, SCORES, VERDICTS, classifierPrompt, labelFor, ollamaBody, ollamaReply, parseVerdict, preClassify } from '../hooks/lib/classify.js'
import { DEFAULTS } from '../hooks/lib/config.js'

test('a slash command is skipped', async () => {
  expect(preClassify('/route glm', {})).toEqual({ kind: 'skip' })
})

test('"use claude" forces the critical tier', async () => {
  expect(preClassify('please use claude for this refactor', {})).toEqual({ kind: 'label', label: 'critical' })
})

test('execution intent forces the critical tier', async () => {
  expect(preClassify('ok now execute the plan', { lastHadTools: true })).toEqual({ kind: 'label', label: 'critical' })
})

test('a continuation phrase keeps the current route while the main session is working', async () => {
  expect(preClassify('Go ahead!', { lastHadTools: true })).toEqual({ kind: 'sticky' })
  expect(preClassify('yes', {})).toEqual({ kind: 'sticky' })
})

test('a continuation after a child-answered turn goes back to the main session, which holds the transcript', async () => {
  expect(preClassify('continue', { lastWasChild: true })).toEqual({ kind: 'main', reason: 'continuation after a child turn' })
  expect(preClassify('now add tests for it', { lastWasChild: true })).toEqual({ kind: 'main', reason: 'follow-up after a child turn' })
})

test('a long new task after a child turn is classified afresh', async () => {
  const text = 'write a completely separate script that exports all invoices from the last quarter as csv with totals'
  expect(preClassify(text, { lastWasChild: true })).toEqual({ kind: 'classify' })
})

test('a short prompt in an agentic session keeps the current route', async () => {
  expect(preClassify('fix the failing test too', { lastHadTools: true })).toEqual({ kind: 'sticky' })
})

test('a short prompt in a fresh session is classified', async () => {
  expect(preClassify('fix the failing test too', {})).toEqual({ kind: 'classify' })
})

test('a long prompt is classified even mid-task', async () => {
  const text = 'rewrite the auth middleware so refresh tokens rotate and add tests for the expiry path'
  expect(preClassify(text, { lastHadTools: true })).toEqual({ kind: 'classify' })
})

test('a review-shaped prompt is classified like any other; the kind comes from the classifier', async () => {
  expect(preClassify('review this diff for mistakes and summarise the risks', {})).toEqual({ kind: 'classify' })
})

test('classifierPrompt asks for a 1-10 blast score and a task kind, with the difficulty clause', async () => {
  const p = classifierPrompt('wire grokbot to apify, gemini and gpt via localhost tools and deploy to render')
  expect(p).toContain('1-10')
  expect(p).toMatch(/do not raise the score/i)
  expect(p).toMatch(/at least 7/)
  for (const k of KINDS) expect(p).toContain(k)
  expect(p).toContain('wire grokbot to apify')
  expect(SCORES).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  expect(KINDS).toEqual(['code', 'research', 'review', 'docs', 'data', 'multimodal'])
  expect(VERDICTS.length).toBe(60)
  expect(VERDICTS).toContain('6 code')
})

test('parseVerdict reads the score and the kind out of a noisy reply', async () => {
  expect(parseVerdict('6 code')).toEqual({ score: 6, kind: 'code' })
  expect(parseVerdict('Score: 7, kind: review')).toEqual({ score: 7, kind: 'review' })
  expect(parseVerdict('10 multimodal')).toEqual({ score: 10, kind: 'multimodal' })
  expect(parseVerdict('5')).toEqual({ score: 5, kind: 'code' })
  expect(parseVerdict('I would say 11')).toBeUndefined()
  expect(parseVerdict('no idea')).toBeUndefined()
  expect(parseVerdict('')).toBeUndefined()
})

test('labelFor maps a score to a tier through the thresholds', async () => {
  const th = DEFAULTS.thresholds
  expect(th).toEqual({ simple: 3, coding: 7 })
  expect(labelFor(1, th)).toBe('simple')
  expect(labelFor(3, th)).toBe('simple')
  expect(labelFor(4, th)).toBe('coding')
  expect(labelFor(7, th)).toBe('coding')
  expect(labelFor(8, th)).toBe('critical')
  expect(labelFor(10, th)).toBe('critical')
  expect(labelFor(6, { simple: 2, coding: 5 })).toBe('critical')
})

test('ollamaBody is a non-streaming chat request', async () => {
  const body = JSON.parse(ollamaBody('qwen2.5-coder:3b', 'hello'))
  expect(body.model).toBe('qwen2.5-coder:3b')
  expect(body.stream).toBe(false)
  expect(body.messages[0].content).toBe('hello')
})

test('ollamaReply reads message.content and tolerates bad JSON', async () => {
  expect(ollamaReply('{"message":{"content":"simple: grep"}}')).toBe('simple: grep')
  expect(ollamaReply('not json')).toBe('')
  expect(ollamaReply('{}')).toBe('')
})
