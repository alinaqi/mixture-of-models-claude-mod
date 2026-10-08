# mixture-of-models-claude-mod

[![ci](https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A mixture of models for Claude Code. [Maggy](https://github.com/alinaqi/maggy)'s model routing, rebuilt as a Claude Code **mod**: it runs inside Claude Code, so the hand-off to a cheaper model is automatic instead of an instruction Claude has to follow.

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

**Design rule: the main session is never touched.** It stays on your claude.ai subscription with no `ANTHROPIC_BASE_URL`. When a prompt is routed to GLM or Kimi, the mod answers that turn itself by running a **separate, headless `claude -p` child** whose environment alone points at the gateway (srooter). The child's output becomes the turn's answer in your transcript. Nothing about the main process, its model, its auth or its requests changes.

Per prompt the mod:

1. **Classifies** it into `simple | coding | analysis | critical` with a local Ollama model (free), falling back to `$.model.classify` on `claude-haiku-4-5` (your plan), then the last cached label.
2. **Applies Maggy's pre-routing rules first**: `use claude` or `execute the plan` force `critical`; `go ahead`, `yes`, or a prompt of six words or fewer while tools were just used keeps the current route instead of re-classifying.
3. **Delegates** a routed turn to the child: `claude -p --model glm-5.3` on the gateway, fed a brief over stdin with the last few exchanges of your session plus the task.
4. **Falls back** to the main model for that turn if the child fails or prints nothing, and says so in the transcript.
5. **Reports**: a line under each routed answer (`route: glm-5.3 · coding via ollama · child 42s · today: glm-5.3 ×4`), `via glm-5.3 (child)…` in the spinner, and a `/route` command.

`critical` turns never start a child. They run in the main session, on the subscription, exactly as if the mod were not there.

## Requirements

- Claude Code **v2.1.287 or later** (`claude --version`). Mods do not load on older builds; `claude update`.
- A gateway the child can use: srooter's Anthropic endpoint and a key, or any Anthropic-compatible endpoint that serves the model ids in `routes`.
- Optional: Ollama with a small model for free classification (`ollama pull qwen2.5-coder:3b`). Without it the classifier falls back to Haiku on your plan.

## Setup

See [GETTING_STARTED.md](GETTING_STARTED.md) for the full walkthrough, or `./install.sh`.

1. Put the gateway key in Maggy's env file, which the mod reads (never your shell or `ps`):

   ```bash
   echo 'SROOTER_API_KEY=srt_…' >> ~/.maggy/.env
   ```

2. Add the child's base URL to Maggy's `~/.claude/model-config.json` under `router.child.baseUrl` (full example below).

3. Install (above) or load a checkout for one session with `claude --plugin-dir .`, then run `/route` in the session.

Until both the base URL and the key are present the mod is **observe-only**: it classifies and `/route` shows what it would do, but no child starts.

## Configuration

The mod reads Maggy's single source of truth, `~/.claude/model-config.json`, and adds an optional `router` block. It never writes to that file.

```json
{
  "primary": "glm",
  "router": {
    "routes":     { "simple": "glm-5.3", "coding": "glm-5.3", "analysis": "kimi-k3", "critical": "claude" },
    "ollama":     { "base": "http://localhost:11434", "model": "qwen2.5-coder:3b" },
    "classifier": "claude-haiku-4-5",
    "child": {
      "command":  ["claude"],
      "baseUrl":  "https://www.srooter.ai/anthropic",
      "keyFile":  "~/.maggy/.env",
      "keyVar":   "SROOTER_API_KEY",
      "args":     ["--permission-mode", "acceptEdits"],
      "maxTurns": 25,
      "timeoutMs": 600000,
      "contextMessages": 6
    },
    "summary": true
  }
}
```

- `routes`: tier → model id the gateway serves. `"claude"` means the tier stays in the main session.
- `primary` (Maggy's followed model, set with `/model-config`): `glm`, `kimi` or `deepseek` makes the `coding` tier follow it unless `routes.coding` is set. With `primary: claude` only `simple` and `analysis` leave the main session.
- `classifier`: the Claude model used when Ollama is unreachable. Undated aliases only (`claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`).
- `child.command`: the executable. Use a launcher that sets its own auth (such as the `~/bin/claude-<provider>` launchers Maggy writes) and the mod skips the key lookup.
- `child.baseUrl`, `keyFile`, `keyVar`: where the child's `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` come from. Set only in the child's environment.
- `child.args`: extra flags. The default lets the child edit files without prompting; add `--dangerously-skip-permissions` only if you want it to run commands unattended, or `--bare` to skip your hooks, plugins and `CLAUDE.md` in the child.
- `child.maxTurns`, `timeoutMs`: the child's agentic budget. `timeoutMs` caps at ten minutes, the limit of `$.process.run`.
- `child.contextMessages`: how many recent exchanges go into the brief.

## Commands

| Command | Effect |
| :- | :- |
| `/route` | Live or observe-only, mode, current decision, today's counts |
| `/route auto` | Classify every prompt (default) |
| `/route off` | Never start a child |
| `/route simple\|coding\|analysis\|critical` | Pin a tier |
| `/route glm`, `/route kimi`, `/route kimi-k3`, `/route claude` | Pin a model (a prefix expands to the configured model) |

Pins persist across sessions in the plugin's store.

## What the child can and cannot do

- It has Claude Code's tools and runs in the session's working directory, so it can read, edit and run things. Its tool calls are not shown in the main transcript, only its final text.
- It does not share the main session's memory. The brief carries the last `contextMessages` exchanges (truncated) and the task.
- It inherits your hooks and plugins unless `--bare` is in `child.args`. The mod itself detects the `MAGGY_ROUTER_CHILD` marker and does nothing inside a child.
- Output arrives when the child finishes; this version uses `$.process.run`, so a routed answer is not streamed token by token.

## Tests

```bash
npm test                           # pure-function tests under Node, no Claude Code needed
claude plugin validate --strict .  # manifest + static analysis of the hooks module
claude plugin test                 # needs v2.1.287+; fires events through the hooks with no session or network
```

`tests/classify`, `config`, `routing`, `stats` and `child` cover the pure logic in `hooks/lib/`. `tests/mod.test.ts` drives the hooks end to end: a simple prompt is answered by a child with the gateway in its environment and the brief on stdin, a critical prompt never starts one, a failed child falls back to the main model, a missing key means observe-only, a child session disables the mod, and `/route off` and `/route kimi` behave.

## Layout

```
mixture-of-models-claude-mod/
├── .claude-plugin/
│   ├── plugin.json         # the plugin manifest
│   └── marketplace.json    # lets `claude plugin install` find it in this repo
├── docs/adr/               # architecture decisions (0001: child-process delegation)
├── scripts/test-pure.mjs   # runs the pure tests under Node
├── hooks/
│   ├── hooks.json          # points at register.js
│   ├── register.js         # the 7 hooks; the only file that touches the mods API ($)
│   └── lib/                # pure, unit-tested
│       ├── config.js       # defaults and the model-config.json overlay
│       ├── classify.js     # Maggy's pre-routing rules, classifier prompt, Ollama wire format
│       ├── routing.js      # tier → model, /route grammar, summary line
│       ├── child.js        # child argv, scoped env, readiness, env-file parsing, the brief
│       └── stats.js        # per-day counts
└── tests/
```

Mods require every `$` call to live in `register.js` (a `$` passed to another file fails `claude plugin validate`), which is why that file holds more functions than the usual limit.

## Why a child process

See [ADR 0001](docs/adr/0001-child-process-delegation.md). In short: a mod can rename a request's model but not change where it goes, and routing the subscription token through a proxy was rejected. A child process with its own environment is the clean split.

## Mapping from Maggy

| Maggy | Here |
| :- | :- |
| `hooks/route-task-hook` (UserPromptSubmit, qwen3 classifier, continuation guard, cache) | `prompt.submit` + `lib/classify.js`, `$.http.fetch` to Ollama, `$.store` cache |
| "You MUST delegate — run ~/bin/glm" injected into context | `turn.step` runs the child and returns its answer; Claude is never asked to delegate |
| `~/bin/claude-<provider>` launchers from `model_routing.py write-launcher` | `child.command` can point at one; otherwise the mod scopes the env itself |
| `hooks/usage-summary-hook` (Stop) | `turn.complete` returns the summary line |
| `/model-config` followed model | `primary` in `model-config.json` drives the `coding` tier |
| `srooter` gateway | the child's endpoint; the main session never sees it |

Tested with Claude Code 2.1.274 for `claude plugin validate` only; types used are from the 2.1.277 declarations. Check `.claude-plugin/types/` after the first load on a newer build, in particular whether `$.process.spawn` is available to stream the child's output.
