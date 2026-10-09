# mixture-of-models-claude-mod

[![ci](https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Keep your Claude subscription for the turns that need it. Hand the rest to a cheaper model. A Claude Code **mod** (an in-process plugin, new in Claude Code 2.1.287) that scores every prompt for blast radius and answers the low-score turns with a separate headless Claude Code on an Anthropic-compatible gateway (GLM, Kimi, DeepSeek, whatever yours serves). Your main session is never renamed, re-pointed or touched. Ported from [Maggy](https://github.com/alinaqi/maggy)'s routing.

To be precise about what it is: **turn-level delegation**, not per-request model mixing. A routed turn runs in a child process with a short brief of your recent context; the child's answer lands in your transcript, tagged. Critical turns stay on Claude exactly as before.

> **Status: early.** Released on day two of Claude Code mods, verified on one machine. Read [What the child can and cannot do](#what-the-child-can-and-cannot-do) before trusting it with a deploy.

## Install

Mods need **Claude Code 2.1.287 or later**. The stable Homebrew cask is still 2.1.286, so check first:

```bash
claude --version
# too old? one of:
brew uninstall --cask claude-code && brew install --cask claude-code@latest   # Homebrew
npm install -g @anthropic-ai/claude-code@latest                               # npm
claude update                                                                 # native installer
```

Then:

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

Give the child a gateway (any Anthropic-compatible endpoint that serves your model ids; tested with [srooter](https://www.srooter.ai), and z.ai or Moonshot's Anthropic endpoints work the same way), see [Setup](#setup). Start `claude`, run `/route`. Until a gateway is configured the mod is observe-only and changes nothing.

**Design rule: the main session is never touched.** It stays on your claude.ai subscription with no `ANTHROPIC_BASE_URL`. When a prompt is routed to GLM or Kimi, the mod answers that turn itself by running a **separate, headless `claude -p` child** whose environment alone points at the gateway (srooter). The child's output becomes the turn's answer in your transcript. Nothing about the main process, its model, its auth or its requests changes.

Per prompt the mod:

1. **Scores** it 1-10 for blast radius with a local Ollama model (free), falling back to `$.model.classify` on `claude-haiku-4-5` (your plan), then the last score seen. Thresholds turn the score into `simple | coding | critical`. See [How it decides](#how-it-decides).
2. **Applies Maggy's pre-routing rules first**: `use claude` or `execute the plan` force `critical`; a prompt that starts with review, summarise, explain, compare or research goes to `analysis`; `go ahead`, `yes`, or a prompt of six words or fewer while tools were just used keeps the current route instead of re-classifying.
3. **Delegates** a routed turn to the child: `claude -p --model glm-5.3` on the gateway, fed a brief over stdin with the last few exchanges of your session plus the task.
4. **Falls back** to the main model for that turn if the child fails or prints nothing, and says so in the transcript.
5. **Shows you what ran where**, on every turn. See [What you see](#what-you-see).

`critical` turns never start a child. They run in the main session, on the subscription, exactly as if the mod were not there.

## How it decides

The classifier is asked one question: how much damage does a wrong answer do? It answers with a number, and the rubric is explicit:

| Score | Means | Tier (default thresholds) |
| :- | :- | :- |
| 1-2 | lookups, grep, shell one-liners, syntax questions, reading logs, git status or diff | `simple` |
| 3-4 | single-file edits, tests, docs, config changes, small bug fixes, scaffolding | 3 `simple`, 4 `coding` |
| 5-6 | multi-file features, wiring services or tools together, integrations, deployments that follow a known pattern | `coding` |
| 7-8 | debugging across services, data migrations, performance work, changes that are awkward to undo | 7 `coding`, 8 `critical` |
| 9-10 | security or auth design, architecture decisions, production incidents, anything irreversible | `critical` |

The prompt tells the classifier that length, the number of services named, or pasted API keys do not raise the score by themselves, which is what used to push ordinary integration work onto the main session. Move the cut-offs with `router.thresholds`; for example `{ "simple": 3, "coding": 8 }` keeps everything but 9-10 off Claude. Every route line and the band show the score, so when a decision looks wrong you can see the number behind it.

## What you see

Claude and the gateway are both visible, all the time:

| Surface | Main-session turn | Routed turn |
| :- | :- | :- |
| Band above the prompt | `mixture-of-models · auto · last: claude-opus-5 (critical via rule)  1: auto  2: glm  3: kimi  4: claude  5: off` | `… · running glm-5.3 in a child…` while it runs |
| Spinner | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| Reply in the transcript | unchanged (or tagged `⇢ claude-opus-5 · main session` with `ui.tags: "all"`) | a dim `⇢ glm-5.3 · child on gateway` line above the reply, kept in scrollback |
| Line under the answer | `route: claude-opus-5 · critical 9/10 via claude-haiku-4-5 · 23.1k in / 0.9k out · cache 91% · main session · today: claude-opus-5 ×3, glm-5.3 ×5` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: …` | same |

The band's buttons have digit hotkeys: with an empty prompt, type `3` and pause to pin Kimi, `1` to go back to auto. Turn the band off with `"ui": { "band": false }`.

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
    "thresholds": { "simple": 3, "coding": 7 },
    "ollama":     { "base": "http://localhost:11434", "model": "qwen2.5-coder:3b" },
    "classifier": "claude-haiku-4-5",
    "child": {
      "command":  ["claude"],
      "baseUrl":  "https://api.srooter.ai/anthropic",
      "keyFile":  "~/.maggy/.env",
      "keyVar":   "SROOTER_API_KEY",
      "args":     ["--bare", "--permission-mode", "acceptEdits"],
      "maxTurns": 25,
      "timeoutMs": 600000,
      "contextMessages": 6
    },
    "ui":      { "band": true, "tags": "routed" },
    "summary": true
  }
}
```

- `routes`: tier → model id the gateway serves. `"claude"` means the tier stays in the main session.
- `primary` (Maggy's followed model, set with `/model-config`): `glm`, `kimi` or `deepseek` makes the `coding` tier follow it unless `routes.coding` is set. `primary: claude` changes nothing: `critical` is already on Claude, and `coding` stays cheap unless you set `routes.coding` to `"claude"`.
- `thresholds`: the blast-score cut-offs, `{ "simple": 3, "coding": 7 }` by default.
- `classifier`: the Claude model used when Ollama is unreachable. Undated aliases only (`claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`).
- `child.command`: the executable. Use a launcher that sets its own auth (such as the `~/bin/claude-<provider>` launchers Maggy writes) and the mod skips the key lookup.
- `child.baseUrl`, `keyFile`, `keyVar`: where the child's `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` come from. Set only in the child's environment.
- `child.args`: extra flags. The default is `--bare` (no inherited hooks or plugins, API-key auth only, so the child can never fall back to your subscription) plus `acceptEdits` so it can edit files without prompting. The mod always adds `--add-dir <cwd>`, which keeps the project's `CLAUDE.md` in reach under `--bare`. Add `--dangerously-skip-permissions` only if you want the child to run commands unattended; drop `--bare` if you want your hooks and plugins inside the child.
- `child.maxTurns`, `timeoutMs`: the child's agentic budget. `timeoutMs` caps at ten minutes, the limit of `$.process.run`.
- `child.contextMessages`: how many recent exchanges go into the brief.
- `ui.band`: draw the band above the prompt (default `true`). `ui.tags`: which replies get the provenance tag, `routed` (default), `all` or `off`.

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
- It runs `--bare` by default, so your hooks and plugins stay out of it. The mod also detects the `MAGGY_ROUTER_CHILD` marker and does nothing inside a child.
- The tag and the route line name the model the mod **asked for**. A gateway that routes by intent, as srooter does, may answer with another model; Claude Code's `-p` output does not expose which, so the mod cannot show it.
- Output arrives when the child finishes; this version uses `$.process.run`, so a routed answer is not streamed token by token.

## Tests

```bash
npm test                           # pure-function tests under Node, no Claude Code needed
claude plugin validate --strict .  # manifest + static analysis of the hooks module
claude plugin test                 # needs v2.1.287+; fires events through the hooks with no session or network
```

`tests/classify`, `config`, `routing`, `stats`, `child` and `ui` cover the pure logic in `hooks/lib/`. `tests/mod.test.ts` drives the hooks end to end: a simple prompt is answered by a child with the gateway in its environment and the brief on stdin, a critical prompt never starts one, a failed child falls back to the main model, a missing key means observe-only, a child session disables the mod, and `/route off` and `/route kimi` behave.

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
│   ├── register.js         # the 9 hooks; the only file that touches the mods API ($)
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
