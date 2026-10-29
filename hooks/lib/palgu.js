// /palgu: sign up or sign in to Palgu from the terminal with its device-code sign-in (RFC 8628,
// srooter ADR-102), and save the per-device key it mints as the child's gateway. Pure.

import { VERSION } from './version.js'

export const CLIENT_ID = 'mixture-of-models'
export const PALGU_ORIGIN = 'https://api.palgu.ai'
export const PALGU_GATEWAY = PALGU_ORIGIN + '/anthropic'
export const PALGU_BILLING = 'https://www.palgu.ai/billing'
export const PLUGIN_ID = 'mixture-of-models@mixture-of-models-claude-mod'
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

export const HELP = '/palgu login: sign up or sign in to Palgu and use its models for routed turns · /palgu status: who is signed in, on which plan · /palgu upgrade: plans and billing'

// The key may go to Palgu only when the gateway is Palgu: an exact https origin match, so a
// look-alike host or another provider's endpoint never receives it.
export function isPalgu(gatewayUrl) {
  const url = String(gatewayUrl || '')
  return url === PALGU_ORIGIN || url.startsWith(PALGU_ORIGIN + '/')
}

export function parsePalguArg(args) {
  const word = String(args || '').trim().toLowerCase()
  return ['login', 'status', 'upgrade'].includes(word) ? word : 'help'
}

// The gateway strips control characters and `<>` and wants 1 to 64 characters.
export function deviceName(host) {
  const clean = String(host || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim()
  return (clean ? 'Claude Code on ' + clean : 'Claude Code').slice(0, 64)
}

// A v4 UUID, kept in the mod's store so Palgu sees the same install on every sign-in.
export function newInstallId(random = Math.random) {
  const hex = (n) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('')
  const variant = ((Math.floor(random() * 16) & 0x3) | 0x8).toString(16)
  return hex(8) + '-' + hex(4) + '-4' + hex(3) + '-' + variant + hex(3) + '-' + hex(12)
}

export function deviceBody(name, installId) {
  return { client_id: CLIENT_ID, device: { name, client_version: VERSION, install_id: installId } }
}

export function tokenBody(deviceCode) {
  return { grant_type: DEVICE_GRANT, client_id: CLIENT_ID, device_code: deviceCode }
}

export function parseBody(res) {
  try {
    return JSON.parse((res && res.text) || '{}') || {}
  } catch {
    return {}
  }
}

const STOPS = {
  expired_token: 'the code expired: run /palgu login again',
  access_denied: 'sign-in was denied on the web',
  invalid_grant: 'the code is unknown or was already used: run /palgu login again',
}

function signedIn(body) {
  const account = body.account || {}, org = body.org || {}
  return { state: 'ok', key: body.access_token, email: account.email || '', org: org.name || '', plan: org.plan || '' }
}

// One answer from POST /auth/token: keep waiting (slow_down adds 5 s), stop with a reason, or the key.
export function tokenStep(res, interval) {
  const body = parseBody(res)
  if (res.ok) return typeof body.access_token === 'string' && body.access_token ? signedIn(body) : { state: 'stop', reason: 'Palgu answered without a key' }
  if (body.error === 'authorization_pending') return { state: 'wait', interval }
  if (body.error === 'slow_down') return { state: 'wait', interval: interval + 5 }
  return { state: 'stop', reason: STOPS[body.error] || 'Palgu answered ' + res.status }
}

// What `claude plugin configure --values-stdin` reads: the key travels on stdin, never argv.
export function configureValues(key) {
  return JSON.stringify({ gateway_url: PALGU_GATEWAY, gateway_key: key })
}

export function startText(start) {
  const minutes = Math.round((Number(start.expires_in) || 600) / 60)
  return 'Open ' + (start.verification_uri_complete || start.verification_uri) + ' and approve code ' + start.user_code +
    ' (new to Palgu? you can sign up there). The code expires in ' + minutes + ' minutes; this session picks up the key by itself once you approve.'
}

export function startFailedText(status) {
  return 'Palgu sign-in could not start (' + status + '). Paste a key from the Palgu dashboard instead: /plugin configure ' + PLUGIN_ID
}

export function signedInText(s) {
  return 'Signed in to Palgu as ' + s.email + (s.org ? ' (' + s.org + (s.plan ? ', plan ' + s.plan : '') + ')' : '') + '. Routed turns now run on Palgu.'
}

// `undefined`: no key at all. `'other'`: a key for another gateway. `null`: a key Palgu would not
// describe. Else GET /me's answer.
export function statusText(me) {
  if (me === 'other') return 'Palgu: your gateway is not Palgu, so its key was not sent there. Run /palgu login to switch to Palgu.'
  if (me === undefined) return 'Palgu: not signed in. Run /palgu login to sign up or sign in from here.'
  if (me === null) return 'Palgu: a gateway key is set, but Palgu could not say whose it is (not a Palgu key, revoked, or Palgu unreachable).'
  const account = me.account || {}, org = me.org || {}
  return 'Palgu: signed in as ' + account.email + ' (' + org.name + ', plan ' + org.plan + ') · upgrade: /palgu upgrade'
}

export function upgradeText() {
  return 'Palgu plans and billing: ' + PALGU_BILLING + ' · your key picks up a new plan by itself, nothing to change here.'
}
