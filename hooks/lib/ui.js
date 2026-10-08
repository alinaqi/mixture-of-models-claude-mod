// What the mod draws: the band above the prompt and the provenance tag on a
// reply. Pure: elements come in as a parameter, trees go out as data.

import { summaryLine } from './routing.js'

const NAME = 'mixture-of-models'

function provider(model) {
  return model.split('-')[0]
}

// One button per provider in the routes, framed by auto, claude and off.
export function bandButtons(routes) {
  const providers = [...new Set(Object.values(routes).filter((m) => m !== 'claude').map(provider))]
  const args = ['auto', ...providers, 'claude', 'off']
  return args.map((arg, i) => ({ key: 'pin-' + arg, label: arg, hotkey: String(i + 1), arg }))
}

function activeArg(pin) {
  if (pin.mode === 'model') return pin.model === 'claude' ? 'claude' : provider(pin.model)
  return pin.mode === 'label' ? '' : pin.mode
}

function lastDecision(d) {
  if (!d.model) return 'no prompt yet'
  return 'last: ' + d.model + ' (' + d.label + ' via ' + d.source + ')'
}

export function bandText(v) {
  if (v.disabled) return NAME + ' · inactive inside a child session'
  if (!v.ready) return NAME + ' · observe-only: no gateway key for the child'
  if (v.pin.mode === 'off') return NAME + ' · off · everything on ' + v.sessionModel
  const routed = v.decision.model && v.decision.model !== v.sessionModel
  if (v.isWorking) return NAME + ' · running ' + (routed ? v.decision.model + ' in a child…' : v.sessionModel + ' in the main session…')
  if (v.pin.mode === 'model') return NAME + ' · pinned ' + v.decision.model
  if (v.pin.mode === 'label') return NAME + ' · pinned ' + v.pin.label + ' → ' + v.decision.model
  return NAME + ' · auto · ' + lastDecision(v.decision)
}

export function bandTree(el, v, onPin) {
  const active = activeArg(v.pin)
  const buttons = bandButtons(v.routes).map((b) =>
    el.Button({ key: b.key, label: b.label, hotkey: b.hotkey, plain: true, dimColor: b.arg !== active, onPress: () => onPin(b.arg) }),
  )
  const row = el.Box({ flexDirection: 'row', columnGap: 2, children: [el.Text({ dimColor: true, children: [bandText(v) + '  '] }), ...buttons] })
  return el.Box({ flexDirection: 'column', children: [row, v.theirs].filter(Boolean) })
}

export function tagText(model, sessionModel) {
  return '⇢ ' + model + (model === sessionModel ? ' · main session' : ' · child on gateway')
}

export function tagTree(el, text, theirs) {
  return el.Box({ flexDirection: 'column', children: [el.Text({ dimColor: true, children: [text] }), theirs] })
}

function pinWord(pin) {
  if (pin.mode === 'auto') return 'auto'
  return pin.mode + (pin.model ? ' ' + pin.model : pin.label ? ' ' + pin.label : '')
}

// The /route answer.
export function reportText(v) {
  const live = v.disabled ? 'disabled (child session)' : v.ready ? 'live' : 'observe-only (no gateway key for the child)'
  return NAME + ' ' + live + ' · mode ' + pinWord(v.pin) + ' · current ' + summaryLine(v.decision, null)
}
