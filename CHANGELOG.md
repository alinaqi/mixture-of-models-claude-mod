# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.17.0] - 2026-10-29

### Added
- Help on the band: `0: help` comes first, before `1: auto`. It opens a pane (also `/route help`) that says what the mod does, where it stands now (auto, pinned or off, and that the choice is remembered across sessions; which gateway, or how to connect one; what routing has saved), what each band button and command does, and how to connect Palgu, OpenRouter or LiteLLM. It changes no setting.

## [0.16.0] - 2026-10-29

### Added
- OpenRouter and LiteLLM as first-class gateways, next to Palgu. A new plugin option, `gateway_provider` (`auto`, `palgu`, `openrouter`, `litellm`, `anthropic-compatible`; also `router.provider`), says what the gateway is; `auto` detects Palgu (`*.palgu.ai`) and OpenRouter (`openrouter.ai`) from `gateway_url`, and any other host stays a generic Anthropic-compatible gateway, as before.
- OpenRouter (`gateway_url: https://openrouter.ai/api`): the child sends your OpenRouter key as `Authorization: Bearer` (`ANTHROPIC_AUTH_TOKEN`), and the families map to OpenRouter slugs: `glm/5.3` → `z-ai/glm-5.3`, `kimi/pro` → `moonshotai/kimi-k3.1-pro`, `deepseek/v4-pro` → `deepseek/deepseek-v4-pro`, `mercury/3` → `inception/mercury-3`, `gemini/3.8-flash` → `google/gemini-3.8-flash`. Default routes, `/route <prefix>`, `primary` and the band's buttons follow. A slug a family lists (`z-ai/glm-5.3`) works as a route too.
- LiteLLM (`gateway_provider: litellm`, `gateway_url` your proxy, for example `http://localhost:4000`): the master or virtual key goes as `Authorization: Bearer`; the default model names stay Palgu's, so name your proxy's `model_name`s the same or set `router.routes` and `router.families`.
- Codex routes on OpenRouter and LiteLLM: Codex gets an `openrouter` or `litellm` provider on `<gateway_url>/v1` (Responses API), the key in `OPENROUTER_API_KEY` or `LITELLM_API_KEY`, in its environment only. Name the model there (`codex/openai/gpt-5.6-terra`).
- `router.child.auth` (`x-api-key` or `bearer`) for a generic gateway that wants a bearer token.
- README: "OpenRouter" and "LiteLLM" setup with the exact `/plugin configure` values; PRIVACY and the Network table name the new endpoints.

### Security
- The gateway child now puts its key in exactly one of `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` and sets the other to empty. The child inherits your shell's environment and Claude Code sends both when both are set (checked against Claude Code 2.1.312 with a header-logging server): before, an `ANTHROPIC_AUTH_TOKEN` exported in your shell went to the gateway as a bearer token next to the gateway key.
- The `x-srooter-client` and `x-srooter-project` headers go only to Palgu and generic gateways, not to OpenRouter or LiteLLM.

### Changed
- `/palgu login` also saves `gateway_provider: palgu`, so a provider chosen earlier for another gateway does not stick to Palgu.

## [0.15.0] - 2026-10-29

### Added
- How much routing saves. Every routed turn is priced at your session's Claude model and at what it actually cost (Palgu's own `/v1/pricing/quote`, the new `router.prices` table, or a Claude member's rate), and main-session turns count toward the all-Claude total. The line under a routed answer shows `· saved ~$0.39`, `/route status` shows the running total (`saved ~$12.40 (61%) vs all claude-opus-5-5, at API prices`), and the `/route stats` pane shows it on the models tab. Claude prices are the API list prices, including 1-hour cache writes, so on a subscription it is the API-equivalent saving; a turn the mod cannot price claims nothing and is counted as unpriced.
- `router.prices`: $ per million tokens for gateway models.
- The child's token usage is now read from its JSON result.

## [0.14.0] - 2026-10-29

