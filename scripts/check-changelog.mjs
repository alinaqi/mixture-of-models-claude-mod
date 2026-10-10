#!/usr/bin/env node
// Fails when CHANGELOG.md has no section for the version in plugin.json, so a
// release can't ship without its entry.
import { readFileSync } from 'node:fs'
const version = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8')).version
const changelog = readFileSync('CHANGELOG.md', 'utf8')
if (!changelog.includes('## [' + version + ']')) {
  console.error(`CHANGELOG.md has no "## [${version}]" section for the version in plugin.json`)
  process.exit(1)
}
console.log(`CHANGELOG.md has an entry for ${version}`)
