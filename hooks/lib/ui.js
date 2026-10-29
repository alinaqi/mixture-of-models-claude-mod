// What the mod draws: the band above the prompt and the provenance tag on a
// reply. Pure: elements come in as a parameter, trees go out as data.

import { GATEWAY_MODELS } from './config.js'
import { routeModels, summaryLine, tierText } from './routing.js'

const NAME = 'mixture-of-models'

// `kimi-k3.1-pro` and `kimi/auto` are both kimi; every Claude member is the claude button.
function provider(model) {
  return model.split('/')[0].split('-')[0]
}

// One button per provider in the routes, then one per family in the gateway's catalogue that no
// route names, framed by auto, claude and off: every model you can pin has a button.
export function bandButtons(routes, catalogue) {
  const models = [...routeModels(routes), ...(catalogue || GATEWAY_MODELS)]
  const providers = [...new Set(models.map(provider))].filter((p) => p !== 'claude')
  const args = ['auto', ...providers, 'claude', 'off']
  return args.map((arg, i) => ({ key: 'pin-' + arg, label: arg, hotkey: String(i + 1), arg }))
}

function activeArg(pin) {
  if (pin.mode === 'model') return provider(pin.model)
  return pin.mode === 'label' ? '' : pin.mode
}

function lastDecision(d) {
  if (!d.model) return 'no prompt yet'
  return 'last: ' + d.model + ' (' + tierText(d) + ')'
}

export function bandText(v) {
  if (v.disabled) return NAME + ' · inactive inside a child session'
  if (!v.ready) return NAME + ' · observe-only: no gateway key for the child'
  if (v.pin.mode === 'off') return NAME + ' · off · everything on ' + v.sessionModel
  const routed = v.decision.model && v.decision.model !== v.sessionModel
  if (v.isWorking) return NAME + ' · running ' + (routed ? v.decision.model + ' in a child…' : v.sessionModel + ' in the main session…')
  if (v.pin.mode === 'model') return NAME + ' · pinned ' + (v.decision.family ? v.pin.model + ' → ' : '') + v.decision.model
  if (v.pin.mode === 'label') return NAME + ' · pinned ' + v.pin.label + ' → ' + v.decision.model
  return NAME + ' · auto · ' + lastDecision(v.decision)
}

export function bandTree(el, v, onPin) {
  const active = activeArg(v.pin)
  const buttons = bandButtons(v.routes, v.catalogue).map((b) =>
    el.Button({ key: b.key, label: b.label, hotkey: b.hotkey, plain: true, dimColor: b.arg !== active, onPress: () => onPin(b.arg) }),
  )
  const row = el.Box({ flexDirection: 'row', columnGap: 2, children: [el.Text({ dimColor: true, children: [bandText(v) + '  '] }), ...buttons] })
  return el.Box({ flexDirection: 'column', children: [row, v.theirs].filter(Boolean) })
}

const WHERE = { subscription: ' · child on your Claude subscription', codex: ' · Codex child' }

export function tagText(model, sessionModel, runner) {
  if (model === sessionModel) return '⇢ ' + model + ' · main session'
  return '⇢ ' + model + (WHERE[runner] || ' · child on gateway')
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
