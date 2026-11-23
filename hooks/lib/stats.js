// Per-day counts for the route line, the bounded decision log, and the
// summaries the stats pane draws. Pure.

export function bumpStats(stats, day, model) {
  const today = { ...(stats[day] || {}) }
  today[model] = (today[model] || 0) + 1
  return { ...stats, [day]: today }
}

export function statsLine(stats, day) {
  const counts = Object.entries(stats[day] || {})
  const total = counts.reduce((sum, [, n]) => sum + n, 0)
  if (!total) return 'today: no turns yet'
  const off = counts.filter(([m]) => !m.startsWith('claude')).reduce((sum, [, n]) => sum + n, 0)
  const share = off ? ' (' + Math.round((off / total) * 100) + '%)' : ''
  return 'today: ' + total + (total === 1 ? ' turn, ' : ' turns, ') + off + ' off Claude' + share
}

export function appendLog(log, entry, cap) {
  return [...(log || []), entry].slice(-cap)
}

export function bar(n, max, width) {
  const filled = max > 0 ? Math.round((n / max) * width) : 0
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function countBy(log, key) {
  const counts = new Map()
  for (const e of log) counts.set(e[key], (counts.get(e[key]) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function kindRows(log) {
  return countBy(log, 'kind').map(([kind, n]) => {
    const models = {}
    for (const e of log.filter((x) => x.kind === kind)) models[e.model] = (models[e.model] || 0) + 1
    return { kind, n, models }
  })
}

function childStats(log) {
  const runs = log.filter((e) => e.child)
  const ms = runs.reduce((sum, e) => sum + e.child.ms, 0)
  return { runs: runs.length, failed: runs.filter((e) => e.child.exitCode !== 0).length, avgMs: runs.length ? Math.round(ms / runs.length) : 0 }
}

export function summarize(log, sessionModel) {
  const byScore = Array(10).fill(0)
  for (const e of log) if (e.score >= 1 && e.score <= 10) byScore[e.score - 1] += 1
  return {
    total: log.length,
    // A Claude-family child still runs on Claude, so it does not count as off Claude.
    offClaude: log.filter((e) => e.model !== sessionModel && !String(e.model).startsWith('claude-')).length,
    byModel: countBy(log, 'model').map(([model, n]) => ({ model, n })),
    byKind: kindRows(log),
    byScore,
    recent: [...log].reverse().slice(0, 8),
    child: childStats(log),
  }
}

const PERIODS = { '': [7, 'last 7 days'], today: [1, 'today'], week: [7, 'last 7 days'], month: [30, 'last 30 days'], all: [0, 'all time'] }

// /route usage [today|week|month|all]: how many days back (0: every day kept), or null.
export function usagePeriod(word) {
  const p = PERIODS[String(word || '').trim().toLowerCase()]
  return p ? { days: p[0], name: p[1] } : null
}

function since(today, days) {
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - (days - 1))
  return d.toISOString().slice(0, 10)
}

// Per-day counts summed over the period, most used first.
function totals(byDay, period, today) {
  const from = period.days ? since(today, period.days) : ''
  const sum = new Map()
  for (const [day, counts] of Object.entries(byDay || {})) {
    if (day < from || day > today) continue
    for (const [model, n] of Object.entries(counts)) sum.set(model, (sum.get(model) || 0) + n)
  }
  return [...sum.entries()].sort((a, b) => b[1] - a[1])
}

function modelRows(rows, total) {
  const width = Math.max(...rows.map(([m]) => m.length))
  const digits = String(rows[0][1]).length
  return rows.map(([m, n]) => '  ' + m.padEnd(width) + '  ' + String(n).padStart(digits) + '  ' + (Math.round((n / total) * 100) + '%').padStart(3) + '  ' + bar(n, rows[0][1], 10))
}

// The models that answered turns in the period (main session and routed children), with shares,
// the share off Claude, and the models subagents ran on.
export function usageText(stats, subagents, period, today) {
  const rows = totals(stats, period, today)
  const total = rows.reduce((s, [, n]) => s + n, 0)
  if (!total) return 'Models used, ' + period.name + ': no turns yet'
  const off = rows.filter(([m]) => !m.startsWith('claude')).reduce((s, [, n]) => s + n, 0)
  const head = 'Models used, ' + period.name + ': ' + total + (total === 1 ? ' turn, ' : ' turns, ') + off + ' off Claude (' + Math.round((off / total) * 100) + '%)'
  const subs = totals(subagents, period, today)
  const subTotal = subs.reduce((s, [, n]) => s + n, 0)
  const subLine = subTotal ? ['Subagents: ' + subTotal + subs.map(([m, n]) => ' · ' + m + ' ' + n).join('')] : []
  return [head, ...modelRows(rows, total), ...subLine].join('\n')
}