### Added
- `/palgu login`: sign up or sign in to Palgu from the terminal. It starts Palgu's device sign-in as the client `mixture-of-models`, shows a link and a code to approve in the browser (new users can sign up there), polls in the background, and once approved saves the key Palgu minted for this computer with `claude plugin configure --values-stdin` (the key on stdin, never argv). Routed turns use it at once, with no restart. Needs the Palgu gateway release that accepts the `mixture-of-models` client; until then it says sign-in could not start and how to paste a key instead.
- `/palgu status` asks Palgu's `/me` who the key belongs to and the org's plan; `/palgu upgrade` gives the plans and billing page.
- README: a "Get Palgu's models in one command" quick start near the top. README and PRIVACY list the new calls to `https://api.palgu.ai` and the install id kept in the plugin store.

## [0.13.1] - 2026-10-29

### Security
- A Claude child can no longer read secret files. The gateway child runs `--bare`, which skips your hooks, so a hook guarding `.env` did not run there and the child could read it and send it to the gateway model. Every Claude child now gets `--disallowedTools` with Claude Code permission deny rules, which `--bare` keeps, for `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*` and `secrets/**`. They come after `child.args`, so custom args cannot drop them.

### Added
- `router.child.deny` adds your own deny rules to that list.
- The README says next to the install steps that hooks do not run in the gateway child, and how to turn on auto-update for the marketplace.

## [0.13.0] - 2026-10-29

### Added
- `gemini-3.8-flash`, the Palgu gateway's vision and video model, can be named in `routes`, `routes.kinds` or a pin; `/route gemini` pins it and `gemini/3.8-flash` names it as a family member. Like `mercury-3` it is an option, not a default route.

### Changed
- The band above the prompt shows a button for every gateway family (`glm`, `kimi`, `deepseek`, `mercury`, `gemini`), not only the ones your routes name, so every model you can pin can be picked there. Routed families come first.

## [0.12.1] - 2026-10-28

### Security
- A Codex child no longer runs commands or edits files without your approval. It now runs in Codex's `read-only` sandbox with `approval_policy="never"` explicit, so it can read the project but not change it or use the network. Before, `--sandbox workspace-write` let a routed Codex turn edit files and run any command in your project unasked, unlike the Claude child, which asks you about every refused command.
- When Codex is refused a command it needs, you are asked, with the same dialog as the Claude child, naming the commands. "Allow and continue" resumes the same Codex thread for that turn with edits in the project allowed (still no network); "Deny" leaves it read-only, and the answer and the route line (`· sandbox read-only · refused: <command>`) say what did not run. `codex exec --json` does not report refusals itself, so Codex is told to name them, and refused escalations it logs are counted.
- Codex no longer runs outside a git repository unless you set `router.codex.allowOutsideGit: true`; the route line says so when it refuses.

