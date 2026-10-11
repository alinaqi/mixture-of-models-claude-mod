import { expect, test } from 'claude-code/testing'
import { vetAnswer } from '../hooks/lib/vet.js'

const fine = (answer, turns) => ({ ok: true, answer, sessionId: 's', denials: [], turns })

test('a plain answer passes', async () => {
  expect(vetAnswer(fine('TODOs are in src/a.ts and src/b.ts.', 3), new Set())).toEqual({ ok: true, reason: '' })
  expect(vetAnswer(fine('`--bare` skips hooks, plugins and auto-discovery.', 1), new Set())).toEqual({ ok: true, reason: '' })
})

test('HANDBACK goes back to the main model', async () => {
  expect(vetAnswer(fine('HANDBACK\nneeds the PR state from the main session', 1), new Set())).toEqual({ ok: false, reason: 'handback' })
})

test('an answer that says it is blocked or asks the user to approve or run commands is rejected', async () => {
  for (const text of [
    'I was blocked by the permission system. You must approve it in the UI.',
    'I need approval to run git pull --ff-only',
    'Please run `gh pr create` yourself, then `pytest -q`.',
    'You will need to run pytest to confirm.',
    'The environment is sandboxed, so I cannot push.',
  ]) expect(vetAnswer(fine(text, 2), new Set()).reason).toBe('asks the user to act')
})

test('a claimed action or session fact with no tool call is rejected as unverified', async () => {
  for (const text of [
    'I added the retry wrapper to client.ts and updated the tests.',
    'Done. PR #812 is open and green.',
    'Your branch is 14 commits behind origin/main.',
    'No framework-build runs exist yet.',
  ]) expect(vetAnswer(fine(text, 1), new Set()).reason).toBe('unverified claim')
})

test('the same claim backed by tool calls passes', async () => {
  expect(vetAnswer(fine('I added the retry wrapper to client.ts and updated the tests.', 6), new Set()).ok).toBe(true)
})

test('an answer that is mostly narration of intent is rejected', async () => {
  const text = "I'll start by reading the config. Then I will update the router. Let me check the tests next."
  expect(vetAnswer(fine(text, 4), new Set()).reason).toBe('narration')
})

test('an answer identical to one already given is rejected as a repeat', async () => {
  const text = 'Verdict: ship it. Tests green.'
  expect(vetAnswer(fine(text, 3), new Set([text])).reason).toBe('repeat of an earlier answer')
})
