import { expect, test } from 'claude-code/testing'
import { subagentModel, subagentRule } from '../hooks/lib/subagents.js'

const RULES = { 'general-purpose': 'auto', Explore: 'simple', Plan: 'off' }
const MODELS = { simple: 'haiku', coding: 'sonnet' }
const spawn = (over = {}) => ({ prompt: 'find the TODOs', description: 'x', subagentType: 'general-purpose', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5', background: false, fork: false, ...over })

test('subagentRule: a built-in type the rules name, auto or a fixed tier; anything else is left alone', async () => {
  expect(subagentRule(spawn(), RULES)).toBe('auto')
  expect(subagentRule(spawn({ subagentType: 'Explore' }), RULES)).toBe('simple')
  expect(subagentRule(spawn({ subagentType: 'Plan' }), RULES)).toBe('')
  expect(subagentRule(spawn({ subagentType: 'security-reviewer' }), RULES)).toBe('')
  expect(subagentRule(spawn({ subagentType: 'general-purpose' }), { 'general-purpose': 'nonsense' })).toBe('')
})

test('subagentRule never touches a model already chosen, a fork, a teammate, a workflow agent or a plugin\'s agent', async () => {
  expect(subagentRule(spawn({ model: 'opus' }), RULES)).toBe('')
  expect(subagentRule(spawn({ fork: true }), RULES)).toBe('')
  expect(subagentRule(spawn({ isTeammate: true }), RULES)).toBe('')
  expect(subagentRule(spawn({ workflow: { runId: 'wf_1' } }), RULES)).toBe('')
  // A plugin's or your own agent may set model: in its definition, which the event does not show.
  expect(subagentRule(spawn({ provider: { plugin: 'some-plugin', tier: 'user' } }), RULES)).toBe('')
})

test('subagentModel: simple runs on Haiku, coding on Sonnet, critical keeps the parent\'s model', async () => {
  expect(subagentModel('simple', 'claude-opus-5', MODELS)).toBe('haiku')
  expect(subagentModel('coding', 'claude-opus-5', MODELS)).toBe('sonnet')
  expect(subagentModel('critical', 'claude-opus-5', MODELS)).toBe('')
})

test('subagentModel only ever moves to a cheaper Claude model than the parent\'s', async () => {
  expect(subagentModel('coding', 'claude-sonnet-5-5', MODELS)).toBe('')
  expect(subagentModel('simple', 'claude-sonnet-5-5', MODELS)).toBe('haiku')
  expect(subagentModel('coding', 'claude-haiku-5-5', MODELS)).toBe('')
  expect(subagentModel('simple', 'claude-haiku-5-5', MODELS)).toBe('')
  // A parent that is not a known Claude tier (a proxy model): nothing to compare against, left alone.
  expect(subagentModel('simple', 'glm-5.3', MODELS)).toBe('')
  // A tier model that is not a plain Claude alias or id is refused.
  expect(subagentModel('simple', 'claude-opus-5', { simple: 'gpt-6-sol; rm', coding: 'sonnet' })).toBe('')
})
