import { expect, test } from 'claude-code/testing'
import { DEFAULTS, parseConfig } from '../hooks/lib/config.js'
import { autoMember, checkRoute, familiesText, isAutoRoute, routeValue, splitRoute, targetFor } from '../hooks/lib/families.js'

const FAM = DEFAULTS.families
const SESSION = 'claude-opus-5-5'
const coding = { label: 'coding', score: 5, kind: 'code' }

test('the Claude family names the four Claude 5 members by exact id', async () => {
  expect(FAM.claude.members).toEqual({ fable: 'claude-fable-5-1', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' })
  expect(FAM.claude.auto).toEqual({ simple: 'haiku', coding: 'sonnet', critical: 'opus' })
})

test('gateway families come from the gateway catalogue, kimi with friendly aliases', async () => {
  expect(FAM.kimi.members).toEqual({ pro: 'kimi-k3.1-pro', highspeed: 'kimi-k3.1-pro-highspeed' })
  expect(FAM.kimi.auto).toEqual({ simple: 'highspeed', coding: 'pro', critical: 'pro' })
  expect(FAM.glm.members).toEqual({ '5.3': 'glm-5.3' })
  expect(FAM.deepseek.members).toEqual({ 'v4-pro': 'deepseek-v4-pro' })
  expect(FAM.mercury).toBe(undefined)
  expect(FAM.minimax.members).toEqual({ m3: 'minimax-m3', 'm2.5': 'minimax-m2.5' })
  expect(FAM.gpt.members).toEqual({ sol: 'gpt-6-sol', luna: 'gpt-6-luna', astra: 'gpt-6-astra' })
  expect(FAM.gpt.auto).toEqual({ simple: 'luna', coding: 'sol', critical: 'astra' })
  expect(FAM.gemini.members).toEqual({ '3.8-flash': 'gemini-3.8-flash' })
  expect(FAM.codex).toEqual({ members: {}, auto: {} })
})

test('splitRoute reads <family>/<member>, a bare family and a plain model id', async () => {
  expect(splitRoute('claude/sonnet')).toEqual({ family: 'claude', member: 'sonnet' })
  expect(splitRoute('kimi/auto')).toEqual({ family: 'kimi', member: 'auto' })
  expect(splitRoute('codex/gpt-5.6-terra')).toEqual({ family: 'codex', member: 'gpt-5.6-terra' })
  expect(splitRoute('claude')).toEqual({ family: 'claude', member: '' })
  expect(splitRoute('codex')).toEqual({ family: 'codex', member: '' })
  expect(splitRoute('glm-5.3')).toEqual({ family: '', member: 'glm-5.3' })
  expect(isAutoRoute('claude/auto')).toBe(true)
  expect(isAutoRoute('claude/opus')).toBe(false)
  expect(isAutoRoute('glm-5.3')).toBe(false)
})

test('autoMember picks by tier, never leaves the family, and fable is opt-in critical-plus', async () => {
  expect(autoMember(FAM.claude, { label: 'simple', score: 2 })).toBe('haiku')
  expect(autoMember(FAM.claude, coding)).toBe('sonnet')
  expect(autoMember(FAM.claude, { label: 'critical', score: 10 })).toBe('opus')
  const plus = { ...FAM.claude, auto: { ...FAM.claude.auto, criticalPlus: 'fable' } }
  expect(autoMember(plus, { label: 'critical', score: 10 })).toBe('fable')
  expect(autoMember(plus, { label: 'critical', score: 9 })).toBe('opus')
  // no tier map: the first member, or nothing for an open family like codex
  expect(autoMember(FAM.glm, coding)).toBe('5.3')
  expect(autoMember(FAM.codex, coding)).toBe('')
})

test('targetFor: bare claude is the main session, exactly as before', async () => {
  expect(targetFor('claude', coding, FAM, SESSION)).toEqual({ runner: 'main', model: SESSION, id: SESSION, family: '', member: '', auto: false })
})

test('targetFor: a plain gateway id goes to the gateway child, unchanged', async () => {
  expect(targetFor('glm-5.3', coding, FAM, SESSION)).toEqual({ runner: 'gateway', model: 'glm-5.3', id: 'glm-5.3', family: '', member: '', auto: false })
})

test('targetFor: a Claude member runs on the subscription, or the main session when it is the session model', async () => {
  expect(targetFor('claude/sonnet', coding, FAM, SESSION)).toEqual({ runner: 'subscription', model: 'claude-sonnet-5-5', id: 'claude-sonnet-5-5', family: 'claude', member: 'sonnet', auto: false })
  expect(targetFor('claude/opus', coding, FAM, SESSION).runner).toBe('main')
  expect(targetFor('claude/opus', coding, FAM, 'claude-opus-5-5[1m]').runner).toBe('main')
  expect(targetFor('claude/claude-haiku-5-5', coding, FAM, SESSION).member).toBe('claude-haiku-5-5')
  expect(targetFor('claude/claude-haiku-5-5', coding, FAM, SESSION).id).toBe('claude-haiku-5-5')
})

test('targetFor: family/auto resolves a member from the tier', async () => {
  expect(targetFor('claude/auto', { label: 'simple', score: 1 }, FAM, SESSION)).toMatchObject({ runner: 'subscription', id: 'claude-haiku-5-5', member: 'haiku', auto: true })
  expect(targetFor('kimi/auto', { label: 'simple', score: 1 }, FAM, SESSION)).toMatchObject({ runner: 'gateway', id: 'kimi-k3.1-pro-highspeed', family: 'kimi', member: 'highspeed' })
  expect(targetFor('kimi/auto', coding, FAM, SESSION)).toMatchObject({ runner: 'gateway', id: 'kimi-k3.1-pro' })
  expect(targetFor('kimi/highspeed', coding, FAM, SESSION).id).toBe('kimi-k3.1-pro-highspeed')
})

test('targetFor: codex, codex/<model> and codex/auto run the Codex child', async () => {
  expect(targetFor('codex', coding, FAM, SESSION)).toEqual({ runner: 'codex', model: 'codex', id: '', family: 'codex', member: '', auto: false })
  expect(targetFor('codex/gpt-5.6-terra', coding, FAM, SESSION)).toMatchObject({ runner: 'codex', model: 'gpt-5.6-terra', id: 'gpt-5.6-terra' })
  expect(targetFor('codex/auto', coding, FAM, SESSION)).toMatchObject({ runner: 'codex', id: '', auto: true })
  const fam = parseConfig('{"router":{"families":{"codex":{"members":{"terra":"gpt-5.6-terra"},"auto":{"coding":"terra"}}}}}').families
  expect(targetFor('codex/auto', coding, fam, SESSION)).toMatchObject({ runner: 'codex', id: 'gpt-5.6-terra', member: 'terra' })
})

test('targetFor: an unknown family stays on the main session rather than sending a bad id', async () => {
  expect(targetFor('nope/x', coding, FAM, SESSION).runner).toBe('main')
})

test('routeValue: the tier picks the route, the kind overrides below Claude, never a Claude-family tier', async () => {
  const routes = { simple: 'claude/haiku', coding: 'glm-5.3', critical: 'claude/opus', kinds: { research: 'kimi/auto' } }
  expect(routeValue({ label: 'coding', kind: 'research' }, routes)).toBe('kimi/auto')
  expect(routeValue({ label: 'coding', kind: 'code' }, routes)).toBe('glm-5.3')
  expect(routeValue({ label: 'critical', kind: 'research' }, routes)).toBe('claude/opus')
  expect(routeValue({ label: 'simple', kind: 'research' }, routes)).toBe('claude/haiku')
  expect(routeValue({ label: 'main' }, routes)).toBe('claude')
})

test('checkRoute accepts known families and members, any codex model, and names what is wrong', async () => {
  expect(checkRoute('claude/sonnet', FAM)).toBe('')
  expect(checkRoute('claude/auto', FAM)).toBe('')
  expect(checkRoute('kimi/auto', FAM)).toBe('')
  expect(checkRoute('codex/gpt-5.6-terra', FAM)).toBe('')
  expect(checkRoute('glm-5.3', FAM)).toBe('')
  expect(checkRoute('claude/gpt', FAM)).toMatch(/claude has no member gpt.*fable, opus, sonnet, haiku/)
  expect(checkRoute('nope/x', FAM)).toMatch(/unknown family nope/)
})

test('familiesText lists each family and its members for /route status', async () => {
  expect(familiesText(FAM)).toContain('claude: fable, opus, sonnet, haiku')
  expect(familiesText(FAM)).toContain('kimi: pro, highspeed')
  expect(familiesText(FAM)).toContain('codex: any model')
})

test('families in the config merge over the defaults per family', async () => {
  const cfg = parseConfig('{"router":{"families":{"claude":{"members":{"opus":"claude-opus-5-6"},"auto":{"coding":"opus"}}}}}')
  expect(cfg.families.claude.members.opus).toBe('claude-opus-5-6')
  expect(cfg.families.claude.members.haiku).toBe('claude-haiku-5-5')
  expect(cfg.families.claude.auto).toEqual({ simple: 'haiku', coding: 'opus', critical: 'opus' })
  expect(cfg.families.kimi).toEqual(FAM.kimi)
})

const OR = parseConfig('', { gateway_url: 'https://openrouter.ai/api' }).families

test('on OpenRouter a family route resolves to its OpenRouter slug, on the gateway', async () => {
  expect(targetFor('glm/5.3', coding, OR, SESSION)).toEqual({ runner: 'gateway', model: 'z-ai/glm-5.3', id: 'z-ai/glm-5.3', family: 'glm', member: '5.3', auto: false })
  expect(targetFor('kimi/auto', coding, OR, SESSION).id).toBe('moonshotai/kimi-k3.1-pro')
})

test('a full slug that a family lists is that member, not an unknown family', async () => {
  expect(targetFor('z-ai/glm-5.3', coding, OR, SESSION)).toEqual({ runner: 'gateway', model: 'z-ai/glm-5.3', id: 'z-ai/glm-5.3', family: 'glm', member: '5.3', auto: false })
  expect(checkRoute('moonshotai/kimi-k3.1-pro', OR)).toBe('')
  expect(checkRoute('z-ai/glm-9', OR)).toMatch(/unknown family z-ai/)
  expect(targetFor('z-ai/glm-9', coding, OR, SESSION).runner).toBe('main')
})
