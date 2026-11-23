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

// The three answers routed children gave in place of doing the work (2026-11-23, codestral-2508 and others).
const GAVE_UP = [
  "I'm sorry, but I don't have permission to execute the commands you've requested. If you have any other questions or need assistance with something else, feel free to ask!",
  "I'm sorry, but I encountered an error while trying to complete the task. The error message indicates that the Git working directory is not clean. Could you please review the status of your Git repository and ensure all changes are committed or stashed appropriately? Once that's done, we can continue with the task.",
  'Unfortunately I was unable to run the tests in this environment.',
  'I apologize, but I cannot complete this request.',
]

test('an answer that apologizes and gives up, or hands the work back to the user, is rejected as gave up', async () => {
  for (const text of GAVE_UP) expect(vetAnswer(fine(text, 3), new Set()).reason).toBe('gave up')
})

test('an answer that talks about the user to someone else, instead of answering them, is rejected', async () => {
  const text = 'The command palgu --continue-claude has been executed successfully. Palgu is now ready to proceed with the task. The user can type "continue" or provide the next instruction.'
  expect(vetAnswer(fine(text, 3), new Set()).reason).toBe('talks about the user')
})

test('apologies, errors and the word user in a real answer are not giving up', async () => {
  for (const text of [
    'Sorry for the confusion: the timeout is set in config.js, line 40, to 600000 ms.',
    'The test failed with "connection refused" because the server binds to 127.0.0.1; I changed it to 0.0.0.0 and it passes.',
    'The user table has an email column with a unique index.',
    'Each user can have many sessions, so the join needs a GROUP BY.',
  ]) expect(vetAnswer(fine(text, 4), new Set()).ok).toBe(true)
})
