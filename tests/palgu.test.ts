import { expect, test } from 'claude-code/testing'
import { CLIENT_ID, PALGU_BILLING, PALGU_GATEWAY, configureValues, isPalgu, deviceBody, deviceName, newInstallId, parsePalguArg, startText, statusText, tokenBody, tokenStep } from '../hooks/lib/palgu.js'
import { VERSION } from '../hooks/lib/version.js'

const res = (status, body) => ({ status, ok: status < 300, headers: {}, text: JSON.stringify(body) })

test('parsePalguArg reads login, status and upgrade, and anything else as help', async () => {
  expect(parsePalguArg('login')).toBe('login')
  expect(parsePalguArg(' Status ')).toBe('status')
  expect(parsePalguArg('upgrade')).toBe('upgrade')
  expect(parsePalguArg('')).toBe('help')
  expect(parsePalguArg('pay')).toBe('help')
})

test('deviceBody names the mod as its own client, with its version and install id', async () => {
  expect(CLIENT_ID).toBe('mixture-of-models')
  expect(deviceBody('Claude Code', 'id-1')).toEqual({ client_id: 'mixture-of-models', device: { name: 'Claude Code', client_version: VERSION, install_id: 'id-1' } })
  expect(tokenBody('dc-1')).toEqual({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: 'mixture-of-models', device_code: 'dc-1' })
})

test('deviceName strips what the gateway refuses and keeps at most 64 characters', async () => {
  expect(deviceName('ali-mbp')).toBe('Claude Code on ali-mbp')
  expect(deviceName('<b>x</b>\n')).toBe('Claude Code on bx/b')
  expect(deviceName('')).toBe('Claude Code')
  expect(deviceName('h'.repeat(100)).length).toBe(64)
})

test('newInstallId is a v4 UUID', async () => {
  expect(newInstallId(() => 0.5)).toBe('88888888-8888-4888-8888-888888888888')
  expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(newInstallId())).toBe(true)
})

test('tokenStep keeps polling while pending, slows down when told, and stops on every other error', async () => {
  expect(tokenStep(res(400, { error: 'authorization_pending' }), 5)).toEqual({ state: 'wait', interval: 5 })
  expect(tokenStep(res(400, { error: 'slow_down' }), 5)).toEqual({ state: 'wait', interval: 10 })
  expect(tokenStep(res(400, { error: 'expired_token' }), 5).state).toBe('stop')
  expect(tokenStep(res(400, { error: 'access_denied' }), 5).reason).toMatch(/denied/)
  expect(tokenStep(res(500, 'oops'), 5).state).toBe('stop')
})

test('tokenStep returns the key and who signed in on success', async () => {
  const ok = res(200, { access_token: 'srt_ab_cd', account: { email: 'dev@acme.com' }, org: { name: 'Acme', plan: 'team' } })
  expect(tokenStep(ok, 5)).toEqual({ state: 'ok', key: 'srt_ab_cd', email: 'dev@acme.com', org: 'Acme', plan: 'team' })
  expect(tokenStep(res(200, { token_type: 'Bearer' }), 5).state).toBe('stop')
})

test('configureValues points the child at the Palgu gateway with the new key, for --values-stdin', async () => {
  // gateway_provider too, so a LiteLLM or OpenRouter choice left over does not keep bearer auth on Palgu.
  expect(JSON.parse(configureValues('srt_x'))).toEqual({ gateway_url: PALGU_GATEWAY, gateway_key: 'srt_x', gateway_provider: 'palgu' })
  expect(PALGU_GATEWAY).toBe('https://api.palgu.ai/anthropic')
})

test('startText gives the link and the code to approve, and never the device code', async () => {
  const text = startText({ device_code: 'secret-dc', user_code: 'WDJB-MJHT', verification_uri_complete: 'https://www.palgu.ai/connect?code=WDJB-MJHT', expires_in: 600 })
  expect(text).toContain('https://www.palgu.ai/connect?code=WDJB-MJHT')
  expect(text).toContain('WDJB-MJHT')
  expect(text).toContain('10 minutes')
  expect(text).not.toContain('secret-dc')
})

test('isPalgu holds only for a gateway on the Palgu origin, so another gateway\'s key never goes to Palgu', async () => {
  expect(isPalgu('https://api.palgu.ai/anthropic')).toBe(true)
  expect(isPalgu('https://api.palgu.ai/anthropic/')).toBe(true)
  expect(isPalgu('https://api.z.ai/api/anthropic')).toBe(false)
  expect(isPalgu('https://api.palgu.ai.evil.com/anthropic')).toBe(false)
  expect(isPalgu('http://api.palgu.ai/anthropic')).toBe(false)
  expect(isPalgu('')).toBe(false)
})

test('statusText says who is signed in and on which plan, or how to sign in', async () => {
  expect(statusText(undefined)).toMatch(/not signed in.*\/palgu login/i)
  const me = { account: { email: 'dev@acme.com' }, org: { name: 'Acme', plan: 'team' } }
  expect(statusText(me)).toBe('Palgu: signed in as dev@acme.com (Acme, plan team) · upgrade: /palgu upgrade')
  expect(statusText(null)).toMatch(/key is set.*could not/i)
  expect(statusText('other')).toMatch(/not Palgu.*\/palgu login/)
  expect(PALGU_BILLING).toBe('https://www.palgu.ai/billing')
})
