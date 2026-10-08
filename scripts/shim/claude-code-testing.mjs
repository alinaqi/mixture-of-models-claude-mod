// A small stand-in for 'claude-code/testing' so the pure-function tests in
// tests/ run under plain Node. It covers test() and the expect() matchers those
// files use. tests/mod.test.ts needs the real kit: `claude plugin test`.
import assert from 'node:assert/strict'

const tests = []
export function test(name, fn) { tests.push({ name, fn }) }

function matchers(actual, negate) {
  const check = (f) => (...args) => {
    let ok = true
    try { f(...args) } catch { ok = false }
    if (ok === negate) throw new Error(`expect(${JSON.stringify(actual)})${negate ? '.not' : ''} failed with ${JSON.stringify(args)}`)
  }
  return {
    toBe: check((v) => assert.equal(actual, v)),
    toEqual: check((v) => assert.deepEqual(actual, v)),
    toMatch: check((v) => assert.match(String(actual), v)),
    toMatchObject: check((v) => { for (const k of Object.keys(v)) assert.deepEqual(actual[k], v[k]) }),
    toContain: check((v) => assert.ok(actual.includes(v))),
    toBeDefined: check(() => assert.notEqual(actual, undefined)),
    toBeUndefined: check(() => assert.equal(actual, undefined)),
    toThrow: check(() => assert.throws(actual)),
  }
}
export function expect(actual) { return { ...matchers(actual, false), not: matchers(actual, true) } }

export async function run(file) {
  let failed = 0
  for (const t of tests) {
    try { await t.fn({}, () => {}); console.log(`(pass) ${t.name}`) }
    catch (e) { failed += 1; console.log(`(FAIL) ${t.name}\n       ${e.message}`) }
  }
  console.log(`${file}: ${tests.length - failed} pass, ${failed} fail\n`)
  return failed
}
