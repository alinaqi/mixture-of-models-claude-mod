// The help pane (band key 0, /route help): what the mod does, where it stands now, what each
// band button and command does, and how to connect a model provider. Pure: lines out as data.

const PLUGIN = 'mixture-of-models@mixture-of-models-claude-mod'
const NAMES = { palgu: 'Palgu', openrouter: 'OpenRouter', litellm: 'LiteLLM', 'anthropic-compatible': 'your Anthropic-compatible gateway' }

const head = (text) => ({ text, bold: true })
const line = (text) => ({ text })
const dim = (text) => ({ text, dim: true })

function modeLine(v) {
  const m = v.pin.mode
  if (m === 'off') return { text: 'Routing is off: everything stays on ' + v.sessionModel + '. Your choice is remembered across sessions; press 1 or /route auto to route again.', color: 'yellow' }
  if (m === 'model') return line('Pinned: every turn that may leave Claude goes to ' + v.pin.model + '. Press 1 or /route auto to score each prompt again.')
  if (m === 'label') return line('Pinned to the ' + v.pin.label + ' tier. Press 1 or /route auto to score each prompt again.')
  return line('Auto: each prompt is scored and routed. Your choice is remembered across sessions.')
}

function gatewayLines(v) {
  if (!v.ready) return [{ text: 'No gateway yet, so nothing is routed. Connect one below.', color: 'yellow' }]
  return [line('Gateway: ' + (NAMES[v.provider] || NAMES['anthropic-compatible']) + ' (/palgu status shows the account)')]
}

const BUTTON_HELP = {
  help: 'this help',
  auto: 'score every prompt and pick the cheapest capable model',
  claude: 'keep every turn on Claude',
  off: 'never route; the mod only watches',
}

function buttonLines(v) {
  return ['help', ...v.buttons].map((b, i) => line('  ' + i + '  ' + b.padEnd(10) + (BUTTON_HELP[b] || 'send routed turns to ' + b)))
}

const COMMANDS = [
  ['/route status', 'mode, gateway, today\'s counts, savings, model families'],
  ['/route stats', 'charts: models, task kinds, scores, recent turns'],
  ['/route glm · /route kimi', 'pin a model (any prefix of a model id)'],
  ['/route claude/sonnet', 'pin a Claude model on your own login; kimi/auto picks a Kimi by score'],
  ['/route simple|coding|critical', 'pin a tier'],
  ['/route reset', 'forget which kinds of task a cheap model kept failing'],
  ['/palgu login', 'sign up or sign in to Palgu and connect this computer'],
  ['/palgu status · /palgu upgrade', 'who is signed in and the plan · plans and billing'],
]

// v: { pin, ready, provider, sessionModel, saved, buttons }; buttons as the band shows them, without help.
export function helpLines(v) {
  return [
    head('Mixture of Models'),
    line('Each prompt is scored 1-10 for how much it could break. Simple and coding work runs on a cheaper model in a separate Claude Code; critical work stays on ' + v.sessionModel + '.'),
    line(''),
    head('Right now'),
    modeLine(v),
    ...gatewayLines(v),
    { text: v.saved, color: 'green' },
    line(''),
    head('Band buttons (type the number with an empty prompt)'),
    ...buttonLines(v),
    line(''),
    head('Commands'),
    ...COMMANDS.map(([c, what]) => line('  ' + c.padEnd(32) + what)),
    line(''),
    head('Connect a model provider'),
    line('  Palgu        /palgu login (no keys to copy)'),
    line('  OpenRouter   /plugin configure ' + PLUGIN + ' with gateway_url https://openrouter.ai/api and your key'),
    line('  LiteLLM      the same, with your proxy URL and gateway_provider litellm'),
    line(''),
    dim('Esc closes this pane.'),
  ]
}

export function helpTree(el, v) {
  const texts = helpLines(v).map((l, i) => el.Text({ key: 'help-' + i, bold: l.bold, dimColor: l.dim, color: l.color, children: [l.text || ' '] }))
  return el.Box({ flexDirection: 'column', children: texts })
}
