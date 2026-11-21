// When a routed child fails: what kind of failure it was, which equivalent models to try next,
// and the line that says what happened. The main model takes the turn only once every equivalent
// has failed. Pure.

const CONTEXT = /prompt is too long|context[ _-]?(length|window)|maximum context|too many tokens|token limit|request too large/i
const REQUEST = [400, 401, 403, 404, 422]

function why(status, text) {
  if (status) return String(status)
  if (/timed? ?out|timeout|ETIMEDOUT/i.test(text)) return 'timeout'
  if (/connect|ECONNRE|ENOTFOUND|socket/i.test(text)) return 'connection error'
  return 'no answer'
}

// { kind, why }. kind: 'context' (the prompt does not fit: a larger window may take it), 'request'
// (a bad request, which any model would refuse alike) or 'overload' (429, 5xx, timeout, no answer:
// another model may well answer).
export function failureOf(out) {
  const e = (out && out.error) || {}
  const status = typeof e.status === 'number' ? e.status : null
  const text = String(e.text || '')
  if (status === 413 || CONTEXT.test(text)) return { kind: 'context', why: 'context too long' }
  if (REQUEST.includes(status)) return { kind: 'request', why: String(status) }
  return { kind: 'overload', why: why(status, text) }
}

function healthy(ctx) {
  const live = ctx.live
  if (!live) return ctx.catalogue
  return live.served.filter((id) => !live.down.includes(id))
}

// The same class as the failed model first (Palgu's /v1/models/health names it), then every other
// healthy model in the gateway's order.
function equivalents(model, ctx) {
  const pool = healthy(ctx).filter((id) => id !== model)
  const classes = (ctx.live && ctx.live.classes) || {}
  const cls = classes[model]
  if (!cls) return pool
  return [...pool.filter((id) => classes[id] === cls), ...pool.filter((id) => classes[id] !== cls)]
}

// The models to try after `model` failed with `kind`, at most ctx.max of them. A context error
// moves only to ctx.longContext (larger windows); a request error tries nothing.
export function nextModels(model, kind, ctx) {
  const max = Math.max(0, Number(ctx.max) || 0)
  if (kind === 'request' || !max) return []
  if (kind === 'context') {
    const ok = healthy(ctx)
    return (ctx.longContext || []).filter((id) => id !== model && (!ctx.live || ok.includes(id))).slice(0, max)
  }
  return equivalents(model, ctx).slice(0, max)
}

// tried: [{ model, why }] for each model that failed; served: the model that answered, or ''.
export function fallbackNote(tried, served) {
  if (!tried.length) return ''
  if (served) return 'child: ' + tried.map((t) => t.model + ' failed (' + t.why + ')').join(', ') + ' → served by ' + served
  if (tried.length === 1) return 'child on ' + tried[0].model + ' failed (' + tried[0].why + '), main model takes this turn'
  return 'all equivalents failed: ' + tried.map((t) => t.model + ' (' + t.why + ')').join(', ') + '; main model takes this turn'
}

// The catalogue as ids the child can run: a family route (`glm/5.3`, as OpenRouter's catalogue lists
// it) becomes its member's id; one no family knows is dropped; a plain id stays.
export function gatewayIds(catalogue, families) {
  return catalogue.map((v) => {
    if (!v.includes('/')) return v
    const [family, member] = [v.slice(0, v.indexOf('/')), v.slice(v.indexOf('/') + 1)]
    return ((families[family] || {}).members || {})[member] || ''
  }).filter(Boolean)
}
