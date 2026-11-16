# Mixture of Models for Antigravity

Palgu memory recalled into each prompt, the heartbeat that continues a turn that stopped mid-task, and Palgu's models as tools, in Google's Antigravity CLI (`agy`) ([ADR 0005](../../docs/adr/0005-other-coding-agents.md)).

Checked live with agy 1.0.7.

## Install

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installs mom and this plugin's files
mom login                                                     # sign in to Palgu
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
agy plugin list                                               # mixture-of-models, enabled
```

Then, in a project you want in Palgu memory: `mom memory on` (uploads its source to Palgu; off by default, per folder, shared with the other agents `mom` serves).

## What it does

| | How | Antigravity feature |
| :- | :- | :- |
| **Palgu memory** | On the first model call of each turn, in a memory-on folder, up to 8 pointers from the project's Palgu memory (recorded intent and ADRs, docs, code symbols) are added for the model. | `PreInvocation` (`invocationNum` 0) → `injectSteps` `ephemeralMessage` |
| **Heartbeat** | A turn that ends mid-task ("Let me check the tests.") is continued, at most 3 times per prompt. Palgu decides (`POST /anthropic/heartbeat`); without a sign-in the same classifier runs locally. `mom heartbeat off` turns it off. | `Stop` → `decision: "continue"`; the answer is read from the transcript, since the Stop input does not carry it |
| **Indexing** | `palgu memory index .` in the background at session start in a memory-on folder, at most every 10 minutes. | `SessionStart` |
| **Palgu's models as tools** | `palgu_memory_search`, `palgu_delegate` (hand a self-contained subtask to a Palgu model, `auto` or pinned) and `palgu_models`, with an always-on rule for when to use them. | `mcp_config.json` (`mom mcp antigravity`), `rules/AGENTS.md` |

Every hook fails open: if `mom` errors or Palgu is slow, `agy` goes on as if there were no hook.

## Routing

Antigravity's hooks cannot change the model, and its own model setting takes only Gemini models (or an enterprise model gateway an admin configures). So the agent's own turns stay on the Gemini model you pick in `agy`; Palgu's routing reaches it through `palgu_delegate`, which the rule tells the agent to use for low-risk, self-contained subtasks.

## What it sends where

- To `https://api.palgu.ai/v1/cortex/search` (only in memory-on folders): the prompt (one line, at most 300 characters) and the project's Palgu name.
- To `https://api.palgu.ai/anthropic/heartbeat` (unless `mom heartbeat local|off`): the last 600 characters of the answer and a session id.
- To `https://api.palgu.ai/v1/chat/completions` (only when the agent calls `palgu_delegate`): the subtask's prompt.
- The key stays in `~/.config/mixture-of-models/credentials.json` (0600) or `PALGU_API_KEY`; the plugin's files hold none.

## Seen live, unlike the docs (agy 1.0.7)

- The hook input carries `hookEventName` and `cwd`; the continue flag is `continuationActive`.
- A turn that ends with an answer stops with `terminationReason: "NO_TOOL_CALL"` (the docs say `model_stop`), a failed one with `ERROR`; only the former is continued.
- The transcript (`transcriptPath`) is JSONL; the model's answers are `PLANNER_RESPONSE` steps.
- If `agy` fails with `PERMISSION_DENIED on resource project <id>`, the Google Cloud project in `~/.gemini/antigravity-cli/settings.json` (`gcp.project`) is one your account cannot use: set one you can, or use a Gemini API key with `"modelProvider": "gemini"` and `GEMINI_API_KEY`.
