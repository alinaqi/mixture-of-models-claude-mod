// Per-day counts for the route line, the bounded decision log, and the
// summaries the stats pane draws. Pure.

export function bumpStats(stats, day, model) {
  const today = { ...(stats[day] || {}) }
  today[model] = (today[model] || 0) + 1
  return { ...stats, [day]: today }
}

export function statsLine(stats, day) {
  const today = stats[day]
  if (!today) return 'today: no routed turns yet'
  return 'today: ' + Object.entries(today).map(([m, n]) => m + ' ×' + n).join(', ')
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
    offClaude: log.filter((e) => e.model !== sessionModel).length,
    byModel: countBy(log, 'model').map(([model, n]) => ({ model, n })),
    byKind: kindRows(log),
    byScore,
    recent: [...log].reverse().slice(0, 8),
    child: childStats(log),
  }
}
