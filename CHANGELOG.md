# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-10-09

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
