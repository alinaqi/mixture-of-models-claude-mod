// The /palgu command: Palgu's device-code sign-in, polled in the background on the mod's clock,
// the minted key saved through `claude plugin configure --values-stdin` and used at once.
import { PALGU_ORIGIN, PLUGIN_ID, configureValues, deviceBody, deviceName, newInstallId, parseBody, parsePalguArg, signedInText, startFailedText, startText, statusText, tokenBody, tokenStep, upgradeText, HELP } from './lib/palgu.js'

let polling = false
const FAILED = { ok: false, status: 0, text: '' }

function post($, path, body) {
  return $.http.fetch(PALGU_ORIGIN + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => FAILED)
}

async function installId($) {
  const saved = await $.store.get('palgu-install-id')
  if (saved) return saved
  const id = newInstallId()
  await $.store.set('palgu-install-id', id)
  return id
}

// The key is live for this session at once; saving it is for the next one.
async function save($, signed, ctx) {
  ctx.useKey(signed.key)
  const argv = ['claude', 'plugin', 'configure', PLUGIN_ID, '--values-stdin']
  const r = await $.process.run(argv, { stdin: configureValues(signed.key) }).catch(() => ({ exitCode: 1 }))
  const note = r.exitCode === 0 ? '' : ' The key could not be saved for later sessions: run /palgu login there again.'
  $.ui.toast(signedInText(signed) + note, { timeoutMs: 10000 })
}

function poll($, start, ctx, interval) {
  $.clock.after(interval * 1000, async () => {
    const step = tokenStep(await post($, '/auth/token', tokenBody(start.device_code)), interval)
    if (step.state === 'wait') return poll($, start, ctx, step.interval)
    polling = false
    if (step.state === 'ok') return save($, step, ctx)
    $.ui.toast('Palgu sign-in stopped: ' + step.reason, { timeoutMs: 10000 })
  })
}

async function login($, ctx) {
  if (polling) return 'A Palgu sign-in is already waiting for your approval.'
  const name = deviceName((await $.env.get('HOSTNAME')) || '')
  const res = await post($, '/auth/device/code', deviceBody(name, await installId($)))
  const start = res.ok ? parseBody(res) : {}
  if (!start.device_code) return startFailedText(res.status || 'unreachable')
  polling = true
  poll($, start, ctx, Number(start.interval) || 5)
  return startText(start)
}

async function status($, ctx) {
  const key = ctx.key()
  if (!key) return statusText(undefined)
  const res = await $.http.fetch(PALGU_ORIGIN + '/me', { headers: { authorization: 'Bearer ' + key } }).catch(() => FAILED)
  return statusText(res.ok ? parseBody(res) : null)
}

// ctx: `key()` reads the child's current gateway key, `useKey(key)` switches the child to Palgu.
export async function palguCommand($, args, ctx) {
  const word = parsePalguArg(args)
  if (word === 'login') return login($, ctx)
  if (word === 'status') return status($, ctx)
  return word === 'upgrade' ? upgradeText() : HELP
}
