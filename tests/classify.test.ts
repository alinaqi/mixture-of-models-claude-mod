import { expect, test } from 'claude-code/testing'
import { SCORES, classifierPrompt, labelFor, ollamaBody, ollamaReply, parseScore, preClassify } from '../hooks/lib/classify.js'
import { DEFAULTS } from '../hooks/lib/config.js'

test('a slash command is skipped', async () => {
  expect(preClassify('/route glm', false)).toEqual({ kind: 'skip' })
})

test('"use claude" forces the critical tier', async () => {
  expect(preClassify('please use claude for this refactor', false)).toEqual({ kind: 'label', label: 'critical' })
})

test('execution intent forces the critical tier', async () => {
  expect(preClassify('ok now execute the plan', true)).toEqual({ kind: 'label', label: 'critical' })
})

test('a continuation phrase keeps the current route', async () => {
  expect(preClassify('Go ahead!', true)).toEqual({ kind: 'sticky' })
  expect(preClassify('yes', false)).toEqual({ kind: 'sticky' })
})

test('a short prompt in an agentic session keeps the current route', async () => {
  expect(preClassify('fix the failing test too', true)).toEqual({ kind: 'sticky' })
})

test('a short prompt in a fresh session is classified', async () => {
  expect(preClassify('fix the failing test too', false)).toEqual({ kind: 'classify' })
})

test('a long prompt is classified even mid-task', async () => {
  const text = 'rewrite the auth middleware so refresh tokens rotate and add tests for the expiry path'
  expect(preClassify(text, true)).toEqual({ kind: 'classify' })
})

test('an analysis-shaped prompt is routed to the analysis tier by rule', async () => {
  expect(preClassify('review this diff for mistakes and summarise the risks', false)).toEqual({ kind: 'label', label: 'analysis' })
  expect(preClassify('Summarize the last 3 PRs in one paragraph each', true)).toEqual({ kind: 'label', label: 'analysis' })
  expect(preClassify('explain how token refresh works in this repo', false)).toEqual({ kind: 'label', label: 'analysis' })
})

test('classifierPrompt asks for a 1-10 blast score with a rubric that ignores length and keys', async () => {
  const p = classifierPrompt('wire grokbot to apify, gemini and gpt via localhost tools and deploy to render')
  expect(p).toContain('1-10')
  expect(p).toMatch(/do not raise the score/i)
  expect(p).toContain('wire grokbot to apify')
  expect(SCORES).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
})

test('parseScore reads a 1-10 integer out of a noisy reply', async () => {
  expect(parseScore('5')).toBe(5)
  expect(parseScore('Score: 7 — multi-file integration')).toBe(7)
  expect(parseScore('10')).toBe(10)
  expect(parseScore('I would say 11')).toBeUndefined()
  expect(parseScore('no idea')).toBeUndefined()
  expect(parseScore('')).toBeUndefined()
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
