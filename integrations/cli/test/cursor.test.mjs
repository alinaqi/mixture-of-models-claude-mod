// The Cursor adapter: `mom setup cursor` (pure merge and the command), and the plugin's files kept
// in step with the mod's version and with what setup writes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cursorHooks, cursorMcp, mergeHooks, mergeMcp } from '../lib/cursor-setup.js'
import { VERSION } from '../../../hooks/lib/version.js'

const MOM = join(dirname(fileURLToPath(import.meta.url)), '..', 'mom.js')
const root = new URL('../../../', import.meta.url)
const readRepo = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'))

test('cursorHooks: version 1, the four events running `mom hook cursor`, the stop capped at 3 follow-ups', () => {
  const h = cursorHooks()
  assert.equal(h.version, 1)
  assert.deepEqual(Object.keys(h.hooks).sort(), ['afterAgentResponse', 'beforeSubmitPrompt', 'sessionStart', 'stop'])
  for (const list of Object.values(h.hooks)) assert.equal(list[0].command, 'mom hook cursor')
  assert.equal(h.hooks.stop[0].loop_limit, 3)
})

test('mergeHooks adds ours without dropping other hooks, and does not add it twice', () => {
  const mine = { version: 1, hooks: { stop: [{ command: './audit.sh' }], afterFileEdit: [{ command: 'fmt' }] } }
  const once = mergeHooks(mine, cursorHooks())
  assert.deepEqual(once.hooks.stop.map((x) => x.command), ['./audit.sh', 'mom hook cursor'])
  assert.deepEqual(once.hooks.afterFileEdit, [{ command: 'fmt' }])
  assert.deepEqual(mergeHooks(once, cursorHooks()), once)
  assert.equal(mergeHooks(null, cursorHooks()).version, 1)
})

test('mergeMcp sets the mixture-of-models server and keeps the others', () => {
  const out = mergeMcp({ mcpServers: { other: { command: 'x' } } }, cursorMcp(true))
  assert.deepEqual(out.mcpServers.other, { command: 'x' })
  assert.deepEqual(out.mcpServers['mixture-of-models'], { command: 'mom', args: ['mcp', 'cursor'], env: { MOM_PROJECT_DIR: '${workspaceFolder}' } })
  assert.deepEqual(cursorMcp(false).mcpServers['mixture-of-models'], { command: 'mom', args: ['mcp', 'cursor'] })
})

function mom(args, cwd) {
  return spawnSync(process.execPath, [MOM, ...args], { cwd, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', MOM_HOME: cwd, HOME: cwd } })
}

test('mom setup cursor prints both files; --write merges into .cursor/, keeping a backup of what was there', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mom-cursor-'))
  const printed = mom(['setup', 'cursor'], dir)
  assert.equal(printed.status, 0)
  assert.match(printed.stdout, /\.cursor\/hooks\.json/)
  assert.match(printed.stdout, /"mom hook cursor"/)
  assert.equal(existsSync(join(dir, '.cursor')), false)
  mkdirSync(join(dir, '.cursor'))
  const before = JSON.stringify({ version: 1, hooks: { stop: [{ command: './audit.sh' }] } })
  writeFileSync(join(dir, '.cursor', 'hooks.json'), before)
  const r = mom(['setup', 'cursor', '--write'], dir)
  assert.equal(r.status, 0, r.stderr)
  const hooks = JSON.parse(readFileSync(join(dir, '.cursor', 'hooks.json'), 'utf8'))
  assert.deepEqual(hooks.hooks.stop.map((x) => x.command), ['./audit.sh', 'mom hook cursor'])
  assert.equal(readFileSync(join(dir, '.cursor', 'hooks.json.bak'), 'utf8'), before)
  assert.equal(JSON.parse(readFileSync(join(dir, '.cursor', 'mcp.json'), 'utf8')).mcpServers['mixture-of-models'].command, 'mom')
  assert.equal(existsSync(join(dir, '.cursor', 'mcp.json.bak')), false)
})

test('mom setup cursor --write refuses a hooks.json that is not JSON instead of overwriting it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mom-cursor-'))
  mkdirSync(join(dir, '.cursor'))
  writeFileSync(join(dir, '.cursor', 'hooks.json'), '{ broken')
  const r = mom(['setup', 'cursor', '--write'], dir)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /hooks\.json/)
  assert.equal(readFileSync(join(dir, '.cursor', 'hooks.json'), 'utf8'), '{ broken')
})

test('the Cursor plugin stays on the mod\'s version, ships what setup writes, and the marketplace points at it', () => {
  const plugin = readRepo('integrations/cursor/.cursor-plugin/plugin.json')
  const market = readRepo('.cursor-plugin/marketplace.json')
  assert.equal(plugin.version, VERSION)
  assert.equal(plugin.name, 'mixture-of-models')
  assert.deepEqual(readRepo('integrations/cursor/hooks/hooks.json'), cursorHooks())
  assert.deepEqual(readRepo('integrations/cursor/mcp.json'), cursorMcp(false))
  assert.equal(market.plugins[0].name, plugin.name)
  assert.equal(market.plugins[0].source, 'integrations/cursor')
  const rule = readFileSync(new URL('integrations/cursor/rules/mixture-of-models.mdc', root), 'utf8')
  assert.match(rule, /^---\ndescription: .+\nalwaysApply: true\n---\n/)
  assert.match(rule, /palgu_memory_search/)
  assert.match(rule, /palgu_delegate/)
})
