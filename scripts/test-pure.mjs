#!/usr/bin/env node
// Runs every tests/*.test.ts that only imports hooks/lib (pure functions) under
// Node, with scripts/shim standing in for 'claude-code/testing'. Files that
// drive the hooks through the real kit (tests/mod.test.ts) are skipped here.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const work = mkdtempSync(join(tmpdir(), 'mom-tests-'))
const modules = join(work, 'node_modules', 'claude-code')
mkdirSync(modules, { recursive: true })
writeFileSync(join(modules, 'package.json'), JSON.stringify({ name: 'claude-code', type: 'module', exports: { './testing': './testing.mjs' } }))
cpSync(join(root, 'scripts', 'shim', 'claude-code-testing.mjs'), join(modules, 'testing.mjs'))
cpSync(join(root, 'hooks'), join(work, 'hooks'), { recursive: true })
writeFileSync(join(work, 'package.json'), '{ "type": "module" }')
mkdirSync(join(work, 'tests'))

const isPure = (src) => !/\$\.(tool|command|prompt|turn|session)\./.test(src)
let failed = 0
for (const file of readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.ts')).sort()) {
  const src = readFileSync(join(root, 'tests', file), 'utf8')
  if (!isPure(src)) { console.log(`(skip) ${file}: needs \`claude plugin test\`\n`); continue }
  const target = join(work, 'tests', file.replace(/\.ts$/, '.mjs'))
  writeFileSync(target, src + `\nimport { run } from 'claude-code/testing'\nprocess.exitCode = (await run('tests/${file}')) ? 1 : process.exitCode\n`)
  const r = spawnSync(process.execPath, [target], { cwd: work, stdio: 'inherit' })
  if (r.status !== 0) failed += 1
}
rmSync(work, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
