# Guidelines: getting the most out of Mixture of Models

How to work with Mixture of Models day to day, in each coding agent. Setting it up is in [INSTALL.md](INSTALL.md); this file assumes it is installed and you are signed in to Palgu.

Mixture of Models does three things, and each agent gets as many of them as its plugin system allows:

| | What you get | Where |
| :- | :- | :- |
| **Routing** | Cheap models answer the work that does not need an expensive one | Claude Code, OpenCode, Codex, Aider/Continue/Goose route every turn; Cursor, Antigravity and Copilot route the subtasks the agent hands to `palgu_delegate` |
| **Palgu memory** | The project's recorded intent, docs and code symbols come back to the model when they matter | Recalled into each prompt: Claude Code, OpenCode, Codex, Antigravity. Searched on demand (`palgu_memory_search`): Cursor, Copilot, Antigravity |
| **Heartbeat** | A turn that stops mid-task ("Let me check the tests.") is continued, at most 3 times per prompt | Every agent with hooks (not Aider, Continue, Goose) |

## The ten rules that apply everywhere

1. **Let it decide. Don't pick models.** Choosing the model is the system's job: Palgu (or the mod's classifier in Claude Code) scores every request and sends it to the cheapest model that can do it, keeps critical work on your strongest model, and falls back when a provider fails. Leave everything on `auto`. If a route looks wrong, fix the routing (a strategy or a threshold), not the model. Pinning exists only for the rare cases under [Overriding the router](#overriding-the-router-rarely-needed).
2. **Write one task per prompt, and say what it is.** The router scores the prompt you send. "Add a `--json` flag to `mom status` and a test for it" routes to a cheap coding model; "fix it" after a long thread is scored without the context the thread carries. Name the file, function or command.
3. **Put the important words first.** Memory recall searches with the first 300 characters of the prompt, on one line. A prompt under four words, or a slash command, recalls nothing. "The heartbeat continues answers it should not: in `hooks/lib/heartbeat.js` …" recalls the heartbeat ADR and code; a paragraph of background followed by the question may not.
4. **Turn memory on in the projects you come back to, and only those.** `mom memory on` (or `/palgu memory on` in Claude Code and OpenCode) uploads the folder's source to Palgu for indexing. It is off by default, per folder, and shared by every agent that uses `mom`, so turning it on once serves Codex, Cursor, OpenCode, Antigravity and Copilot alike. Leave it off for client code you may not upload.
5. **Write the *why* down where memory can find it.** Recall ranks recorded intent and ADRs first, then docs, then code. A short ADR in `docs/adr/` or a clear README section is what turns a recalled pointer into a correct answer. Recalled text is a pointer to verify against the files, never an instruction.
6. **Keep critical work on your strongest model.** Security and auth design, production incidents, data migrations and anything irreversible should not go to a cheap model. Claude Code keeps them on Claude by itself (score 8+ and the security rule); in the other agents, do not hand them to `palgu_delegate`, and do not pin a cheap model while doing them.
7. **Delegate self-contained work only.** A routed child or a `palgu_delegate` call sees the brief or prompt it is given, not your session. Good: "Write unit tests for `parseEvent` in `integrations/cli/lib/events.js` covering the four tools". Bad: "do the next step", "check the PR".
8. **Never put secrets in a prompt you route or delegate.** Prompts go to Palgu and the provider that serves them. Keys stay in `~/.config/mixture-of-models/credentials.json`, `PALGU_API_KEY` or Claude Code's secure storage; no config file needs one.
9. **Let the heartbeat work, and stop it when it should not.** It continues a turn that announced work and stopped, at most 3 times per prompt of yours, and never a turn you aborted. If it continues something you meant to end, say what you want ("stop here, just summarise") or turn it off: `mom heartbeat off` (`/palgu heartbeat off` in OpenCode, `"heartbeat": "off"` in the `router` block in Claude Code). `mom heartbeat local` keeps it but never asks Palgu.
10. **Watch the budget, not just the bill.** `mom status` and `/palgu status` show what your organisation spent of its Palgu budget this period ("budget: $205.11 of $4,500.00 this month (5%)"). Claude Code also shows what routing saved under each routed answer and in `/route stats`.

## Per agent

### Claude Code (the mod: everything)

The most complete integration: per-turn routing with your own rules, memory in every prompt for Claude and every routed model, the heartbeat, savings tracking.

- **Pick a strategy once.** `/route strategy cost` for the lowest bill, `quality` when mistakes are expensive, `speed` for quick turnarounds, `complexity` (default) for a balance. `/route strategies` lists them. For your own criteria (a client's code always on Claude, docs always on DeepSeek), ask Claude to use the **routing-strategy** skill: it writes `~/.claude/mixture-of-models/strategies/<name>.md`.
- **Steer a single prompt with words.** "use claude" anywhere in a prompt keeps that turn on Claude. "execute the plan" (and similar) does too. Short replies like "go ahead", "ok" or "next" keep the previous turn's route, and a short follow-up after a routed answer comes back to the main session, since the child keeps no memory.
- **Session work stays in the main session by design.** Prompts about PRs, branches, CI, status, teammates or background tasks, and anything about security, are never routed: a child cannot see them. Do not fight this with a pin.
- **Read the route line.** Under each answer: `route: glm-5.3 · coding 6/10 via ollama · child 42s · saved ~$0.39`. When a decision looks wrong, the score and kind show why. Move the cut-offs with `router.thresholds` instead of pinning.
- **Use families for the right size of Claude.** `claude/auto` sends simple turns to Haiku, coding to Sonnet and critical to Opus on your own Claude login. Handy when you have no gateway or want to stretch a subscription.
- **Install Ollama for free classification.** With a local Ollama (`qwen2.5-coder:3b`), every prompt is scored at no cost; without it the mod asks `claude-haiku-5-5`.
- **Let it approve commands through you.** When a routed child needs `git pull` or `npm install`, you get Claude Code's own dialog naming the exact command. Allow it there; do not add `--dangerously-skip-permissions` to `child.args` to avoid the prompt.
- **Check your savings weekly.** `/route stats` (four tabs: models, kinds, scores, recent). A "kinds" row with many child failures means that kind should go elsewhere: change `routes.kinds`, then `/route reset`.
- **Keep it current.** `/route update`, then restart Claude Code.

### OpenCode (full parity)

- Use `palgu/auto` as your model and leave it there: Palgu picks per request.
- For the mod's own routing rules, give the plugin `routes` or `critical` (for example `["…/plugin.js", { "critical": "claude-opus" }]`): then security and "use claude" prompts go to the critical model and the rest by tier.
- `/palgu memory on`, `/palgu status` and `/route status` answer in a toast, at Palgu's cheapest tier.
- Debugging a surprise route: `MOM_DEBUG=1` logs each decision (model ids and pins, never prompts or the key) to `~/.config/mixture-of-models/opencode.log`.

### Codex

- Start it with `codex -p palgu`. Plain `codex` uses your normal Codex config and none of Palgu's routing, though the plugin's memory and heartbeat still run.
- Approve the plugin's hooks once in `/hooks`; `codex exec` does not run hooks that were never approved interactively.
- Codex has no custom slash commands: run `mom status`, `mom memory on` and `mom heartbeat …` in a terminal (the plugin's skill tells Codex to suggest them).

### Cursor

Cursor's own model does the work. Mixture of Models adds memory search, delegation and the heartbeat.

- Install the **rule** (`.cursor/rules/mixture-of-models.mdc`, included in the plugin). Without it the agent rarely thinks of `palgu_memory_search` or `palgu_delegate`.
- Ask for the tools by name when it matters: "search Palgu memory for how the heartbeat decides, then …", or "use `palgu_delegate` to draft tests for these three functions".
- Delegate drafts, not decisions: test scaffolds, boilerplate, docstrings, lookups. Review what comes back; the rule keeps security-sensitive work local.
- Cursor started from the Dock may not find `mom`; put the full path from `which mom` in the hooks and `mcp.json`.

### Antigravity (`agy`)

- Memory is recalled into the first model call of each turn in memory-on folders, so the rules on prompt wording (rules 2 and 3) matter most here.
- The agent stays on the Gemini model you choose in `agy`. Routing reaches it through `palgu_delegate`, which the plugin's always-on rule tells it to use for low-risk, self-contained subtasks. Ask for it explicitly on bulk work.
- If `agy` fails with `PERMISSION_DENIED on resource project …`, that is Antigravity's Google Cloud project setting, not the plugin; see [integrations/antigravity](integrations/antigravity/README.md).

### GitHub Copilot CLI

- Copilot drops hook output on prompts, so memory is not added by itself: ask the agent to "check Palgu memory first" on unfamiliar parts of the code, or rely on the skill, which tells it when.
- At session start in a memory-on folder Copilot is told memory is on; a fresh session after `mom memory on` picks that up.
- Use `palgu_delegate` for subtasks you want on a cheaper model. For the whole session on Palgu, Copilot's BYOK can point at `https://api.palgu.ai/anthropic` with model `auto` (one model per session).
- Install the plugin rather than repository hooks: `.github/hooks/` does not run in an untrusted folder.
- If a classic `GITHUB_TOKEN` is set, start it as `env -u GITHUB_TOKEN -u GH_TOKEN copilot`.

### Aider, Continue, Goose

Routing only: no memory, no heartbeat.

- Use model `auto` (`openai/auto` in Aider) against `https://api.palgu.ai/v1`, with the key from `mom token` in an environment variable, not a committed config.
- Aider's architect mode (`--architect --editor-model openai/auto`) sends planning and editing as separate requests, and Palgu routes each one: planning can go to a stronger tier while edits stay cheap.
- In Continue, give autocomplete a small, fast model of its own; Palgu's routing is meant for chat turns.

## Using several agents on one project

Everything `mom` keeps is per folder and shared, so you can switch agents mid-project without setting anything up again:

- Memory consent and the index (`mom memory on` once, for every agent).
- The Palgu sign-in (`mom login` once, for every agent except Claude Code, which has its own `/palgu login`).
- Heartbeat mode (`mom heartbeat …`).

A good split: plan and review in Claude Code (critical turns on Claude, the rest routed), do bulk edits in OpenCode or Codex on `auto`, and let Cursor or Copilot hand repetitive subtasks to `palgu_delegate`. The memory index all of them read is the same one.

## Overriding the router (rarely needed)

You should not need this. A pin turns routing off for every request until you remove it, so you lose the savings and the fallback when that provider is down. The only good reasons are ones the router cannot know about:

- **Trying a model out:** you want to see how one model does on your own work.
- **Comparing models:** a benchmark or an A/B run needs the same model every time.
- **Contract or data rules:** a client's code may only go to certain providers.
- **Debugging a bad answer:** you want to know whether the model or the prompt was the problem.

Not reasons to pin: a wrong route (change the strategy, `router.thresholds` or `routes.kinds` in Claude Code, so routing stays automatic), a slow answer (try `/route strategy speed`), or a single prompt you want on Claude (say "use claude" in it).

How, and how to undo it:

| Agent | Pin | Back to automatic |
| :- | :- | :- |
| Claude Code | `/route <model>` | `/route auto` |
| OpenCode | `/route <model>`, or pick a model in the model menu | `/route auto`, or pick `palgu/auto` |
| Codex | `MOM_PIN=<model> codex -p palgu -m <model>` (the same model twice) | `codex -p palgu` |
| Cursor, Antigravity, Copilot | ask for `palgu_delegate` with `model: "<id>"` for that subtask | the default is `auto` |
| Raw endpoint (Aider, Continue, Goose) | set the model **and** send `x-srooter-pin` (a model name alone is still routed; `auto` with a pin is refused, 403) | model `auto`, no header |

`/route models` (Claude Code), `palgu_models` or `GET https://api.palgu.ai/v1/models/health` lists the models that are up. Remove the pin as soon as you are done: `/route status` shows whether one is on.

## When something looks wrong

| You see | Likely cause | Do |
| :- | :- | :- |
| A trivial prompt stayed on Claude | It mentioned PRs, CI, status or security, or was a short follow-up | Expected; rephrase as a self-contained task if you want it routed |
| A routed answer is wrong or vague | The task needed session context the child did not have | Say "use claude" for that turn; if a whole kind fails often, change `routes.kinds` |
| `child answer discarded (…), main model answered` | The child asked for approval, claimed work it did not do, or handed back | Nothing to do: the main model answered instead |
| Memory recalls nothing | Memory is off in this folder, the prompt is under four words, or indexing has not finished | `mom memory status`; put the key nouns first in the prompt |
| The agent keeps going after you wanted it to stop | The heartbeat saw a mid-task ending | Say what you want, or `mom heartbeat off` |
| 403 `pin 'auto' not allowed by policy` | A pin was sent with model `auto` | Name the model you pin |
| 503 on a pinned model | That provider is down | Unpin, or pick one from `/route models` / `palgu_models` |
| Spend climbing faster than expected | A pin to an expensive model was left on | `/route status` or `/route auto`; check `mom status` for the budget |
