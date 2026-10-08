# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
