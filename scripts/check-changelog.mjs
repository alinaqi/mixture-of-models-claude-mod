#!/usr/bin/env node
// Fails when CHANGELOG.md has no section for the version in plugin.json, so a
// release can't ship without its entry, or when package.json or hooks/lib/version.js
// (what the child sends the gateway in x-srooter-client) disagree with it.
import { readFileSync } from 'node:fs'
const version = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8')).version
const changelog = readFileSync('CHANGELOG.md', 'utf8')
const others = {
  'package.json': JSON.parse(readFileSync('package.json', 'utf8')).version,
  'hooks/lib/version.js': (readFileSync('hooks/lib/version.js', 'utf8').match(/VERSION = '([^']+)'/) || [])[1],
}
for (const [file, v] of Object.entries(others)) {
  if (v !== version) {
    console.error(`${file} has version ${v}, plugin.json has ${version}`)
    process.exit(1)
  }
}
if (!changelog.includes('## [' + version + ']')) {
  console.error(`CHANGELOG.md has no "## [${version}]" section for the version in plugin.json`)
  process.exit(1)
}
console.log(`CHANGELOG.md has an entry for ${version}`)
