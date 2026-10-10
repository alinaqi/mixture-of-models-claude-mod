// The "Mixture of models" pane: four tabs that chart the decision log. Pure:
// elements come in, a tree goes out.
import { bar } from './stats.js'

const TABS = ['models', 'kinds', 'scores', 'recent']
const COLORS = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'red']

function pct(n, total) {
  return total ? Math.round((n / total) * 100) + '%' : '0%'
}

function row(el, label, text, color) {
  return el.Box({ flexDirection: 'row', columnGap: 1, children: [el.Text({ color, children: [label.padEnd(18)] }), el.Text({ children: [text] })] })
}

function modelsTab(el, v) {
  const { summary: s } = v
  const width = Math.max(10, Math.min(30, v.columns - 36))
  const max = s.byModel.length ? s.byModel[0].n : 0
  return [
    el.Text({ bold: true, children: [s.offClaude + ' of ' + s.total + ' turns off Claude (' + pct(s.offClaude, s.total) + ')'] }),
    el.Text({ dimColor: true, children: ['child runs ' + s.child.runs + ' · failed ' + s.child.failed + ' · avg ' + Math.round(s.child.avgMs / 1000) + 's'] }),
    ...s.byModel.map((m, i) => row(el, m.model, bar(m.n, max, width) + ' ' + m.n + ' · ' + pct(m.n, s.total), COLORS[i % COLORS.length])),
  ]
}

function kindsTab(el, v) {
  return v.summary.byKind.map((k, i) =>
    row(el, k.kind, String(k.n).padStart(3) + '  ' + Object.entries(k.models).map(([m, n]) => m + ' ' + n).join(' · '), COLORS[i % COLORS.length]),
  )
}

function scoresTab(el, v) {
  const max = Math.max(...v.summary.byScore, 0)
  const t = v.thresholds
  const tone = (score) => (score <= t.simple ? 'green' : score <= t.coding ? 'yellow' : 'red')
  return [
    ...v.summary.byScore.map((n, i) => row(el, String(i + 1).padStart(2), bar(n, max, 20) + ' ' + n, tone(i + 1))),
    el.Text({ dimColor: true, children: ['simple ≤ ' + t.simple + ' · coding ≤ ' + t.coding + ' · critical above'] }),
  ]
}

function recentTab(el, v) {
  return v.summary.recent.map((e) => {
    const where = e.child ? (e.child.exitCode === 0 ? 'child ' + Math.round(e.child.ms / 1000) + 's' : 'child failed') : 'main'
    return row(el, e.score + '/10 ' + e.kind, e.model + ' · ' + where + ' · via ' + e.source, e.model === v.sessionModel ? 'magenta' : 'cyan')
  })
}

const BODIES = { models: modelsTab, kinds: kindsTab, scores: scoresTab, recent: recentTab }

export function paneTree(el, v, onTab) {
  const tabs = TABS.map((t, i) => el.Button({ key: 'tab-' + t, label: t, hotkey: String(i + 1), plain: true, dimColor: v.tab !== t, onPress: () => onTab(t) }))
  const body = v.summary.total ? BODIES[v.tab](el, v) : [el.Text({ dimColor: true, children: ['No turns recorded yet. Send a prompt and come back.'] })]
  return el.Box({ flexDirection: 'column', children: [el.Box({ flexDirection: 'row', columnGap: 3, children: tabs }), el.Text({ children: [' '] }), ...body] })
}
