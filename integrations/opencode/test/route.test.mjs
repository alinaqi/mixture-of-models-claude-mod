import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromVerdict, knownModels, preRoute, routeArg, routeHeaders, routingOptions } from '../lib/route.js'

const routes = { critical: 'claude-opus' }
const ctx = (o = {}) => ({ pin: 'auto', routes, last: '', ...o })

test('routingOptions takes routes and a critical model from the plugin options, nothing else', () => {
  assert.deepEqual(routingOptions({}).routes, {})
  assert.deepEqual(routingOptions({ critical: 'claude-opus' }).routes, { critical: 'claude-opus' })
  assert.deepEqual(routingOptions({ routes: { simple: 'gemini-3.8-flash', bogus: 'x', coding: 7 } }).routes, { simple: 'gemini-3.8-flash' })
  assert.equal(routingOptions({}).provider, 'palgu')
  assert.equal(routingOptions({ provider: 'gw' }).provider, 'gw')
  assert.deepEqual(routingOptions({}).thresholds, { simple: 3, coding: 7 })
})

test('a /route pin wins over everything', () => {
  assert.deepEqual(preRoute('refactor the whole auth module please', ctx({ pin: 'deepseek-pro' })), { model: 'deepseek-pro', label: 'pinned', reason: 'pin' })
})

test('with no routes configured Palgu routes every prompt (auto) and nothing is classified', () => {
  const r = preRoute('design the auth architecture for the new service', ctx({ routes: {} }))
  assert.deepEqual(r, { model: 'auto', label: 'auto', reason: 'Palgu routes' })
})

test('critical work takes the configured critical model: the mod\'s rules first', () => {
  assert.equal(preRoute('use claude to plan the migration', ctx()).model, 'claude-opus')
  assert.equal(preRoute('review this auth module for a security vulnerability', ctx()).model, 'claude-opus')
  assert.equal(preRoute('review this auth module for a security vulnerability', ctx({ routes: { simple: 'x-1' } })).model, 'auto')
})

test('slash commands go to auto; continuations stay on the last model', () => {
  assert.equal(preRoute('/init', ctx()).model, 'auto')
  assert.equal(preRoute('continue', ctx({ last: 'deepseek-pro' })).model, 'deepseek-pro')
  assert.equal(preRoute('continue', ctx()).model, 'auto')
})

test('anything else asks for a classification when routes are configured', () => {
  assert.deepEqual(preRoute('add a retry to the http client and test it', ctx()), { classify: true })
})

test('fromVerdict maps the score to a tier and the tier to its route, else auto', () => {
  const t = { simple: 3, coding: 7 }
  assert.deepEqual(fromVerdict({ score: 9, kind: 'code' }, { routes, thresholds: t }), { model: 'claude-opus', label: 'critical', reason: 'classifier 9 code' })
  assert.deepEqual(fromVerdict({ score: 2, kind: 'docs' }, { routes, thresholds: t }), { model: 'auto', label: 'simple', reason: 'classifier 2 docs' })
  assert.deepEqual(fromVerdict(undefined, { routes, thresholds: t }), { model: 'auto', label: 'auto', reason: 'no classifier: Palgu routes' })
})

test('routeHeaders names the client and the project, and pins only a named model', () => {
  assert.deepEqual(routeHeaders('auto', '/Users/me/code/Palgu Web', '0.27.0'), { 'x-srooter-client': 'mixture-of-models-opencode/0.27.0', 'x-srooter-project': 'palgu-web' })
  assert.equal(routeHeaders('deepseek-pro', '/w/app', '1.0.0')['x-srooter-pin'], 'deepseek-pro')
  assert.equal('x-srooter-project' in routeHeaders('auto', '/', '1.0.0'), false)
})

test('routeArg reads /route arguments against the models the provider knows', () => {
  const known = ['auto', 'deepseek-pro', 'gemini-3.8-flash']
  assert.deepEqual(routeArg('', known), { kind: 'status' })
  assert.deepEqual(routeArg('status', known), { kind: 'status' })
  assert.deepEqual(routeArg(' auto ', known), { kind: 'pin', model: 'auto' })
  assert.deepEqual(routeArg('deepseek-pro', known), { kind: 'pin', model: 'deepseek-pro' })
  assert.deepEqual(routeArg('gemini', known), { kind: 'pin', model: 'gemini-3.8-flash' })
  assert.equal(routeArg('nope', known).kind, 'error')
  assert.match(routeArg('nope', known).text, /deepseek-pro/)
})

test('knownModels reads the provider\'s models from the OpenCode config, auto first', () => {
  const cfg = { provider: { palgu: { models: { 'deepseek-pro': {}, auto: {} } } } }
  assert.deepEqual(knownModels(cfg, 'palgu'), ['auto', 'deepseek-pro'])
  assert.deepEqual(knownModels({}, 'palgu'), [])
})
