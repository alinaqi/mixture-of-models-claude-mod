// Delegate output validation. A child answer is only relayed when it is a real answer:
// not a handback, not a request that the user act, not a claim it never checked, not
// narration of intent, and not a repeat. Anything else goes back to the main model. Pure.

const HANDBACK = /^\s*HANDBACK\b/
const ASKS_USER = /\b(blocked by (the )?permission|permission (system|prompt|denied)|(need|needs|require|requires) (your )?approval|approve (it|this|them) in the ui|you (must|need to|will need to|'ll need to) (approve|run|execute|allow|grant|merge|push)|please (approve|run|execute|allow)|yourself|sandboxed)\b/i
const CLAIM = /\b(I('ve| have)? (added|created|updated|fixed|changed|wrote|written|modified|implemented|committed|pushed|merged|opened|ran|deleted|removed|refactored|installed)|pr\s*#\d+|\d+ commits? (behind|ahead)|no [\w-]+ (runs?|prs?|builds?) exists?)\b/i
const INTENT = /^(I'll|I will|let me|I'm going to|I am going to|next,? I|then,? I|first,? I|now,? I'll)\b/i

function sentences(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
}

function isNarration(text) {
  const all = sentences(text)
  return all.length > 0 && all.filter((s) => INTENT.test(s)).length * 2 >= all.length
}

// `out.turns === 1` means the child answered without a single tool call.
function reasonFor(out, previous) {
  const text = out.answer
  if (HANDBACK.test(text)) return 'handback'
  if (ASKS_USER.test(text)) return 'asks the user to act'
  if (out.turns === 1 && CLAIM.test(text)) return 'unverified claim'
  if (isNarration(text)) return 'narration'
  return previous.has(text) ? 'repeat of an earlier answer' : ''
}

export function vetAnswer(out, previous) {
  const reason = reasonFor(out, previous)
  return { ok: reason === '', reason }
}
