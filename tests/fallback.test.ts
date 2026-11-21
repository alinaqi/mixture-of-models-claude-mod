import { expect, test } from 'claude-code/testing'
import { failureOf, fallbackNote, gatewayIds, nextModels } from '../hooks/lib/fallback.js'

const LIVE = {
  served: ['glm-5.3', 'deepseek-pro', 'kimi-k3.1-pro', 'gemini-3.8-flash', 'minimax-m2.5', 'grok-4.7'],
  down: ['gpt-6-sol'],
  classes: { 'glm-5.3': 'frontier', 'deepseek-pro': 'frontier', 'kimi-k3.1-pro': 'frontier', 'gemini-3.8-flash': 'workhorse', 'minimax-m2.5': 'workhorse', 'grok-4.7': 'frontier', 'gpt-6-sol': 'frontier' },
}
const CTX = { live: LIVE, catalogue: ['glm-5.3', 'deepseek-pro', 'gpt-6-sol', 'kimi-k3.1-pro'], longContext: ['gemini-3.8-flash', 'gpt-6-sol'], max: 3 }
const err = (status, text = '') => ({ ok: false, error: { status, text } })

test('failureOf: a 429, a 5xx, an overload, a timeout or no answer at all is an overload, worth another model', async () => {
  expect(failureOf(err(429, 'API Error: 429 rate limited'))).toEqual({ kind: 'overload', why: '429' })
  expect(failureOf(err(529, 'Overloaded'))).toEqual({ kind: 'overload', why: '529' })
  expect(failureOf(err(503))).toEqual({ kind: 'overload', why: '503' })
  expect(failureOf(err(null, 'Command timed out after 600000ms'))).toEqual({ kind: 'overload', why: 'timeout' })
  expect(failureOf(err(null, 'API Error: Connection error.'))).toEqual({ kind: 'overload', why: 'connection error' })
  expect(failureOf(err(null, ''))).toEqual({ kind: 'overload', why: 'no answer' })
  expect(failureOf({ ok: false })).toEqual({ kind: 'overload', why: 'no answer' })
})

test('failureOf: a bad request is a request error, which another model would only repeat', async () => {
  expect(failureOf(err(400, 'API Error: 400 invalid_request_error'))).toEqual({ kind: 'request', why: '400' })
  expect(failureOf(err(401, 'Failed to authenticate. API Error: 401'))).toEqual({ kind: 'request', why: '401' })
  expect(failureOf(err(403, 'pin \'x\' not allowed by policy'))).toEqual({ kind: 'request', why: '403' })
})

test('failureOf: a context that does not fit is its own kind, whatever the status', async () => {
  expect(failureOf(err(400, 'API Error: 400 prompt is too long: 210000 tokens > 200000 maximum'))).toEqual({ kind: 'context', why: 'context too long' })
  expect(failureOf(err(null, 'Prompt is too long'))).toEqual({ kind: 'context', why: 'context too long' })
  expect(failureOf(err(400, 'This model\'s maximum context length is 131072 tokens'))).toEqual({ kind: 'context', why: 'context too long' })
  expect(failureOf(err(413, 'Request too large'))).toEqual({ kind: 'context', why: 'context too long' })
})

test('nextModels after an overload: the same class first, then the other healthy models, never a down one', async () => {
  expect(nextModels('deepseek-pro', 'overload', { ...CTX, max: 10 })).toEqual(['glm-5.3', 'kimi-k3.1-pro', 'grok-4.7', 'gemini-3.8-flash', 'minimax-m2.5'])
  expect(nextModels('deepseek-pro', 'overload', CTX)).toEqual(['glm-5.3', 'kimi-k3.1-pro', 'grok-4.7'])
})

test('nextModels without a live list walks the catalogue', async () => {
  expect(nextModels('deepseek-pro', 'overload', { ...CTX, live: null })).toEqual(['glm-5.3', 'gpt-6-sol', 'kimi-k3.1-pro'])
})

test('nextModels for a model the live list does not know still offers the healthy ones', async () => {
  expect(nextModels('my-proxy-model', 'overload', { ...CTX, max: 2 })).toEqual(['glm-5.3', 'deepseek-pro'])
})

test('nextModels after a context error: the larger-window models only, healthy and not the one that failed', async () => {
  expect(nextModels('deepseek-pro', 'context', CTX)).toEqual(['gemini-3.8-flash'])
  expect(nextModels('gemini-3.8-flash', 'context', { ...CTX, live: null })).toEqual(['gpt-6-sol'])
})

test('nextModels after a request error is empty: the main model takes it', async () => {
  expect(nextModels('deepseek-pro', 'request', CTX)).toEqual([])
})

test('nextModels with max 0 turns the mod-side fallback off', async () => {
  expect(nextModels('deepseek-pro', 'overload', { ...CTX, max: 0 })).toEqual([])
})

test('fallbackNote names what failed and what served the turn', async () => {
  expect(fallbackNote([{ model: 'deepseek-pro', why: '429' }], 'glm-5.3')).toBe('child: deepseek-pro failed (429) → served by glm-5.3')
  expect(fallbackNote([{ model: 'deepseek-pro', why: '429' }, { model: 'glm-5.3', why: 'timeout' }], 'kimi-k3.1-pro'))
    .toBe('child: deepseek-pro failed (429), glm-5.3 failed (timeout) → served by kimi-k3.1-pro')
})

test('fallbackNote with nothing served lists every model tried before the main model takes the turn', async () => {
  expect(fallbackNote([{ model: 'deepseek-pro', why: '429' }, { model: 'glm-5.3', why: '529' }], ''))
    .toBe('all equivalents failed: deepseek-pro (429), glm-5.3 (529); main model takes this turn')
  // One model and a request error: no equivalents were tried, so it does not claim they were.
  expect(fallbackNote([{ model: 'deepseek-pro', why: '400' }], '')).toBe('child on deepseek-pro failed (400), main model takes this turn')
})

test('fallbackNote is empty when the first model answered', async () => {
  expect(fallbackNote([], 'glm-5.3')).toBe('')
})

test('gatewayIds turns family routes (as OpenRouter lists them) into the ids the child runs, plain ids as they are', async () => {
  const families = { glm: { members: { '5.3': 'z-ai/glm-5.3' } }, kimi: { members: { pro: 'moonshotai/kimi-k3.1-pro' } } }
  expect(gatewayIds(['glm/5.3', 'kimi/pro', 'nope/x'], families)).toEqual(['z-ai/glm-5.3', 'moonshotai/kimi-k3.1-pro'])
  expect(gatewayIds(['glm-5.3', 'deepseek-pro'], families)).toEqual(['glm-5.3', 'deepseek-pro'])
})
