// Model families: route values `<family>/<member>` and `<family>/auto`, the member a tier picks
// inside a family, and the runner that serves the result. Pure.
//   main:         the main session, untouched (bare `claude`, or a member that is the session model)
//   gateway:      the headless claude child on the gateway (plain ids and gateway families)
//   subscription: a headless claude child on your Claude login (`claude/<member>`)
//   codex:        a `codex exec` child (`codex`, `codex/<model>`, `codex/auto`)
import { LABELS } from './config.js'

export function splitRoute(value) {
  const v = value || ''
  const slash = v.indexOf('/')
  if (slash >= 0) return { family: v.slice(0, slash), member: v.slice(slash + 1) }
  return v === 'claude' || v === 'codex' ? { family: v, member: '' } : { family: '', member: v }
}

export function isAutoRoute(value) {
  return splitRoute(value).member === 'auto'
}

// The member a tier takes. A 10/10 critical turn takes `criticalPlus` when the family opts in.
export function autoMember(family, decision) {
  const map = family.auto || {}
  if (decision.label === 'critical' && decision.score === 10 && map.criticalPlus) return map.criticalPlus
  return map[decision.label] || map.coding || Object.keys(family.members || {})[0] || ''
}

function memberId(family, member) {
  return (family.members || {})[member] || member
}

// Session models may carry a suffix such as `[1m]`.
function sameModel(a, b) {
  return (a || '').replace(/\[.*\]$/, '') === (b || '').replace(/\[.*\]$/, '')
}

function target(runner, id, parts) {
  return { runner, model: id || parts.family, id, family: parts.family, member: parts.member, auto: Boolean(parts.auto) }
}

function familyTarget(parts, id, sessionModel) {
  if (parts.family === 'codex') return target('codex', id, parts)
  if (parts.family !== 'claude') return target('gateway', id, parts)
  return target(sameModel(id, sessionModel) ? 'main' : 'subscription', id, parts)
}

export function targetFor(value, decision, families, sessionModel) {
  const { family, member } = splitRoute(value)
  const main = target('main', sessionModel, { family: '', member: '' })
  if (!family) return member ? target('gateway', member, { family: '', member: '' }) : main
  if (family === 'claude' && !member) return main
  const fam = families[family]
  if (!fam) return main
  const auto = member === 'auto'
  const chosen = auto ? autoMember(fam, decision) : member
  return familyTarget({ family, member: chosen, auto }, memberId(fam, chosen), sessionModel)
}

// The route a decision takes. A Claude-family tier is mandatory Claude: no kind overrides it.
export function routeValue(decision, routes) {
  const byTier = LABELS.includes(decision.label) ? routes[decision.label] : undefined
  if (!byTier || splitRoute(byTier).family === 'claude') return byTier || 'claude'
  return (routes.kinds || {})[decision.kind] || byTier
}

function memberList(family) {
  const names = Object.keys(family.members || {})
  return names.length ? names.join(', ') : 'any model'
}

// '' when a pin is usable, else why not.
export function checkRoute(value, families) {
  const { family, member } = splitRoute(value)
  if (!family) return ''
  const fam = families[family]
  if (!fam) return 'unknown family ' + family + '; families: ' + Object.keys(families).join(', ')
  if (!member || member === 'auto' || family === 'codex') return ''
  const known = Object.keys(fam.members).includes(member) || Object.values(fam.members).includes(member)
  return known ? '' : family + ' has no member ' + member + '; members: ' + memberList(fam)
}

export function familiesText(families) {
  return 'families: ' + Object.entries(families).map(([name, f]) => name + ': ' + memberList(f)).join(' · ')
}