### Changed
- New `router.codex.sandbox` (`read-only` by default; `workspace-write` or `danger-full-access` are opt-ins that let Codex run commands without asking) and `router.codex.allowOutsideGit`. `router.codex.args` now adds flags instead of replacing the sandbox, and any sandbox or approval flag in it (for example the old example's `--sandbox workspace-write`) is ignored with a log line: set `router.codex.sandbox` instead.
- The route line for a Codex turn shows its sandbox, for example `· sandbox read-only` or `· sandbox workspace-write (approved)`.

## [0.12.0] - 2026-10-28

### Added
- Model families. A route, kind route or pin can be `<family>/<member>` or `<family>/auto`: `claude/sonnet`, `claude/auto`, `kimi/highspeed`, `kimi/auto`, `glm/5.3`, `codex/gpt-5.6-terra`. `auto` scores the prompt as before and picks the member for its tier from the family's `auto` map (Claude: simple → `claude-haiku-5-5`, coding → `claude-sonnet-5-5`, critical → `claude-opus-5-5`; Kimi: simple → `kimi-k3.1-pro-highspeed`, else `kimi-k3.1-pro`), never leaving the family. `claude-fable-5-1` is opt-in for 10/10 critical turns with `"criticalPlus": "fable"`. Members and maps are overridable per family in `router.families`.
- Claude members run on your own Claude login: a headless `claude -p --model <id>` child without `--bare` and with no gateway, so `/route claude/sonnet` works with no gateway configured. A member that is the session's own model stays in the main session.
- Codex as a child. `codex`, `codex/<model>` and `codex/auto` routes, and `/route codex`, answer the turn with `codex exec`, with the same brief, timeout, vetting, failure memory and route line as the Claude child. By default it uses your Palgu gateway's `/v1/responses` with your gateway key (in its environment only, never on the command line); `"codex": { "auth": "chatgpt" }` uses your own Codex login. A missing `codex` binary is reported with the install command and the main model answers.
- `/route status` shows the mode, the current family and member, and every family with its members. The route line names the family and member, for example `claude-sonnet-5-5 (claude/auto → sonnet)`, and the reply tag says where the child ran.

### Changed
- `/route` refuses an unknown family or member and lists the valid ones, instead of pinning a model the gateway cannot serve.
- The stats pane's "off Claude" count no longer counts turns that a Claude-member child answered.
- A tier routed to a Claude member (`"critical": "claude/opus"`) is mandatory Claude: `routes.kinds` does not move it to a gateway model. Bare `"claude"` and plain model ids behave exactly as before.

## [0.11.0] - 2026-10-28

### Added
- The child Claude Code identifies itself to the Palgu gateway, so its traffic shows as Mixture-of-Models, per project, on the dashboard's project activity instead of generic API. Every child request carries `x-srooter-client: mixture-of-models/<version>` and `x-srooter-project: <the session folder's name>` (slugged like the gateway's project detection: lowercase, `[a-z0-9._-]`, at most 64 characters). They are set through the child's `ANTHROPIC_CUSTOM_HEADERS`, only when a gateway is configured, so they go to that gateway alone. No path, prompt or other content is in them.

### Changed
- Custom headers you set in `ANTHROPIC_CUSTOM_HEADERS` reach the child too: yours come first and are never dropped, and a `x-srooter-client` or `x-srooter-project` you set yourself wins over the mod's. The mod now reads that environment variable.
- `npm run changelog` also fails when `package.json` or `hooks/lib/version.js` disagrees with the version in `plugin.json`.

## [0.10.0] - 2026-10-28

### Changed
- Research and review turns, and `primary: "kimi"`, now go to `kimi-k3.1-pro`, the successor of `kimi-k3`. A saved `/route kimi-k3` pin expands to `kimi-k3.1-pro`.

### Added
- `mercury-3` (Inception's Mercury 3: fast, 1M-token context, tool calling) can be named in `routes`, `routes.kinds` or a pin, and `/route mercury` pins it. It is not a default route: that waits for a measured speed and quality check on routed turns.
- `/route <prefix>` also expands to the Palgu gateway models no route names: `glm-5.3`, `kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`, `deepseek-v4-pro` and `mercury-3`.

## [0.9.0] - 2026-10-11

### Fixed
- Turns that only the main session can serve were routed to a child: teammate messages (`<teammate-message>`, `idle_notification`), background task notifications (`<task-notification>`, `[SYSTEM NOTIFICATION`), and short operator commands such as "approve git pull --ff-only", "continue", "merge it", "check the sub agents" or "what's the status". The child could not see the conversation, teammates or tools, so it narrated or invented an answer, and re-posted the same long verdict on every idle notification. These turns, and security or verdict turns, now always stay on the main session, even with a `/route` pin (`via notification`, `via session command`, `via security or verdict`).
- Child answers that fabricated results are no longer shown as done. An answer is discarded, and the main model takes the turn, when it replies `HANDBACK`, says it is blocked or tells you to approve or run commands yourself, claims a change or a session fact (a PR number, "N commits behind", "no runs exist") without having called a single tool, is mostly narration of intent, or repeats an earlier answer. The route line says `child answer discarded (<reason>)` and it counts as a child failure for that kind.

### Changed
- Every child brief opens with a preamble: no access to the main session, never invent statuses, IDs, PR numbers or results, never ask the user to approve or run anything, reply `HANDBACK` when the task needs session state.
- After a denied permission relay, the child's "I need approval" explanation is no longer the answer; the main model takes the turn.

## [0.8.0] - 2026-10-11

### Added
- Permission relay. A headless child cannot ask you anything, so a command its permission mode refused used to come back as prose ("I need approval to run git pull --ff-only") with no prompt in Claude Code. Now the child reports the refusal, the mod asks you in Claude Code's question dialog naming the exact command, and "Allow and continue" resumes the same child session with only that command allowed, so it carries on where it stopped. "Deny", or nobody to answer, keeps the child's own explanation as the answer. `child.relayRounds` (default 2) caps the rounds per turn.

### Changed
- The child runs with `--output-format json` so its session id and permission refusals can be read; its answer text is unchanged.
- README: removed the early-status notice.

## [0.7.1] - 2026-10-10

### Fixed
- A session could lose its thread of work: after a child-answered turn, "continue" and other short follow-ups were routed to a new child that had no memory of the work, so it started over, and coding-level follow-ups during a main-session task were routed away too. Now any follow-up after a child turn returns to the main session, and while the main session is mid-task (its last answer used tools) coding-level work stays with it (`via mid-task guard`). Lookups and new self-contained tasks still route.

### Changed
- The child's brief carries 12 exchanges of up to 1,200 characters each (was 6 of 600).
- CI fails when `CHANGELOG.md` has no section for the version in `plugin.json` (`npm run changelog`); README links the changelog.

## [0.7.0] - 2026-10-10

### Added
- `/route stats` opens a pane, "Mixture of models", with four tabs on hotkeys 1-4: **models** (a bar per model with its share of turns and the headline "N of M turns off Claude", plus child runs, failures and average time), **kinds** (each kind and which models took it), **scores** (a 1-10 histogram coloured by tier with the cut-offs marked), **recent** (the last decisions with score, kind, model, where they ran and the classifier used). Esc closes it.
- A bounded decision log (last 200 turns) in the plugin store feeds the pane. It holds day, model, kind, tier, score, classifier source, child duration and exit code, never prompt text.

### Changed
- Docs: GETTING_STARTED has the Claude Code upgrade commands and the `ANTHROPIC_API_KEY` caution; README has the in-session install line, the `--values-stdin` form and a pointer to `config.example.json`.

## [0.6.0] - 2026-10-09

### Added
- A second classification axis, **task kind** (`code | research | review | docs | data | multimodal`), from the same classifier call. `routes.kinds` maps kind to model below the critical tier; by default research and review go to Kimi.
- A difficulty clause in the rubric: deep reasoning scores at least 7, so hard-but-safe work stays on Claude.
- Borderline sampling: a score on the coding cut-off or one above gets a second sample and the higher wins.
- Failure memory: every two child failures for a kind lower that kind's coding cut-off by one. `/route reset` clears it.

### Changed
- The `analysis` tier and the prefix rule are gone; the kind axis covers it.
- The band and the route line show the kind next to the score.
- README: the Programs section states which program runs and why, and that no shell, bundled script or launcher is run.
- CI validates without `--strict`, since the runner's Claude Code build may not know `privacyPolicyUrl` yet.

## [0.5.2] - 2026-10-09

### Changed
- The program the mod runs is the fixed text `claude` at the `$.process.run` call; the `child.command` launcher setting is gone, so the directory's scan can see which program runs.
- README opens the disclosure section with plain sentences naming each call, what it sends and where.

### Added
- `PRIVACY.md` and `privacyPolicyUrl` in the manifest.

## [0.5.1] - 2026-10-09

### Changed
- The gateway key comes only from the plugin's `gateway_key` option. The opt-in env-file read (`child.keyFile`) is gone, as the directory's validation asked.
- The Ollama address is fixed in the code (`http://localhost:11434/api/chat`); `ollama.base` is no longer a setting.
- README: the disclosure section now lists every hook and what it does, every host contacted, the exact child command, the files and variables read, and what is stored.

### Added
- Listing icon at `.claude-plugin/icon.png`.
- The gateway in docs, examples and tests is [palgu](https://www.palgu.ai) (`https://api.palgu.ai/anthropic`), srooter's successor; the same key works.

## [0.5.0] - 2026-10-09

### Changed
- The gateway URL and key are asked for through the plugin's `userConfig` (`gateway_url`, `gateway_key` masked and kept in secure storage) and reach the mod as `register(on, options)`. Reading a key from an env file is now opt-in: set `router.child.keyFile` in model-config to name one. Nothing on the machine is read for credentials by default.
- README gains a disclosure section listing everything the plugin runs, reads, sends and stores.

## [0.4.0] - 2026-10-09

### Added
- README: install block with the Claude Code version wall, a precise one-paragraph framing (turn-level delegation), and an early-status notice.

### Changed
- Classification is now Maggy's **blast score**: the classifier rates 1-10 against a rubric where length, the number of services named or pasted API keys do not raise the score, and `router.thresholds` (default `simple ≤ 3`, `coding ≤ 7`, above is `critical`) maps the score to a tier. The previous four-label classifier sent long integration tasks to the main session.
- `primary: claude` in model-config no longer pulls the `coding` tier onto Claude; it only keeps `critical` there. Set `routes.coding` to `"claude"` explicitly if you want the old behaviour.
- The route line and the band show the score, e.g. `coding 6/10 via claude-haiku-4-5`.
- Prompts that start with review, summarise, explain, compare, research, describe, "what does" or "how does" go to the `analysis` tier by rule.
- The cached fallback is the last score (`last-score`) instead of the last label.

## [0.3.1] - 2026-10-08

### Fixed
- `prompt.submit` has a fail-open `.catch` handler, as `claude plugin validate --strict` on 2.1.294 asks for gating hooks.
- Hook tests registered the classifier stub twice in two cases; `stubSession` now takes the label.
- Contributor instructions moved from `CLAUDE.md` to `AGENTS.md`: a `CLAUDE.md` at a plugin root is flagged by strict validation.

### Verified
- On Claude Code 2.1.294: all 55 tests pass under `claude plugin test`; a headless session on a claude.ai subscription with the mod loaded answered a simple prompt from the child through srooter with no parent model call.

## [0.3.0] - 2026-10-08

### Changed
- The child runs `--bare` by default: no inherited hooks or plugins, API-key auth only. A live test showed an inherited UserPromptSubmit hook polluting the child's answer. `--add-dir <cwd>` is always passed so the project's `CLAUDE.md` still loads.
- srooter's Anthropic endpoint is `https://api.srooter.ai/anthropic` (the www host is the website); docs, example config and tests corrected.

### Noted
- A gateway that routes by intent (srooter) may answer with a different model than the one requested; the tag and route line name the requested route.

## [0.2.0] - 2026-10-08

### Added
- A band above the prompt: the current mode and last decision, with digit-hotkey buttons `auto · glm · kimi · claude · off` that pin a route without a command. Config `router.ui.band`.
- A provenance tag above replies that came from a child (`⇢ glm-5.3 · child on gateway`). `router.ui.tags` is `routed` (default), `all` (main-session replies get `⇢ claude-opus-5 · main session` too) or `off`.
- `summaryLine` now ends every turn's line with where it ran: `child 42s` or `main session`.

### Changed
- The route line under an answer appears on every turn, main-session turns included, so Claude and gateway work are both visible. Today's counts list every model used.
- `/route` reports through the same text as the band.
- CI skips the hook tests when the installed Claude Code has no `plugin test` subcommand instead of failing the run.

## [0.1.0] - 2026-10-08

### Added
- Prompt classification into `simple | coding | analysis | critical`: local Ollama first, `claude-haiku-4-5` via `$.model.classify` as fallback, then the last cached label.
- Maggy's pre-routing rules: `use claude` and execution-intent phrases force `critical`; continuation phrases and short prompts mid-task keep the current route.
- Child-process delegation: a routed turn is answered by a headless `claude -p` child whose environment alone carries the gateway URL and key. The main session is never renamed or re-pointed.
- Automatic fallback to the main model when the child fails or prints nothing.
- `/route` command: show, `auto`, `off`, pin a tier, or pin a model (`glm`, `kimi`, a full id). Pins persist in the plugin store.
- Spinner suffix and a summary line under routed answers with per-day counts.
- Configuration through Maggy's `~/.claude/model-config.json` under a `router` block.
- Pure-function test suite runnable under Node (`npm test`) and hook-level tests for `claude plugin test`.
- ADR 0001 recording the child-process decision.
