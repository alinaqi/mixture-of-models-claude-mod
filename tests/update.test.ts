import { expect, test } from 'claude-code/testing'
import { LATEST_URL, isNewer, latestVersion, updateCommands, updateText } from '../hooks/lib/update.js'

test('the latest version is read from the plugin manifest on main', async () => {
  expect(LATEST_URL).toBe('https://raw.githubusercontent.com/alinaqi/mixture-of-models-claude-mod/main/.claude-plugin/plugin.json')
  expect(latestVersion({ ok: true, text: '{"name":"mixture-of-models","version":"0.19.2"}' })).toBe('0.19.2')
  expect(latestVersion({ ok: false, text: '' })).toBe('')
  expect(latestVersion({ ok: true, text: '{"version":"latest"}' })).toBe('')
  expect(latestVersion({ ok: true, text: 'not json' })).toBe('')
})

test('isNewer compares versions number by number', async () => {
  expect(isNewer('0.19.0', '0.18.0')).toBe(true)
  expect(isNewer('0.10.0', '0.9.9')).toBe(true)
  expect(isNewer('1.0.0', '0.99.0')).toBe(true)
  expect(isNewer('0.18.0', '0.18.0')).toBe(false)
  expect(isNewer('0.17.1', '0.18.0')).toBe(false)
})

test('updateCommands refresh the marketplace, then update the plugin', async () => {
  expect(updateCommands()).toEqual([
    ['claude', 'plugin', 'marketplace', 'update', 'mixture-of-models-claude-mod'],
    ['claude', 'plugin', 'update', 'mixture-of-models@mixture-of-models-claude-mod'],
  ])
})

test('updateText says what happened and what to do next', async () => {
  expect(updateText({ current: '0.18.0', latest: '0.18.0' })).toBe('mixture-of-models 0.18.0 is up to date.')
  expect(updateText({ current: '0.18.0', latest: '' })).toMatch(/could not check.*claude plugin update mixture-of-models@mixture-of-models-claude-mod/)
  expect(updateText({ current: '0.18.0', latest: '0.19.0', updated: true })).toBe('Updated mixture-of-models 0.18.0 → 0.19.0. Restart Claude Code to load it; see the CHANGELOG for what changed.')
  const failed = updateText({ current: '0.18.0', latest: '0.19.0', updated: false, error: 'boom' })
  expect(failed).toContain('0.19.0 is out but the update failed (boom)')
  expect(failed).toContain('claude plugin marketplace update mixture-of-models-claude-mod && claude plugin update mixture-of-models@mixture-of-models-claude-mod')
})
