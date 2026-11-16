// The mod's local classifier: Ollama on this machine, the complexity strategy's rubric, the
// "<score> <kind>" verdict (hooks/lib/classify.js). Used only when the plugin options name a route
// for a tier; any failure or a slow answer (4 s) means no verdict, and Palgu routes.
import { ollamaBody, ollamaReply, parseVerdict } from '../../../hooks/lib/classify.js'
import { BUILTIN, strategyPrompt } from '../../../hooks/lib/strategies.js'

export async function askOllama(text, model, fetchImpl = fetch) {
  try {
    const res = await fetchImpl('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: ollamaBody(model, strategyPrompt(BUILTIN.complexity, text)),
      signal: AbortSignal.timeout(4000)
    })
    return res.ok ? parseVerdict(ollamaReply(await res.text())) : undefined
  } catch {
    return undefined
  }
}
