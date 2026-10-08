// Per-day routing counts kept in $.store, the usage-summary idea from Maggy. Pure.

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
