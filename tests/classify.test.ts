import { expect, test } from 'claude-code/testing'
import { classifierPrompt, ollamaBody, ollamaReply, parseLabel, preClassify } from '../hooks/lib/classify.js'

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

test('parseLabel reads the label out of a noisy reply', async () => {
  expect(parseLabel('CODING: small single-file fix')).toBe('coding')
  expect(parseLabel('Analysis — long document summary')).toBe('analysis')
  expect(parseLabel('I think simple')).toBe('simple')
  expect(parseLabel('no idea')).toBeUndefined()
  expect(parseLabel('')).toBeUndefined()
})

test('classifierPrompt names every label and carries the task', async () => {
  const p = classifierPrompt('grep for TODOs')
  for (const label of ['simple', 'coding', 'analysis', 'critical']) expect(p).toContain(label)
  expect(p).toContain('grep for TODOs')
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
