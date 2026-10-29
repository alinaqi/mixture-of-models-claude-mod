# mixture-of-models-claude-mod

[![ci](https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/alinaqi/mixture-of-models-claude-mod/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-keep%20a%20changelog-blue)](CHANGELOG.md)

Keep your Claude subscription for the turns that need it. Hand the rest to a cheaper model. A Claude Code **mod** (an in-process plugin, new in Claude Code 2.1.287) that scores every prompt for blast radius and answers the low-score turns with a separate headless Claude Code on an Anthropic-compatible gateway (GLM, Kimi, DeepSeek, whatever yours serves). Your main session is never renamed, re-pointed or touched. Ported from [Maggy](https://github.com/alinaqi/maggy)'s routing.

Routes can also name a **model family**: `claude/sonnet` runs that Claude member on your own Claude login, `kimi/auto` lets the score pick a Kimi member, and `codex` hands the turn to the Codex CLI (`codex exec`) on Palgu or on your ChatGPT login. See [Families](#families-pick-a-member-or-let-the-tier-pick) and [Codex](#codex-as-a-child).

## Get Palgu's models in one command

No dashboard, no copying keys. After [installing the mod](#install), in Claude Code:

```
/palgu login
```

1. The mod shows a sign-in link and a short code, for example `WDJB-MJHT`.
2. Open the link, sign in to Palgu or **sign up** (new accounts start on the free plan), check the code matches and press **Allow**. The page names the app: *Allow Mixture of Models on "Claude Code on your-mac"?*
3. Back in the terminal a toast says *Signed in to Palgu as you@example.com*. That's it: simple and coding turns now run on Palgu's models (GLM 5.3, Kimi K3.1, DeepSeek V4 Pro, Gemini 3.8 Flash, Mercury 3), and critical turns stay on Claude. No restart.

| Command | What it does |
| :- | :- |
| `/palgu login` | Sign up or sign in, and connect this computer |
| `/palgu status` | Who is signed in, the organisation and its plan |
| `/palgu upgrade` | Plans and billing (paid plans are bought on the web; your key picks up the new plan by itself) |

How it works: Palgu's device sign-in (the same one `srooterctl` uses) mints an API key for this computer only. You can see and revoke it on Palgu's **Devices** page. The mod saves it in Claude Code's secure storage with `claude plugin configure --values-stdin`, so it never appears on a command line or in a settings file. Already have a key, or use another gateway? See [Setup](#setup).

To be precise about what it is: **turn-level delegation**, not per-request model mixing. A routed turn runs in a child process with a short brief of your recent context; the child's answer lands in your transcript, tagged. Critical turns stay on Claude exactly as before.

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

> **Your hooks do not run in the gateway child.** The child runs `claude -p --bare`, and `--bare` skips every hook from your settings and plugins, so a hook that blocks `.env` does not guard it there, and what the child reads goes to the gateway model. The mod does not rely on hooks for this: every Claude child gets Claude Code permission deny rules, which `--bare` keeps, for `.env` and `.env.*` files, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*` and `secrets/` folders (Read rules also cover Grep and Glob). Add your own with `router.child.deny`, for example `["Read(**/credentials.json)"]`. Commands the child is not allowed to run still come to you as an Allow / Deny dialog. A Codex child is read-only but not covered by these rules: keep secrets out of a project you route to Codex.

**Updates.** Third-party marketplaces do not auto-update by default. Turn it on once in `/plugin` → Marketplaces → `mixture-of-models-claude-mod` → Enable auto-update, or update by hand with `claude plugin marketplace update mixture-of-models-claude-mod && claude plugin update mixture-of-models@mixture-of-models-claude-mod`. A new version takes effect when you restart Claude Code.

**Fastest start, on Palgu:** start `claude` and run `/palgu login`. It shows a link and a code; approve it in the browser (sign up there if you are new) and the mod saves its own Palgu key and routes from that moment, no copying keys. `/palgu status` says who is signed in and on which plan, `/palgu upgrade` opens plans and billing.

Or give the child a gateway yourself: [OpenRouter](#openrouter), a [LiteLLM](#litellm) proxy, or any Anthropic-compatible endpoint that serves your model ids (tested with [palgu](https://www.palgu.ai); z.ai or Moonshot's Anthropic endpoints work the same way), see [Setup](#setup). Start `claude`, run `/route`. Until a gateway is configured the mod is observe-only and changes nothing.

**Design rule: the main session is never touched.** It stays on your claude.ai subscription with no `ANTHROPIC_BASE_URL`. When a prompt is routed to GLM or Kimi, the mod answers that turn itself by running a **separate, headless `claude -p` child** whose environment alone points at the gateway (palgu). The child's output becomes the turn's answer in your transcript. Nothing about the main process, its model, its auth or its requests changes.

Per prompt the mod:

1. **Scores** it on two axes with one classifier call: a 1-10 blast radius and a task kind (`code | research | review | docs | data | multimodal`). The score decides whether Claude is mandatory; the kind picks which cheaper model gets the rest. A local Ollama model does it for free, `claude-haiku-4-5` on your plan is the fallback, then the last verdict seen. See [How it decides](#how-it-decides).
2. **Applies Maggy's pre-routing rules first**: `use claude` or `execute the plan` force `critical`; follow-ups after a child-answered turn return to the main session; `go ahead`, `yes`, or a prompt of six words or fewer while the main session is mid-task keeps it there; coding-level work stays on a mid-task main session.
3. **Delegates** a routed turn to the child: `claude -p --model glm-5.3` on the gateway, fed a brief over stdin with the last few exchanges of your session plus the task.
4. **Falls back** to the main model for that turn if the child fails, prints nothing, or its answer fails vetting (see [What a child may not do](#what-a-child-may-not-do)), and says so in the transcript.
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

**The kind picks the model.** Below `critical`, `routes.kinds` maps the task kind to a model: by default `research` and `review` go to Kimi (`kimi-k3.1-pro`) for its long context, `multimodal` stays on Claude, and everything else takes the tier's model (GLM). Add `"docs": "deepseek-v4-pro"` or `"data": "..."` to the matrix as your gateway allows.

**Models you can name.** Any model id your gateway serves works in `routes`, `routes.kinds` or a pin. The mod knows these Palgu gateway models, so `/route <prefix>` expands to them even when no route names them: `glm-5.3`, `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`, `deepseek-v4-pro`, `mercury-3` and `gemini-3.8-flash`. The band above the prompt has a button for each of these families. `kimi-k3.1-pro` replaces `kimi-k3`; an old `/route kimi-k3` pin expands to it. `mercury-3` is Inception's Mercury 3, a fast diffusion model with a 1M-token context and tool calling. It is an option, not a default: no route uses it until its speed and quality on routed turns have been measured. To try it for simple work, set `"routes": { "simple": "mercury-3" }`, or pin it for a few turns with `/route mercury`.

### Families: pick a member, or let the tier pick

Any route, kind route or pin may be `<family>/<member>` or `<family>/auto` instead of a model id. A bare `claude` still means "the main session", exactly as before, so old configs behave the same.

| Family | Members (alias = exact id) | `auto` by tier (default) | Runs on |
| :- | :- | :- | :- |
| `claude` | `fable` = `claude-fable-5-1`, `opus` = `claude-opus-5-5`, `sonnet` = `claude-sonnet-5-5`, `haiku` = `claude-haiku-5-5` | simple → `haiku`, coding → `sonnet`, critical → `opus`; `fable` only if you add `"criticalPlus": "fable"` (10/10 critical turns) | a headless `claude -p --model <id>` child on **your Claude login** (no gateway); a member that *is* the session model stays in the main session |
| `kimi` | `pro` = `kimi-k3.1-pro`, `highspeed` = `kimi-k3.1-pro-highspeed` | simple → `highspeed`, coding and critical → `pro` | the gateway child |
| `glm`, `deepseek`, `mercury` | from the gateway catalogue: `glm/5.3` = `glm-5.3`, `deepseek/v4-pro` = `deepseek-v4-pro`, `mercury/3` = `mercury-3` | the first member | the gateway child |
| `codex` | none by default: `codex/<any model id>` passes the id to Codex | none by default: Codex's own default model | a `codex exec` child, see [Codex](#codex-as-a-child) |

`auto` uses the same classifier, thresholds, borderline second sample and failure memory as the tiers, then looks up the tier in the family's `auto` map. It never leaves the family. A Claude-family tier (`"critical": "claude/opus"`) is mandatory Claude just like `"claude"`: `routes.kinds` does not override it. Override members or the tier map per family in `router.families`; a pinned `/route claude/auto` still classifies each prompt and picks the member from the score.

Why a child for a Claude member, not the session's own `/model`: the main session is never renamed or re-pointed ([ADR 0001](docs/adr/0001-child-process-delegation.md)), so a member other than the session model runs in a separate headless Claude Code started with Claude Code's own `--model <id>` flag. That child runs without `--bare` (which would force API-key auth), so it uses your claude.ai login and loads your hooks and plugins; the mod stays inactive inside it via `MAGGY_ROUTER_CHILD`. Its environment clears any inherited `ANTHROPIC_BASE_URL`; an `ANTHROPIC_API_KEY` exported in your shell still wins over the login, for the child as for the main session. See [ADR 0002](docs/adr/0002-model-families-and-codex-child.md).

### Codex as a child

`codex`, `codex/<model>` and `codex/auto` routes, and `/route codex`, answer the turn with the Codex CLI in non-interactive mode:

```
codex exec --json -C <session cwd> [-m <model>] [Palgu provider flags] --sandbox read-only -c approval_policy="never" -
```

with the same brief on stdin, the same `child.timeoutMs`, the same vetting, failure memory, route line and provenance tag as the Claude child. `router.codex.auth` picks the account:

- `"palgu"` (default): Codex talks to your gateway's Responses endpoint, `/v1/responses`. On OpenRouter and LiteLLM the provider is named `openrouter` or `litellm`, the base URL is `<gateway_url>/v1` (`https://openrouter.ai/api/v1`, `http://localhost:4000/v1`; a LiteLLM `/anthropic` URL drops that suffix first) and the key goes in `OPENROUTER_API_KEY` or `LITELLM_API_KEY`, following [OpenRouter's](https://openrouter.ai/docs/cookbook/coding-agents/codex-cli.md) and [LiteLLM's](https://docs.litellm.ai/docs/proxy/client_setup/codex_cli.md) Codex guides. Name the model on those gateways: OpenRouter needs a full slug (`/route codex/openai/gpt-5.6-terra`), LiteLLM one of your `model_name`s; Codex's own default model id is not one of them. On Palgu the mod adds an explicit `palgu` provider with `-c model_provider="palgu"`, `-c model_providers.palgu.base_url="<gateway>/v1"`, `-c model_providers.palgu.wire_api="responses"` and `-c model_providers.palgu.env_key="PALGU_API_KEY"`, as [Palgu's Codex docs](https://www.palgu.ai) describe (Codex ignores `OPENAI_BASE_URL` under a ChatGPT login, so the provider must be explicit). The base URL is your `gateway_url` with `/anthropic` replaced by `/v1`, or `router.codex.baseUrl`. Your gateway key goes only into the child's environment as `PALGU_API_KEY`, never on the command line, never printed. Needs the gateway URL and key, like the Claude gateway child.
- `"chatgpt"`: no provider flags and no key: Codex uses your own `codex login` and `~/.codex/config.toml`. The mod never reads or writes `~/.codex`.

#### Sandbox and approvals

`codex exec` cannot ask anyone anything: in non-interactive mode Codex runs with approval policy Never (Codex 0.163 rejects `approval_policy = "untrusted"` outright), so a command its sandbox allows runs without a question, and one it does not is refused. The sandbox is therefore the only gate, and the mod keeps it narrow:

- **`router.codex.sandbox`** is `"read-only"` by default: Codex can read the project and run commands that only read; it cannot edit files or use the network. That is narrower than the Claude child (`acceptEdits`), because `codex exec` has no way to let edits through while still gating commands. `-c approval_policy="never"` is passed explicitly, so a request to escalate out of the sandbox is refused, never run.
- **Opting out, at your own risk:** `"workspace-write"` lets Codex edit files in the project **and run any command there without asking you** (network stays off: `-c sandbox_workspace_write.network_access=false`). `"danger-full-access"` removes the sandbox entirely; only use it in a disposable, externally sandboxed environment. Any other value means read-only.
- **`router.codex.allowOutsideGit`** (default `false`) adds `--skip-git-repo-check`. Without it Codex refuses to start outside a git repository, the route line says `child answer discarded (outside a git repo; set router.codex.allowOutsideGit)`, and the main model answers.
- **`router.codex.args`** adds flags (for example `-c model_reasoning_effort="high"`), but never the sandbox or approval: `--sandbox`/`-s`, `--dangerously-bypass-approvals-and-sandbox`, `--approve-for-me`, `--full-auto`, `--add-dir`, `--skip-git-repo-check`, `-a`/`--ask-for-approval` and `-c approval_policy=…`/`sandbox_mode=…`/`sandbox_workspace_write.…`/`sandbox_permissions=…` are dropped, and the session log names what was ignored. `--ephemeral` there also disables the resume below.

**Refused commands.** `codex exec --json` does not report a command its sandbox blocked, nor an escalation it refused: neither appears as an event (checked against Codex 0.163.0). So the brief tells Codex to end its answer with `NEEDS-APPROVAL: <exact command>` for each command the sandbox blocked, and the mod also counts the `reject command` lines Codex writes to stderr for refused escalations. Then, as for the Claude child:

- With the read-only default, the mod asks you with the same dialog, naming the commands and what approving allows: *"Codex child on codex/default was refused by its read-only sandbox: touch made.txt. Allow and continue resumes it for this turn with permission to edit files in the project and run commands there (no network)."* On **Allow and continue** the same thread resumes (`codex exec -C <cwd> resume --json … -c sandbox_mode="workspace-write" -c approval_policy="never" -c sandbox_workspace_write.network_access=false <thread> -`) with a message naming the approved commands. That widens the sandbox for the rest of that turn, not just for the named commands, which is why the question says so. It is asked at most once per turn (`child.relayRounds: 0` turns it off).
- On **Deny**, when nobody can answer, or when your sandbox is already wider than read-only, nothing is widened and the refusal is never silent: the answer ends with a line naming the refused commands (*Codex's sandbox refused, and nothing ran: `touch made.txt`.*) and the route line shows `· sandbox read-only · refused: touch made.txt` (or `refused: 2 unnamed` for escalations Codex did not name).
- Because the refusal report comes from Codex's own answer, a model that ignores the instruction can still leave a refusal unnamed. The route line always shows the sandbox the turn ran in (`sandbox read-only`, or `sandbox workspace-write (approved)`), so a turn that could not write is visible as such.

If `codex` is not on `PATH` the mod says `codex is not installed: npm install -g @openai/codex (or brew install --cask codex) …`, the route line says `child answer discarded (codex not installed)`, and the main model answers.

**Borderline scores get a second opinion.** A score on the coding cut-off or one above it is sampled a second time and the higher wins, so a 7-or-8 debugging task doesn't flip tiers on classifier noise.

**It remembers failures.** Every two child failures for a kind lower that kind's coding cut-off by one (never below `simple + 1`), so work the cheap model keeps failing at drifts back to Claude. `/route reset` clears the memory.

**It protects the thread of work.** A child has no memory beyond its brief, so the mod never lets a follow-up land on one. After a child-answered turn, `continue`, `yes` or any prompt of six words or fewer goes back to the main session, which holds the whole transcript. And while the main session is mid-task (its last answer used tools), coding-level work stays with it (`via mid-task guard` on the route line); only lookups and new, self-contained tasks go out. Without these rules a session that had routed a task would restart it on every "continue".

**Some turns never leave the main session**, whatever the score or `/route` pin, because a child cannot see the conversation, teammates, background tasks or the session's tools (`via notification`, `via session command`, `via security or verdict` on the route line):

- notifications: `<teammate-message …>`, `idle_notification` JSON, `<task-notification>`, `[SYSTEM NOTIFICATION …]`;
- short operator commands about session state or tools (12 words or fewer): `approve git pull --ff-only`, `continue`, `resume`, `merge it`, `check the sub agents`, `what's the status`, anything naming a PR, branch, CI, workflow or sub-agent;
- security and verdict turns (`security`, `vulnerability`, `CVE`, `verdict`, …).

### What a child may not do

Every brief opens with a preamble: the child has no access to the main session, must never invent statuses, IDs, PR numbers, run results or file changes, must never ask you to approve or run anything, and replies `HANDBACK` when the task needs the session's state or tools. The mod then vets the answer and discards it, letting the main model do the turn itself, when it:

| Answer | Example |
| :- | :- |
| starts with `HANDBACK` | `HANDBACK` / `needs the PR list` |
| says it is blocked or asks you to act | "blocked by the permission system", "you must approve it in the UI", "run `gh pr create` yourself" |
| claims an action or session fact with no tool call (`num_turns` 1) | "I added X", "PR #812 is open", "14 commits behind", "no build runs exist" |
| is mostly narration of intent | "I'll read the config. Then I will update the router." |
| repeats an answer already given | the same verdict re-posted on every idle notification |

A discarded answer counts as a child failure for that kind and shows as `child answer discarded (<reason>), main model answered` on the route line. The main model is never asked to relay a child's text: the mod answers the turn with a vetted child answer, or leaves the turn to the main model.

Every route line and the band show the score and the kind, so when a decision looks wrong you can see the numbers behind it.

## What you see

Claude and the gateway are both visible, all the time:

| Surface | Main-session turn | Routed turn |
| :- | :- | :- |
| Band above the prompt | `mixture-of-models · auto · last: claude-opus-5 (critical via rule)  0: help  1: auto  2: glm  3: kimi  …  7: claude  8: off` | `… · running glm-5.3 in a child…` while it runs |
| Spinner | `Thinking…` | `Thinking · via glm-5.3 (child)…` |
| Question dialog | Claude's own questions | `Child on glm-5.3 wants to run: Bash(git pull --ff-only)` with Allow and continue / Deny |
| Reply in the transcript | unchanged (or tagged `⇢ claude-opus-5 · main session` with `ui.tags: "all"`) | a dim `⇢ glm-5.3 · child on gateway` line above the reply, kept in scrollback (`· child on your Claude subscription` for a Claude member, `· Codex child` for Codex) |
| Line under the answer | `route: claude-opus-5 · critical 9/10 via claude-haiku-4-5 · 23.1k in / 0.9k out · cache 91% · main session · today: claude-opus-5 ×3, glm-5.3 ×5` | `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39 · today: …` |
| `/route` | `mixture-of-models live · mode auto · current route: … · today: … · saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices` | same |
| `/palgu login` | `Open https://www.palgu.ai/connect?code=WDJB-MJHT and approve code WDJB-MJHT …`, then a toast `Signed in to Palgu as you@acme.com (Acme, plan starter). Routed turns now run on Palgu.` | same |
| `/route stats` | A pane, "Mixture of models", with four tabs on hotkeys 1-4: **models** (bars per model, share of turns, the headline "N of M turns off Claude" and, in green, what routing saved), **kinds** (each kind and which models took it), **scores** (a 1-10 histogram coloured by tier, cut-offs marked), **recent** (the last decisions with score, kind, model and child time). Esc closes it. | same |

### How much it saves

Every routed turn is priced twice: at your session's Claude model (what the same tokens would have cost there) and at what it actually cost. On Palgu, the actual cost comes from Palgu's own `/v1/pricing/quote`, the formula it bills by; on another gateway, from `router.prices`; a `claude/<member>` child is priced at that member's Claude rate. Turns that stay in the main session count toward the all-Claude total too, so the percentage is the share of your whole Claude bill that routing took away, not just of the routed turns.

- Under each routed answer: `· saved ~$0.39`.
- `/route status`: `saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`, a running total across sessions.
- `/route stats`: the same total, in green, on the models tab.

It is an estimate, and it says so. Claude prices are the API list prices (Opus 5.5 $4 / $20 per million input / output tokens, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50, Fable 5.1 $10 / $50; cache reads and 5-minute and 1-hour cache writes at their own rates), so on a claude.ai subscription it is the API-equivalent saving, not money back. It assumes the routed turn would have used the same number of tokens on Claude. A routed turn the mod cannot price (a gateway with no `router.prices` entry for that model, or a Codex child) claims no saving; `/route status` counts it as unpriced.

The band's buttons have digit hotkeys: with an empty prompt, type `3` and pause to pin Kimi, `1` to go back to auto, `0` for help: a pane that says what the mod does, where it stands (mode, gateway, savings), what every button and command does, and how to connect Palgu, OpenRouter or LiteLLM. `/route help` opens it too. Turn the band off with `"ui": { "band": false }`.

## Requirements

- Claude Code **v2.1.287 or later** (`claude --version`). Mods do not load on older builds; `claude update`.
- A gateway the child can use: Palgu's Anthropic endpoint, OpenRouter, a LiteLLM proxy, or any Anthropic-compatible endpoint that serves the model ids in `routes`, with its key.
- Optional: Ollama with a small model for free classification (`ollama pull qwen2.5-coder:3b`). Without it the classifier falls back to Haiku on your plan.

## Setup

See [GETTING_STARTED.md](GETTING_STARTED.md) for the full walkthrough, or `./install.sh`.

1. Give the child its gateway. On Palgu, `/palgu login` does this whole step: it uses Palgu's device sign-in (the same one `srooterctl` uses), Palgu mints a key for this computer that you can revoke on its Devices page, and the mod saves the URL and the key with `claude plugin configure --values-stdin`. Otherwise the plugin asks for two values, and the key is masked and kept in Claude Code's secure storage, never in a settings file:

   ```
   /plugin configure mixture-of-models@mixture-of-models-claude-mod
   ```

   or from the shell at install time: `claude plugin install mixture-of-models@mixture-of-models-claude-mod --config gateway_url=https://api.palgu.ai/anthropic --config gateway_key=srt_…`, or afterwards: `echo '{"gateway_url":"https://api.palgu.ai/anthropic","gateway_key":"srt_…"}' | claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`

2. Optionally tune routes, thresholds and the child in `~/.claude/model-config.json`; `config.example.json` in the repo is a complete starting point (also shown below).

3. Start `claude` and run `/route`.

Until a gateway URL and key are present the mod is **observe-only**: it classifies and `/route` shows what it would do, but no child starts.

The third option, `gateway_provider`, says what kind of gateway it is: `auto` (the default, also when empty) detects Palgu (`*.palgu.ai`) and OpenRouter (`openrouter.ai`) from the URL and treats any other host as a generic Anthropic-compatible gateway, exactly as before 0.16; `palgu`, `openrouter`, `litellm` or `anthropic-compatible` name it outright. The provider decides how the child sends the key and which model ids the default routes and the band use:

| Provider | Child auth | Default model ids | `x-srooter-*` headers |
| :- | :- | :- | :- |
| `palgu` | `ANTHROPIC_API_KEY` (`x-api-key`) | Palgu's: `glm-5.3`, `kimi-k3.1-pro`, … | yes |
| `openrouter` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | OpenRouter slugs behind the families: `glm/5.3` → `z-ai/glm-5.3`, … | no |
| `litellm` | `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`) | Palgu's names; your proxy's `model_name`s decide | no |
| `anthropic-compatible` | `ANTHROPIC_API_KEY` (`x-api-key`) | Palgu's | yes |

Whichever variable carries the key, the child's environment sets the other one to empty, because the child inherits your shell and Claude Code sends both when both are set: an `ANTHROPIC_API_KEY` exported in your shell never rides along to OpenRouter, and a stray `ANTHROPIC_AUTH_TOKEN` never reaches Palgu. The key is never on a command line.

### OpenRouter

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. `/plugin configure mixture-of-models@mixture-of-models-claude-mod` with

   | Option | Value |
   | :- | :- |
   | `gateway_url` | `https://openrouter.ai/api` |
   | `gateway_key` | your OpenRouter key (`sk-or-…`) |
   | `gateway_provider` | `auto` (or `openrouter`) |

   or from the shell: `echo '{"gateway_url":"https://openrouter.ai/api","gateway_key":"sk-or-…","gateway_provider":"openrouter"}' | claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`
3. Start `claude`. Simple and coding turns run on `z-ai/glm-5.3`, research and review on `moonshotai/kimi-k3.1-pro`; the band offers `glm`, `kimi`, `deepseek` (`deepseek/deepseek-v4-pro`), `mercury` (`inception/mercury-3`) and `gemini` (`google/gemini-3.8-flash`). These are the slugs [OpenRouter's model list](https://openrouter.ai/models) served on 2026-10-29. OpenRouter has no Kimi highspeed variant, so `kimi/auto` is `pro` for every tier.

Routes on OpenRouter name family members (`glm/5.3`), because an OpenRouter slug has a `/` in it; a slug that a family lists (`z-ai/glm-5.3`) works too. For another OpenRouter model, add it to a family and route to it:

```json
{ "router": {
    "families": { "glm": { "members": { "4.6": "z-ai/glm-4.6" } } },
    "routes":   { "simple": "glm/4.6" } } }
```

As [OpenRouter's Claude Code guide](https://openrouter.ai/docs/guides/guides/claude-code-integration) says, Claude Code is only guaranteed to work with Anthropic's own models; a routed turn whose model cannot handle Claude Code's tools fails, and the main model answers it.

### LiteLLM

A [LiteLLM proxy](https://docs.litellm.ai/docs/tutorials/claude_responses_api) serves its Anthropic-compatible `/v1/messages` on its own address. It runs on your host, so it is never detected: name it.

| Option | Value |
| :- | :- |
| `gateway_url` | your proxy, for example `http://localhost:4000` (or its `/anthropic` pass-through, `http://localhost:4000/anthropic`) |
| `gateway_key` | the proxy's master key or a virtual key (`sk-…`) |
| `gateway_provider` | `litellm` |

The child sends the key as `Authorization: Bearer`. Model names are whatever `model_name`s your proxy's `config.yaml` defines. The defaults are Palgu's names (`glm-5.3`, `kimi-k3.1-pro`, …): name your proxy's models the same, or point the routes at yours:

```json
{ "router": {
    "routes":   { "simple": "my-glm", "coding": "my-glm", "kinds": { "research": "my-kimi", "review": "my-kimi" } },
    "families": { "glm": { "members": { "mine": "my-glm" } } } } }
```

A virtual key reaches only the models it is allowed; a 401 or an unknown model makes the child fail, and the main model answers.

## What this plugin runs, reads, sends and stores

The directory's security scan compares this section with the code. Everything the mod does outside its own code is listed here. In one breath:

- Only when you run `/palgu`, it **fetches** `https://api.palgu.ai` (`/auth/device/code`, `/auth/token`, `/me`) and **runs** `claude plugin configure … --values-stdin` once to save the key Palgu minted (see the tables below).
- It **fetches** `http://localhost:11434/api/chat` with `$.http.fetch`, sending the prompt text and the scoring rubric to a local Ollama, to score the prompt. No credentials, nothing leaves the machine.
- It **calls** `$.model.classify`, which sends the same prompt text and rubric to Anthropic through Claude Code's own API client on your own account, when Ollama does not answer.
- It **runs** two programs with `$.process.run`, for routed turns only: `claude` (Claude Code itself, headless), either with `ANTHROPIC_BASE_URL` and the key you configured (in `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN` for OpenRouter and LiteLLM, the other one set empty) and, for Palgu and generic gateways, `ANTHROPIC_CUSTOM_HEADERS` set to identify it (see [Headers the child sends](#headers-the-child-sends)), or, for a `claude/<member>` route, on your own Claude login with `ANTHROPIC_BASE_URL` cleared; and, only for a `codex` route, `codex exec` (the Codex CLI), with your gateway key in `PALGU_API_KEY` (`OPENROUTER_API_KEY` on OpenRouter, `LITELLM_API_KEY` on LiteLLM) or on your own Codex login. Each child **sends** your prompt and a short brief of recent session text to its endpoint.
- It **reads** `~/.claude/model-config.json`, `HOME`, `MAGGY_ROUTER_CHILD` and `ANTHROPIC_CUSTOM_HEADERS`, and **stores** the route pin, per-day counts, the last verdict, per-kind failure counts and a log of the last 200 decisions (day, model, kind, tier, score, classifier source, child time and exit code; never prompt text) in the plugin store.

Full detail follows; a privacy policy is at [PRIVACY.md](PRIVACY.md).

### Hooks

The hooks module `hooks/register.js` registers nine hooks. What each one does with the events and calls it sees:

| Hook | What it does |
| :- | :- |
| `session.start` | Reads `~/.claude/model-config.json`, takes the gateway URL and key from the plugin's options, remembers the session's model, loads the `/route` pin from the plugin store, and registers the `/route` command. Does nothing when `MAGGY_ROUTER_CHILD` is set, so the mod stays inactive inside its own child. |
| `prompt.submit` | Passes every prompt through unchanged. On the side it decides the route: pre-rules first, then a 1-10 blast score from the classifier (see Network), then the thresholds. Never drops, rewrites or adds to a prompt. Fails open: if scoring throws, the prompt still goes through. |
| `turn.start` | Clears the previous turn's child result. |
| `turn.step` | For a routed turn, instead of letting the main session call its model, runs the child process (Claude Code on the gateway or on your Claude login, or Codex) described under Programs and yields the child's text as the turn's answer with `stopReason: end_turn`. If the child's permission system refused a command, the hook asks you with `$.ui.ask` (the dialog Claude uses for questions), naming the exact commands; on "Allow and continue" it resumes the same child with those commands allowed, up to `relayRounds` times; on "Deny", or when nobody can answer, the child's own explanation is the answer. A Codex child is asked the same way about the commands it names as refused, once per turn; on "Allow and continue" the same Codex thread resumes with edits in the project allowed (see [Sandbox and approvals](#sandbox-and-approvals)). For every other turn, and for subagents, it calls `next(e)` unchanged. If the child fails or prints nothing it calls `next(e)`, so the main model answers. |
| `turn.complete` | Appends a line under the answer with the route, score, cost and where it ran, and what a routed turn saved; updates per-day counts and the savings totals in the plugin store. On Palgu it asks `/v1/pricing/quote` what the routed turn cost. |
| `ui.render` for `AbovePrompt` | Draws the band: the current mode and last decision, plus buttons that change the `/route` pin. Keeps whatever other mods draw there. |
| `ui.render` for `AssistantMessage` | Puts a dim provenance line above a reply the child produced. Other replies are passed through. |
| `ui.render` for `Spinner` | Adds `via <model> (child)…` after the spinner's word during a routed turn. |
| `ui.render` for `Pane` | Draws the "Mixture of models" stats pane (id `routing-stats`) from the decision log when `/route stats` opened it. Other panes are passed through. |
| `command.run` for `/palgu` | `login` starts Palgu's device sign-in and answers with the link and code at once; a `$.clock` timer then polls `/auth/token` every `interval` seconds (5 more after each `slow_down`) until you approve, deny or the code expires, then saves the key and switches the child to Palgu for this session. `status` asks Palgu's `/me` whose the key is; `upgrade` prints the billing link. |
| `command.run` for `/route` | Shows the route state and the families (`/route`, `/route status`) or sets the pin (`auto`, `off`, a tier, a model, `<family>/<member>`, `<family>/auto` or `codex`). An unknown family or member is refused with the list of valid ones. |

The mod never handles `tool.call` or `tool.check`, so it never approves, denies or changes a tool call, and it never changes permission prompts.

### Network: the hosts this plugin contacts

The mod itself makes exactly one kind of network call, and the child process it starts makes another:

| Who | Call | Address | What is sent | Why |
| :- | :- | :- | :- | :- |
| The mod, in `/palgu login` | `$.http.fetch` | `https://api.palgu.ai/auth/device/code`, then `/auth/token`, fixed in the code | The client id `mixture-of-models`, the device name (`Claude Code on <HOSTNAME>`), the mod's version and a random install id it keeps in its store; then the device code Palgu gave it | Sign-in. Palgu answers with a key for this computer. |
| The mod, in `turn.complete` after a routed turn on Palgu | `$.http.fetch` | `https://api.palgu.ai/v1/pricing/quote`, fixed in the code | The routed model id and the child's four token counts (input, output, cache read, cache write), and the gateway key as a Bearer header; only when your `gateway_url` is on `https://api.palgu.ai` and `router.prices` has no entry for that model | Prices the turn for the savings estimate. No prompt or answer text. |
| The mod, in `/palgu status` | `$.http.fetch` | `https://api.palgu.ai/me`, fixed in the code | The gateway key, as a Bearer header, only when your `gateway_url` is on `https://api.palgu.ai` (another gateway's key is never sent) | Says whose key it is and the org's plan. |
| The mod, in `prompt.submit` | `$.http.fetch` | `http://localhost:11434/api/chat`, fixed in the code | The scoring rubric and the prompt text, as an Ollama chat request, no credentials | Free local classification. Skipped when nothing answers there. |
| The mod, in `prompt.submit` | `$.model.classify` | Anthropic's API through Claude Code's own client and your own plan | The scoring rubric and the prompt text | Classification when Ollama is unavailable. Model: the `classifier` alias, `claude-haiku-4-5` by default. |
| The child process (Claude Code itself), started in `turn.step` | Claude Code's normal API client | The `gateway_url` you set in the plugin's options (for example `https://api.palgu.ai/anthropic`, `https://openrouter.ai/api` or your LiteLLM proxy), with `gateway_key` as its `x-api-key` (Palgu, generic) or `Authorization: Bearer` (OpenRouter, LiteLLM) | Your prompt plus a brief of the last `contextMessages` exchanges of the session (text only, truncated), then whatever the child's own agent loop sends while it works | That is the point of the plugin: the turn runs on the gateway's model instead of the main session's. |
| A Claude-member child (`claude/<member>` routes), started in `turn.step` | Claude Code's normal API client | Anthropic, on your own claude.ai login, the same as your main session | The same brief, then the child's own agent loop | Runs the turn on another Claude model without re-pointing the main session. |
| The Codex child (`codex` routes), started in `turn.step` | The Codex CLI's own client | With `codex.auth: "palgu"`: your gateway's `/v1` (for example `https://api.palgu.ai/v1/responses`, `https://openrouter.ai/api/v1/responses` or `<your LiteLLM proxy>/v1/responses`) with `gateway_key`; with `"chatgpt"`: OpenAI, on your own Codex login | The same brief, then Codex's own agent loop | Runs the turn on Codex. |

The mod contacts no other host. The gateway is whatever you configure; nothing is sent to a fixed third party.

### Programs this plugin runs

**Which programs:** two, `claude` (Claude Code itself in headless mode, and once after `/palgu login` as `claude plugin configure mixture-of-models@mixture-of-models-claude-mod --values-stdin`, with the gateway URL and key on stdin, to save them) and `codex` (the Codex CLI, `codex exec`, only for `codex` routes). The plugin runs no shell, no script bundled in the plugin folder, no package launcher, and no other executable.

**Why:** a mod can rename the model on a request but cannot change the endpoint or credentials of the session it runs in. The only way to run a turn on a different endpoint with Claude Code's own tools, while leaving the main session's endpoint and credentials untouched, is a second Claude Code process whose environment points at the gateway. The child exists for that reason alone, and only for turns the score routes away from the main session. The same reasoning covers a different Claude model (the main session is never renamed, so another member runs in its own process) and Codex (a different agent CLI, which only runs as its own process).

**How:** two `$.process.run` calls, in `turn.step`, each with its program name as fixed text at the call: `claude` and `codex`. The `claude` arguments for a gateway route:

```
claude -p --model <routed model id> --output-format json --max-turns <child.maxTurns> --add-dir <session cwd> --bare --permission-mode acceptEdits
```

For a `claude/<member>` route the same program runs with `--model <member id>` and `child.subscriptionArgs` (`--permission-mode acceptEdits`) in place of `child.args`, so without `--bare`, and its environment is `MAGGY_ROUTER_CHILD=1` plus `ANTHROPIC_BASE_URL` set empty, so it runs on your Claude login.

For a `codex` route the program is `codex`, with the arguments shown under [Codex as a child](#codex-as-a-child) (and, only after you approve a refused command, `exec -C <cwd> resume … <thread> -` as described there), the brief on stdin, the environment `MAGGY_ROUTER_CHILD=1` plus, on the gateway path only, the key in `PALGU_API_KEY` (`OPENROUTER_API_KEY` on OpenRouter, `LITELLM_API_KEY` on LiteLLM), and the same `child.timeoutMs`.

For the gateway and Claude-member children, and only after you approve a relayed command (see below), the same program runs again with `--resume <that child's session id> --allowedTools <the approved patterns>` appended, so the same child continues. `--bare` keeps your hooks, plugins and keychain out of the child. `child.args` replaces the last three flags if you set it. The gateway child's environment adds `ANTHROPIC_BASE_URL`, the key in `ANTHROPIC_API_KEY` with `ANTHROPIC_AUTH_TOKEN` empty (Palgu, generic) or in `ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_API_KEY` empty (OpenRouter, LiteLLM), `ANTHROPIC_CUSTOM_HEADERS` (below) and `MAGGY_ROUTER_CHILD=1`; the Claude-member and Codex children get no identifying headers. The brief is written to its stdin. It runs in the session's working directory with Claude Code's tools under that permission mode, so it can read and edit files there and run commands the mode allows; those commands are the child's own agent decisions, governed by Claude Code's permission system, not commands this plugin issues. It is killed at `child.timeoutMs`.

### Headers the child sends

Every request the child makes to a Palgu or generic gateway carries two headers, so Palgu's dashboard can show its traffic as Mixture-of-Models, per project. On OpenRouter and LiteLLM, which do not read them, they are left out and only your own `ANTHROPIC_CUSTOM_HEADERS` are sent:

```
x-srooter-client: mixture-of-models/0.16.0
x-srooter-project: <the session folder's name>
```

The project is the last segment of the session's working directory, slugged the way the gateway's project detection does it: anything outside `[A-Za-z0-9._-]` becomes `-`, leading and trailing `-._` are dropped, at most 64 characters, lowercase (`/Users/me/My App` → `my-app`). When nothing usable is left, the header is left out. Neither header holds a path, prompt text or anything else.

They go in the child's `ANTHROPIC_CUSTOM_HEADERS` (Claude Code's newline-separated `Name: value` list), set in the same place as `ANTHROPIC_BASE_URL`: no gateway configured, no headers, and the child talks only to that gateway. If you already set `ANTHROPIC_CUSTOM_HEADERS`, your lines come first and are kept; a `x-srooter-client` or `x-srooter-project` of your own wins over the mod's. The main session's requests are unchanged.

### Files and environment it reads

- `~/.claude/model-config.json`, through `$.fs.read`, for routes, thresholds, the classifier alias and child settings. It holds no credentials. Missing or invalid, the defaults apply.
- The environment variables `HOME`, `MAGGY_ROUTER_CHILD` and `ANTHROPIC_CUSTOM_HEADERS` (to keep your own custom headers in the child), through `$.env.get`.
- Nothing else. The gateway key is never read from a file or from the environment; it comes only from the plugin's `gateway_key` option, which Claude Code keeps in secure storage.

### What it stores

In the plugin's own store (`$.store`, under `~/.claude/plugins/store/`): a random install id for Palgu sign-in (`palgu-install-id`, so Palgu sees one device across sign-ins), the `/route` pin, per-day counts per model, the last verdict, per-kind failure counts, and a log of the last 200 decisions (day, model, kind, tier, score, classifier source, child duration and exit code). No prompt text, no answers, no credentials.

### What it never does

It never writes to settings files, to `model-config.json` or to `~/.codex`, never changes the main session's model, endpoint or credentials, never handles tool calls, and never sends data anywhere other than the two classifier destinations above and the gateway you configured.

## Configuration

The mod reads Maggy's single source of truth, `~/.claude/model-config.json`, and adds an optional `router` block. It never writes to that file.

```json
{
  "primary": "glm",
  "router": {
    "provider":   "auto",
    "routes":     { "simple": "glm-5.3", "coding": "glm-5.3", "critical": "claude",
                    "kinds": { "research": "kimi-k3.1-pro", "review": "kimi-k3.1-pro", "multimodal": "claude" } },
    "thresholds": { "simple": 3, "coding": 7 },
    "ollama":     { "model": "qwen2.5-coder:3b" },
    "classifier": "claude-haiku-4-5",
    "child": {
      "baseUrl":  "https://api.palgu.ai/anthropic",
      "args":     ["--bare", "--permission-mode", "acceptEdits"],
      "subscriptionArgs": ["--permission-mode", "acceptEdits"],
      "deny":     [],
      "maxTurns": 25,
      "timeoutMs": 600000,
      "contextMessages": 12,
      "relayRounds": 2
    },
    "families": {
      "claude": { "members": { "fable": "claude-fable-5-1", "opus": "claude-opus-5-5", "sonnet": "claude-sonnet-5-5", "haiku": "claude-haiku-5-5" },
                  "auto":    { "simple": "haiku", "coding": "sonnet", "critical": "opus" } },
      "kimi":   { "members": { "pro": "kimi-k3.1-pro", "highspeed": "kimi-k3.1-pro-highspeed" },
                  "auto":    { "simple": "highspeed", "coding": "pro", "critical": "pro" } }
    },
    "codex":   { "auth": "palgu", "baseUrl": "", "sandbox": "read-only", "allowOutsideGit": false, "args": [] },
    "ui":      { "band": true, "tags": "routed" },
    "summary": true
  }
}
```

A config that puts every tier on a Claude member, with Fable for the hardest turns and Codex for reviews:

```json
{ "router": {
    "routes":   { "simple": "claude/auto", "coding": "claude/auto", "critical": "claude/auto", "kinds": { "review": "codex" } },
    "families": { "claude": { "auto": { "criticalPlus": "fable" } } } } }
```

- `routes`: tier → model id the gateway serves, plus `routes.kinds`: kind → model for the non-critical tiers. `"claude"` means the main session.
- `primary` (Maggy's followed model, set with `/model-config`): `glm`, `kimi` or `deepseek` makes the `coding` tier follow it unless `routes.coding` is set. `primary: claude` changes nothing: `critical` is already on Claude, and `coding` stays cheap unless you set `routes.coding` to `"claude"`.
- `thresholds`: the blast-score cut-offs, `{ "simple": 3, "coding": 7 }` by default.
- `classifier`: the Claude model used when Ollama is unreachable. Undated aliases only (`claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5`).
- `provider`: the gateway provider when the plugin's `gateway_provider` option is unset or `auto`: `palgu`, `openrouter`, `litellm` or `anthropic-compatible`. Unset, it is detected from the gateway URL (see [Setup](#setup)). It picks the default `routes`, `families`, the band's buttons and the child's auth; anything you set in `routes` or `families` still wins.
- `child.baseUrl`: fallback for the gateway URL when the plugin's `gateway_url` option is unset. The key has no fallback; it comes only from the `gateway_key` option.
- `child.auth`: `x-api-key` (`ANTHROPIC_API_KEY`) or `bearer` (`ANTHROPIC_AUTH_TOKEN`), set from the provider; set it yourself for a generic gateway that wants a bearer token. `child.identify`: send the `x-srooter-*` headers (on for Palgu and generic gateways).
- `child.args`: extra flags. The default is `--bare` (no inherited hooks or plugins, API-key auth only, so the child can never fall back to your subscription) plus `acceptEdits` so it can edit files without prompting. The mod always adds `--add-dir <cwd>`, which keeps the project's `CLAUDE.md` in reach under `--bare`. Add `--dangerously-skip-permissions` only if you want the child to run commands unattended; drop `--bare` if you want your hooks and plugins inside the child.
- `child.maxTurns`, `timeoutMs`: the child's agentic budget. `timeoutMs` caps at ten minutes, the limit of `$.process.run`.
- `child.contextMessages`: how many recent exchanges go into the brief.
- `child.relayRounds`: how many times one routed turn may pause to ask you about commands the child was refused (default 2).
- `child.deny`: extra Claude Code permission deny rules for every Claude child, passed with `--disallowedTools` after `child.args`. They add to the built-in list (`.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `secrets/**`), which nothing removes, because `--bare` skips the hooks that would otherwise guard those files.
- `child.subscriptionArgs`: the flags for a `claude/<member>` child, in place of `child.args`. No `--bare` by default, because `--bare` allows only API-key auth and the point is your Claude login.
- `families`: per family, `members` (alias → exact model id) and `auto` (tier → member alias, plus optional `criticalPlus` for 10/10 critical turns). Merged over the defaults per family; a new family name adds a gateway family.
- `codex.auth`: `palgu` (default; your configured gateway's `/v1/responses` with your gateway key, whichever provider it is) or `chatgpt` (your own Codex login). `codex.baseUrl`: the Responses base URL if it is not the derived one (Palgu: `/anthropic` → `/v1`; OpenRouter and LiteLLM: `<gateway_url>/v1`). `codex.sandbox`: `read-only` (default), `workspace-write` or `danger-full-access`, see [Sandbox and approvals](#sandbox-and-approvals). `codex.allowOutsideGit`: add `--skip-git-repo-check` (default `false`). `codex.args`: extra flags; sandbox and approval flags in it are ignored.
- `prices`: $ per million tokens for gateway models, for the [savings estimate](#how-much-it-saves), for example `{ "glm-5.3": { "input": 0.6, "output": 2.2 } }` (optional `cacheRead`, default a tenth of input, and `cacheWrite`). An entry here wins over Palgu's own quote. A model with no price on a gateway that is not Palgu is counted as unpriced.
- `ui.band`: draw the band above the prompt (default `true`). `ui.tags`: which replies get the provenance tag, `routed` (default), `all` or `off`.

## Commands

| Command | Effect |
| :- | :- |
| `/palgu login` | Sign up or sign in to Palgu from the terminal: approve a code in the browser, and the mod saves its Palgu key and routes at once |
| `/palgu status` | Who the key belongs to and the org's plan |
| `/palgu upgrade` | The Palgu plans and billing page |
| `/route help` (or `0` on the band) | What the mod does, where it stands now, every button and command, and how to connect a provider |
| `/route`, `/route status` | Live or observe-only, mode, current decision (with family and member), today's counts, the families and their members |
| `/route auto` | Classify every prompt (default) |
| `/route off` | Never start a child |
| `/route simple\|coding\|critical` | Pin a tier |
| `/route reset` | Clear the per-kind failure memory |
| `/route stats` | Open the stats pane: models, kinds, scores, recent |
| `/route glm`, `/route kimi`, `/route kimi-k3.1-pro`, `/route mercury`, `/route claude` | Pin a model (a prefix expands to the configured model, then to a known gateway model) |
| `/route claude/sonnet`, `/route kimi/highspeed`, `/route codex/gpt-5.6-terra` | Pin a family member (`claude/sonnet` runs on your Claude login) |
| `/route claude/auto`, `/route kimi/auto`, `/route codex/auto` | Pin a family; each prompt is still scored and the tier picks the member |
| `/route codex` | Pin Codex on its default model |

`/status` is Claude Code's own command and a mod cannot add to it; `/route status` is the mod's equivalent, and the route line under every answer names the family and member (`route: claude-sonnet-5-5 (claude/auto → sonnet) · coding 5/10 code via ollama · child 9s`).

Pins persist across sessions in the plugin's store.

## What the child can and cannot do

- It has Claude Code's tools and runs in the session's working directory, so it can read, edit and run things. Its tool calls are not shown in the main transcript, only its final text.
- When it needs a command its permission mode doesn't allow (`git pull`, `npm install`, a deploy), it cannot ask you itself. The mod relays the request: you get Claude Code's question dialog naming the exact command, and "Allow and continue" resumes the same child with only that command allowed. Read-only commands such as `git status` or `git log` already run without asking.
- It does not share the main session's memory. The brief carries the last `contextMessages` exchanges (12 by default, each truncated to 1,200 characters) and the task. This is why follow-ups never go to a child: see [How it decides](#how-it-decides).
- It runs `--bare` by default, so your hooks and plugins stay out of it, including any hook that guards secrets. It cannot read `.env` files, keys or `secrets/` folders: the mod passes permission deny rules for them (`child.deny` adds more), and those are enforced by Claude Code itself, not by a hook. The mod also detects the `MAGGY_ROUTER_CHILD` marker and does nothing inside a child.
- The tag and the route line name the model the mod **asked for**. A gateway that routes by intent, as palgu does, may answer with another model; Claude Code's `-p` output does not expose which, so the mod cannot show it.
- Output arrives when the child finishes; this version uses `$.process.run`, so a routed answer is not streamed token by token.

## Changelog

Every release has a dated section in [CHANGELOG.md](CHANGELOG.md), written in the same commit as the change. CI fails if the version in `plugin.json` has no entry (`npm run changelog`).

## Tests

```bash
npm test                           # pure-function tests under Node, no Claude Code needed
claude plugin validate --strict .  # manifest + static analysis of the hooks module
claude plugin test                 # needs v2.1.287+; fires events through the hooks with no session or network
```

`tests/classify`, `config`, `providers`, `routing`, `families`, `codex`, `stats`, `child` and `ui` cover the pure logic in `hooks/lib/`. `tests/mod.test.ts` drives the hooks end to end: a simple prompt is answered by a child with the gateway in its environment and the brief on stdin, a critical prompt never starts one, a failed child falls back to the main model, a missing key means observe-only, a child session disables the mod, and `/route off` and `/route kimi` behave.

## Layout

```
mixture-of-models-claude-mod/
├── .claude-plugin/
│   ├── plugin.json         # the plugin manifest
│   └── marketplace.json    # lets `claude plugin install` find it in this repo
├── docs/adr/               # architecture decisions (0001: child-process delegation, 0002: families and Codex, 0003: gateway providers)
├── scripts/test-pure.mjs   # runs the pure tests under Node
├── hooks/
│   ├── hooks.json          # points at register.js
│   ├── register.js         # the 10 hooks; the only file that touches the mods API ($)
│   └── lib/                # pure, unit-tested
│       ├── config.js       # defaults and the model-config.json overlay
│       ├── providers.js    # Palgu, OpenRouter, LiteLLM, generic: detection, child auth, catalogues
│       ├── classify.js     # Maggy's pre-routing rules, classifier prompt, Ollama wire format
│       ├── routing.js      # tier → model, /route grammar, summary line
│       ├── families.js     # <family>/<member>, <family>/auto, which runner serves a route
│       ├── codex.js        # codex exec argv, env, readiness, JSONL output
│       ├── child.js        # child argv, scoped env and identifying headers, readiness, env-file parsing, the brief and its preamble
│       ├── version.js      # the mod's version, for x-srooter-client
│       ├── vet.js          # discards handbacks, requests that you act, unverified claims, narration, repeats
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
