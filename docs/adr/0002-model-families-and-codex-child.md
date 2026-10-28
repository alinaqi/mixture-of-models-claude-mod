# 0002 - Route within a model family, and run Codex as a second kind of child

**Status:** accepted
**Date:** 2026-10-28
**Spec:** https://github.com/alinaqi/mixture-of-models-claude-mod/issues/5
**Deciders:** Ali Naqi Shaheen

## Context

Routes named one model per tier (`glm-5.3`, `kimi-k3.1-pro`) or `claude`, meaning "the main session". Users want finer control: a specific Claude member (`claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`), a choice inside a family made from the task's difficulty, and the Codex CLI as an executor next to Claude Code.

ADR 0001 rules out re-pointing or renaming the main session. A mod could rewrite the model name on a main-session request, which would keep the subscription and the transcript, but that is exactly the renaming 0001 forbids: a tool loop that switches model mid-turn, a session whose model the user did not choose, and a `/model` display that lies.

## Decision

1. A route value may be `<family>/<member>` or `<family>/auto`. Families are `claude`, the gateway families built from the gateway catalogue (`kimi`, `glm`, `deepseek`, `mercury`) and `codex`, each with `members` (alias → exact id) and an `auto` map (tier → member, optional `criticalPlus` for 10/10 critical turns). `auto` reuses the classifier, thresholds and failure memory and never leaves the family. Bare `claude` keeps its meaning.
2. A Claude member that is not the session model runs in a child `claude -p --model <id>`, Claude Code's own model flag, **without `--bare`** (which only allows API-key auth) and with `ANTHROPIC_BASE_URL` cleared, so it runs on the user's own Claude login. `ANTHROPIC_API_KEY` is not set at all: Claude Code treats an empty value as a key. A member equal to the session model stays in the main session.
3. A `codex` route runs `codex exec --json … -` as the child, with the same brief, timeout and vetting. On the Palgu path the provider is passed with `-c model_providers.palgu.*` (Responses wire API) and the key in the child's environment as `PALGU_API_KEY`; on the ChatGPT path the user's own Codex config and login are used untouched.
4. A route names a **runner**: `main`, `gateway`, `subscription` or `codex`, each with its own readiness (gateway URL + key; nothing; Codex auth), so a subscription route works without a gateway.

## Consequences

- The main session is still never renamed, re-pointed or touched.
- A subscription child loads the user's hooks and plugins (no `--bare`); the mod disables itself there via `MAGGY_ROUTER_CHILD`. Other hooks may add output to the child's run.
- The mod now runs two programs, `claude` and `codex`; README, PRIVACY and the static analysis list both.
- Codex has no permission-denial report, so the permission relay does not apply to it: its sandbox (`workspace-write` by default) decides, and a blocked command fails inside the run.
- A subscription child spends the user's Claude plan, like the main session would; it is not a cost saving, it is a model choice.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Rewrite `model` on the main session's `turn.step` for Claude members | One process, full transcript, streaming | Renames the main session per turn; mid-loop model switches | Violates ADR 0001 |
| Send Claude members through the gateway's `/anthropic` path | Same child as today | Spends gateway credit instead of the subscription the user pays for; needs a gateway | The ask is the subscription path |
| Codex through `OPENAI_BASE_URL` | Fewer flags | Ignored under a ChatGPT login | Palgu's Codex docs require an explicit provider |
| Write a `~/.codex/config.toml` profile | Shorter argv | Writes to the user's Codex config | The mod never writes user config |

## Links

- Supersedes: N/A
- Related: ADR 0001, issue #5, Palgu client docs (Codex CLI via `/v1/responses`)
