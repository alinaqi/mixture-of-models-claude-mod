import { expect, test } from 'claude-code/testing'
import { continueArgs, handoffCommand, handoffText, isSessionId, launchScript, parseContinue, shellQuote } from '../hooks/lib/handoff.js'

const ID = '123e4567-e89b-42d3-a456-426614174000'

test('a Claude Code handoff names the exact session and quotes the folder for a shell', async () => {
  expect(continueArgs('claude', ID)).toEqual(['--continue-claude=' + ID])
  expect(continueArgs('codex', 'thread-1_2.3')).toEqual(['--continue-codex=thread-1_2.3'])
  expect(handoffCommand('claude', ID, '/work')).toBe('cd /work && palgu --continue-claude=' + ID)
  expect(handoffCommand('claude', ID, "/Users/me/it's here")).toBe("cd '/Users/me/it'\\''s here' && palgu --continue-claude=" + ID)
})

test('only a plain, bounded session id may be handed to Palgu; absent ids never fall back to newest', async () => {
  expect(isSessionId(ID)).toBe(true)
  expect(isSessionId('thread-1_2.3')).toBe(true)
  for (const id of ['', 'latest', '../other', 'id;rm -rf ~', 'id --continue-claude', 'id\nkey', 'x'.repeat(129)]) expect(isSessionId(id)).toBe(false)
  expect(continueArgs('claude', '')).toEqual({ error: 'Claude Code did not provide this session\'s id; cannot select the exact session.' })
  expect(continueArgs('codex', 'latest')).toEqual({ error: 'Invalid Codex session id; cannot select the exact session.' })
  expect(continueArgs('cursor', ID)).toEqual({ error: 'No Palgu handoff for cursor yet.' })
})

test('/palgu continue accepts only its own subcommand and optional --open', async () => {
  expect(parseContinue('continue')).toEqual({ open: false })
  expect(parseContinue(' continue   --open ')).toEqual({ open: true })
  expect(parseContinue('login')).toBe(null)
  expect(parseContinue('continue now')).toEqual({ error: 'Usage: /palgu continue [--open]' })
  expect(handoffText(handoffCommand('claude', ID, '/work'), false)).toContain('Command copied to your clipboard')
  expect(handoffText(handoffCommand('claude', ID, '/work'), true)).toContain('Opening a new Terminal tab')
})

test('the macOS Terminal launcher is a fixed script with the handoff only as AppleScript string data', async () => {
  const command = handoffCommand('claude', ID, '/work')
  expect(shellQuote(command)).toBe("'cd /work && palgu --continue-claude=" + ID + "'")
  const script = launchScript(command)
  expect(script).toContain('tell application "Terminal" to do script "cd /work && palgu --continue-claude=' + ID + '"')
  expect(script).toContain('activate')
  expect(launchScript('echo "bad\\path"')).toContain('echo \\"bad\\\\path\\"')
})
