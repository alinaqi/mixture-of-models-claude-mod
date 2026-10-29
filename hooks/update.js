// /route update: ask GitHub for the published version and, when it is newer, update through
// `claude plugin marketplace update` and `claude plugin update`. The new code loads on restart.
import { LATEST_URL, isNewer, latestVersion, updateCommands, updateText } from './lib/update.js'
import { VERSION } from './lib/version.js'

function lastLine(r) {
  return String(r.stderr || r.stdout || '').trim().split('\n').pop() || 'exit ' + r.exitCode
}

export async function routeUpdate($) {
  const latest = latestVersion(await $.http.fetch(LATEST_URL).catch(() => null))
  if (!latest || !isNewer(latest, VERSION)) return updateText({ current: VERSION, latest })
  for (const argv of updateCommands()) {
    const r = await $.process.run(argv, { timeoutMs: 120000 }).catch((err) => ({ exitCode: 1, stderr: String((err && err.message) || err) }))
    if (r.exitCode !== 0) return updateText({ current: VERSION, latest, updated: false, error: lastLine(r) })
  }
  return updateText({ current: VERSION, latest, updated: true })
}
