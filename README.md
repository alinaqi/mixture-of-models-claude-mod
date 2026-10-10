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

or, inside a session, `/plugin install mixture-of-models --marketplace alinaqi/mixture-of-models-claude-mod`.

Give the child a gateway (any Anthropic-compatible endpoint that serves your model ids; tested with [palgu](https://www.palgu.ai), and z.ai or Moonshot's Anthropic endpoints work the same way), see [Setup](#setup). Start `claude`, run `/route`. Until a gateway is configured the mod is observe-only and changes nothing.

**Design rule: the main session is never touched.** It stays on your claude.ai subscription with no `ANTHROPIC_BASE_URL`. When a prompt is routed to GLM or Kimi, the mod answers that turn itself by running a **separate, headless `claude -p` child** whose environment alone points at the gateway (palgu). The child's output becomes the turn's answer in your transcript. Nothing about the main process, its model, its auth or its requests changes.

Per prompt the mod:

1. **Scores** it on two axes with one classifier call: a 1-10 blast radius and a task kind (`code | research | review | docs | data | multimodal`). The score decides whether Claude is mandatory; the kind picks which cheaper model gets the rest. A local Ollama model does it for free, `claude-haiku-4-5` on your plan is the fallback, then the last verdict seen. See [How it decides](#how-it-decides).
2. **Applies Maggy's pre-routing rules first**: `use claude` or `execute the plan` force `critical`; `go ahead`, `yes`, or a prompt of six words or fewer while tools were just used keeps the current route instead of re-classifying.
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

The prompt tells the classifier that length, the number of services named, or pasted API keys do not raise the score by themselves, which is what used to push ordinary integration work onto the main session. It also says that deep reasoning (algorithms with proofs, concurrency, performance tuning, cryptography) scores at least 7 whatever the blast radius, so hard-but-safe work stays on Claude. Move the cut-offs with `router.thresholds`; for example `{ "simple": 3, "coding": 8 }` keeps everything but 9-10 off Claude.

**The kind picks the model.** Below `critical`, `routes.kinds` maps the task kind to a model: by default `research` and `review` go to Kimi for its long context, `multimodal` stays on Claude, and everything else takes the tier's model (GLM). Add `"docs": "deepseek-v4-pro"` or `"data": "..."` to the matrix as your gateway allows.

**Borderline scores get a second opinion.** A score on the coding cut-off or one above it is sampled a second time and the higher wins, so a 7-or-8 debugging task doesn't flip tiers on classifier noise.

**It remembers failures.** Every two child failures for a kind lower that kind's coding cut-off by one (never below `simple + 1`), so work the cheap model keeps failing at drifts back to Claude. `/route reset` clears the memory.

Every route line and the band show the score and the kind, so when a decision looks wrong you can see the numbers behind it.

## What you see

Claude and the gateway are both visible, all the time:

| Surface | Main-session turn | Routed turn |
| :- | :- | :- |
| Band above the prompt | `mixture-of-models · auto · last: claude-opus-5 (critical via rule)  1: auto  2: glm  3: kimi  4: claude  5: off` | `… · running glm-5.3 in a child…` while it runs |
| Spinner | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| Reply in the transcript | unchanged (or tagged `⇢ claude-opus-5 · main session` with `ui.tags: "all"`) | a dim `⇢ glm-5.3 · child on gateway` line above the reply, kept in scrollback |
| Line under the answer | `route: claude-opus-5 · critical 9/10 via claude-haiku-4-5 · 23.1k in / 0.9k out · cache 91% · main session · today: claude-opus-5 ×3, glm-5.3 ×5` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: …` | same |
| `/route stats` | A pane, "Mixture of models", with four tabs on hotkeys 1-4: **models** (bars per model, share of turns, the headline "N of M turns off Claude"), **kinds** (each kind and which models took it), **scores** (a 1-10 histogram coloured by tier, cut-offs marked), **recent** (the last decisions with score, kind, model and child time). Esc closes it. | same |

The band's buttons have digit hotkeys: with an empty prompt, type `3` and pause to pin Kimi, `1` to go back to auto. Turn the band off with `"ui": { "band": false }`.

## Requirements

- Claude Code **v2.1.287 or later** (`claude --version`). Mods do not load on older builds; `claude update`.
- A gateway the child can use: palgu's Anthropic endpoint and a key, or any Anthropic-compatible endpoint that serves the model ids in `routes`.
- Optional: Ollama with a small model for free classification (`ollama pull qwen2.5-coder:3b`). Without it the classifier falls back to Haiku on your plan.

## Setup

See [GETTING_STARTED.md](GETTING_STARTED.md) for the full walkthrough, or `./install.sh`.

1. Give the child its gateway. The plugin asks for two values, and the key is masked and kept in Claude Code's secure storage, never in a settings file:

   ```
   /plugin configure mixture-of-models@mixture-of-models-claude-mod
   ```

   or from the shell at install time: `claude plugin install mixture-of-models@mixture-of-models-claude-mod --config gateway_url=https://api.palgu.ai/anthropic --config gateway_key=srt_…`, or afterwards: `echo '{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"srt_…"}' | claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`

2. Optionally tune routes, thresholds and the child in `~/.claude/model-config.json`; `config.example.json` in the repo is a complete starting point (also shown below).

3. Start `claude` and run `/route`.

Until a gateway URL and key are present the mod is **observe-only**: it classifies and `/route` shows what it would do, but no child starts.

## What this plugin runs, reads, sends and stores

The directory's security scan compares this section with the code. Everything the mod does outside its own code is listed here. In one breath:

- It **fetches** `http://localhost:11434/api/chat` with `$.http.fetch`, sending the prompt text and the scoring rubric to a local Ollama, to score the prompt. No credentials, nothing leaves the machine.
- It **calls** `$.model.classify`, which sends the same prompt text and rubric to Anthropic through Claude Code's own API client on your own account, when Ollama does not answer.
- It **runs** one program, `claude` (Claude Code itself, headless), with `$.process.run`, for routed turns only, with the environment variables `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` set to the gateway values you configured. That child **sends** your prompt and a short brief of recent session text to that gateway.
- It **reads** `~/.claude/model-config.json`, `HOME` and `MAGGY_ROUTER_CHILD`, and **stores** the route pin, per-day counts, the last verdict, per-kind failure counts and a log of the last 200 decisions (day, model, kind, tier, score, classifier source, child time and exit code; never prompt text) in the plugin store.

Full detail follows; a privacy policy is at [PRIVACY.md](PRIVACY.md).

### Hooks

The hooks module `hooks/register.js` registers nine hooks. What each one does with the events and calls it sees:

| Hook | What it does |
| :- | :- |
| `session.start` | Reads `~/.claude/model-config.json`, takes the gateway URL and key from the plugin's options, remembers the session's model, loads the `/route` pin from the plugin store, and registers the `/route` command. Does nothing when `MAGGY_ROUTER_CHILD` is set, so the mod stays inactive inside its own child. |
| `prompt.submit` | Passes every prompt through unchanged. On the side it decides the route: pre-rules first, then a 1-10 blast score from the classifier (see Network), then the thresholds. Never drops, rewrites or adds to a prompt. Fails open: if scoring throws, the prompt still goes through. |
| `turn.start` | Clears the previous turn's child result. |
| `turn.step` | For a routed turn, instead of letting the main session call its model, runs the child process described under Programs and yields the child's text as the turn's answer with `stopReason: end_turn`. For every other turn, and for subagents, it calls `next(e)` unchanged. If the child fails or prints nothing it calls `next(e)`, so the main model answers. |
| `turn.complete` | Appends a line under the answer with the route, score, cost and where it ran, and updates per-day counts in the plugin store. |
| `ui.render` for `AbovePrompt` | Draws the band: the current mode and last decision, plus buttons that change the `/route` pin. Keeps whatever other mods draw there. |
| `ui.render` for `AssistantMessage` | Puts a dim provenance line above a reply the child produced. Other replies are passed through. |
| `ui.render` for `Spinner` | Adds `via <model> (child)…` after the spinner's word during a routed turn. |
| `ui.render` for `Pane` | Draws the "Mixture of models" stats pane (id `routing-stats`) from the decision log when `/route stats` opened it. Other panes are passed through. |
| `command.run` for `/route` | Shows the route state or sets the pin (`auto`, `off`, a tier, or a model). |

The mod never handles `tool.call` or `tool.check`, so it never approves, denies or changes a tool call, and it never changes permission prompts.

### Network: the hosts this plugin contacts

The mod itself makes exactly one kind of network call, and the child process it starts makes another:

| Who | Call | Address | What is sent | Why |
| :- | :- | :- | :- | :- |
| The mod, in `prompt.submit` | `$.http.fetch` | `http://localhost:11434/api/chat`, fixed in the code | The scoring rubric and the prompt text, as an Ollama chat request, no credentials | Free local classification. Skipped when nothing answers there. |
| The mod, in `prompt.submit` | `$.model.classify` | Anthropic's API through Claude Code's own client and your own plan | The scoring rubric and the prompt text | Classification when Ollama is unavailable. Model: the `classifier` alias, `claude-haiku-4-5` by default. |
| The child process (Claude Code itself), started in `turn.step` | Claude Code's normal API client | The `gateway_url` you set in the plugin's options (for example `https://api.palgu.ai/anthropic`), with `gateway_key` as its API key | Your prompt plus a brief of the last `contextMessages` exchanges of the session (text only, truncated), then whatever the child's own agent loop sends while it works | That is the point of the plugin: the turn runs on the gateway's model instead of the main session's. |

The mod contacts no other host. The gateway is whatever you configure; nothing is sent to a fixed third party.

### Programs this plugin runs

**Which programs:** exactly one, `claude`, which is Claude Code itself in headless mode. The plugin runs no shell, no script bundled in the plugin folder, no package launcher, and no other executable.

**Why:** a mod can rename the model on a request but cannot change the endpoint or credentials of the session it runs in. The only way to run a turn on a different endpoint with Claude Code's own tools, while leaving the main session's endpoint and credentials untouched, is a second Claude Code process whose environment points at the gateway. The child exists for that reason alone, and only for turns the score routes away from the main session.

**How:** one `$.process.run` call, in `turn.step`. The program name is the fixed text `claude` at the call. Its arguments:

```
claude -p --model <routed model id> --output-format text --max-turns <child.maxTurns> --add-dir <session cwd> --bare --permission-mode acceptEdits
```

`--bare` keeps your hooks, plugins and keychain out of the child. `child.args` replaces the last three flags if you set it. The child's environment adds `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY` (the gateway values) and `MAGGY_ROUTER_CHILD=1`. The brief is written to its stdin. It runs in the session's working directory with Claude Code's tools under that permission mode, so it can read and edit files there and run commands the mode allows; those commands are the child's own agent decisions, governed by Claude Code's permission system, not commands this plugin issues. It is killed at `child.timeoutMs`.

### Files and environment it reads

- `~/.claude/model-config.json`, through `$.fs.read`, for routes, thresholds, the classifier alias and child settings. It holds no credentials. Missing or invalid, the defaults apply.
- The environment variables `HOME` and `MAGGY_ROUTER_CHILD`, through `$.env.get`.
- Nothing else. The gateway key is never read from a file or from the environment; it comes only from the plugin's `gateway_key` option, which Claude Code keeps in secure storage.

### What it stores

In the plugin's own store (`$.store`, under `~/.claude/plugins/store/`): the `/route` pin, per-day counts per model, the last verdict, per-kind failure counts, and a log of the last 200 decisions (day, model, kind, tier, score, classifier source, child duration and exit code). No prompt text, no answers, no credentials.

### What it never does

It never writes to settings files or to `model-config.json`, never changes the main session's model, endpoint or credentials, never handles tool calls, and never sends data anywhere other than the two classifier destinations above and the gateway you configured.

## Configuration

The mod reads Maggy's single source of truth, `~/.claude/model-config.json`, and adds an optional `router` block. It never writes to that file.

```json
{
  "primary": "glm",
  "router": {
    "routes":     { "simple": "glm-5.3", "coding": "glm-5.3", "critical": "claude",
                    "kinds": { "research": "kimi-k3", "review": "kimi-k3", "multimodal": "claude" } },
    "thresholds": { "simple": 3, "coding": 7 },
    "ollama":     { "model": "qwen2.5-coder:3b" },
    "classifier": "claude-haiku-4-5",
    "child": {
      "baseUrl":  "https://api.palgu.ai/anthropic",
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

- `routes`: tier → model id the gateway serves, plus `routes.kinds`: kind → model for the non-critical tiers. `"claude"` means the main session.
- `primary` (Maggy's followed model, set with `/model-config`): `glm`, `kimi` or `deepseek` makes the `coding` tier follow it unless `routes.coding` is set. `primary: claude` changes nothing: `critical` is already on Claude, and `coding` stays cheap unless you set `routes.coding` to `"claude"`.
- `thresholds`: the blast-score cut-offs, `{ "simple": 3, "coding": 7 }` by default.
- `classifier`: the Claude model used when Ollama is unreachable. Undated aliases only (`claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`).
- `child.baseUrl`: fallback for the gateway URL when the plugin's `gateway_url` option is unset. The key has no fallback; it comes only from the `gateway_key` option.
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
| `/route simple\|coding\|critical` | Pin a tier |
| `/route reset` | Clear the per-kind failure memory |
| `/route stats` | Open the stats pane: models, kinds, scores, recent |
| `/route glm`, `/route kimi`, `/route kimi-k3`, `/route claude` | Pin a model (a prefix expands to the configured model) |

Pins persist across sessions in the plugin's store.

## What the child can and cannot do

- It has Claude Code's tools and runs in the session's working directory, so it can read, edit and run things. Its tool calls are not shown in the main transcript, only its final text.
- It does not share the main session's memory. The brief carries the last `contextMessages` exchanges (truncated) and the task.
- It runs `--bare` by default, so your hooks and plugins stay out of it. The mod also detects the `MAGGY_ROUTER_CHILD` marker and does nothing inside a child.
- The tag and the route line name the model the mod **asked for**. A gateway that routes by intent, as palgu does, may answer with another model; Claude Code's `-p` output does not expose which, so the mod cannot show it.
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
│   ├── register.js         # the 10 hooks; the only file that touches the mods API ($)
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
| `~/bin/claude-<provider>` launchers from `model_routing.py write-launcher` | the mod scopes `ANTHROPIC_BASE_URL` and the key to the child's environment itself |
| `hooks/usage-summary-hook` (Stop) | `turn.complete` returns the summary line |
| `/model-config` followed model | `primary` in `model-config.json` drives the `coding` tier |
| `palgu` gateway | the child's endpoint; the main session never sees it |

Tested with Claude Code 2.1.274 for `claude plugin validate` only; types used are from the 2.1.277 declarations. Check `.claude-plugin/types/` after the first load on a newer build, in particular whether `$.process.spawn` is available to stream the child's output.
