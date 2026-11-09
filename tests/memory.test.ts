import { expect, test } from 'claude-code/testing'
import { INDEX_EVERY_MS, indexDue, memoryLine, memoryStatus } from '../hooks/lib/memory.js'
import { parsePalguArg } from '../hooks/lib/palgu.js'

const STATUS = '{"branch": "main", "docs": 192, "indexed": true, "layer": "canonical", "project": "mixture-of-models-mod", "symbols": 284, "updated": "2026-11-05T10:27:11.519332+00:00"}'

test('/palgu memory, memory on and memory off are their own words', async () => {
  expect(parsePalguArg('memory')).toBe('memory')
  expect(parsePalguArg(' Memory On ')).toBe('memory on')
  expect(parsePalguArg('memory off')).toBe('memory off')
  expect(parsePalguArg('memory maybe')).toBe('help')
})

test('memoryStatus reads palgu memory status --json, and null from a failed run or garbage', async () => {
  expect(memoryStatus({ exitCode: 0, stdout: STATUS })).toEqual({ indexed: true, project: 'mixture-of-models-mod', symbols: 284, updated: '2026-11-05T10:27:11.519332+00:00' })
  expect(memoryStatus({ exitCode: 1, stdout: '{"indexed": false, "project": "x"}' })).toEqual({ indexed: false, project: 'x', symbols: 0, updated: '' })
  expect(memoryStatus({ exitCode: 2, stdout: '' })).toBe(null)
  expect(memoryStatus({ exitCode: 0, stdout: 'not json' })).toBe(null)
})

test('memoryLine says whether the project is indexed and how fresh, and how to turn indexing on', async () => {
  const now = Date.parse('2026-11-05T12:27:11Z')
  expect(memoryLine({ on: true, status: memoryStatus({ exitCode: 0, stdout: STATUS }), now })).toBe('Palgu memory: on · mixture-of-models-mod indexed, 284 symbols, updated 2h ago')
  expect(memoryLine({ on: false, status: null, now })).toMatch(/off · \/palgu memory on/)
  expect(memoryLine({ on: true, status: { indexed: false, project: 'x', symbols: 0, updated: '' }, now })).toBe('Palgu memory: on · x not indexed yet')
  expect(memoryLine({ on: true, status: null, now, missing: true })).toMatch(/palgu CLI is not installed/)
  expect(memoryLine({ on: true, status: null, now })).toMatch(/could not read/)
})

test('indexDue: only when on, signed in and palgu installed, at most once per project in INDEX_EVERY_MS', async () => {
  const ok = { on: true, signedIn: true, installed: true }
  expect(INDEX_EVERY_MS).toBe(10 * 60 * 1000)
  expect(indexDue(ok, undefined, 1000)).toBe(true)
  expect(indexDue(ok, 1000, 1000 + INDEX_EVERY_MS - 1)).toBe(false)
  expect(indexDue(ok, 1000, 1000 + INDEX_EVERY_MS)).toBe(true)
  expect(indexDue({ ...ok, on: false }, undefined, 1)).toBe(false)
  expect(indexDue({ ...ok, signedIn: false }, undefined, 1)).toBe(false)
  expect(indexDue({ ...ok, installed: false }, undefined, 1)).toBe(false)
})
