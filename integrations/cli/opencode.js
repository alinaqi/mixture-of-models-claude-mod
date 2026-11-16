// `mom setup opencode [--write]`: Palgu as OpenCode's provider and this package's plugin, merged
// into opencode.json (OPENCODE_CONFIG, else $XDG_CONFIG_HOME/opencode/opencode.json) with a backup.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { liveModels } from '../../hooks/lib/catalogue.js'
import { PALGU_MODELS } from '../../hooks/lib/providers.js'
import { VERSION } from '../../hooks/lib/version.js'
import { mergeOpencode, opencodeConfig } from './lib/setup.js'
import { call, loadKey } from './io.js'

export const PLUGIN_PATH = fileURLToPath(new URL('../opencode/plugin.js', import.meta.url))

export function opencodePath() {
  if (process.env.OPENCODE_CONFIG) return process.env.OPENCODE_CONFIG
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode', 'opencode.json')
}

// What Palgu serves now, with a key; else the built-in list.
async function models() {
  const key = loadKey()
  if (!key) return PALGU_MODELS
  const res = await call('/v1/models/health', { headers: { 'x-api-key': key } }, 8000).catch(() => null)
  const live = liveModels(res)
  return live ? live.served : PALGU_MODELS
}

function readConfig(path) {
  if (!existsSync(path)) return {}
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'))
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

export async function setupOpencode(write) {
  const ours = opencodeConfig(VERSION, await models(), PLUGIN_PATH)
  const text = JSON.stringify(ours, null, 2)
  if (!write) return { code: 0, out: text + '\n' }
  const path = opencodePath()
  const theirs = readConfig(path)
  if (!theirs) return { code: 1, out: text + '\n', err: path + ' is not plain JSON (comments?): merge the block above into it by hand.\n' }
  const had = existsSync(path)
  mkdirSync(dirname(path), { recursive: true })
  if (had) copyFileSync(path, path + '.bak')
  const merged = mergeOpencode(theirs, ours)
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n')
  const note = merged.model === ours.model ? 'the default model is palgu/auto' : 'your default model is ' + merged.model + ': pick palgu/auto (/models) to let Palgu route'
  return { code: 0, out: 'Wrote ' + path + (had ? ' (backup: ' + path + '.bak)' : '') + '. Start OpenCode; ' + note + '.\n' }
}
