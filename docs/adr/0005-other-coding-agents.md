# 0005 - Mixture of Models in other coding agents: Palgu routes, `mom` adapts

**Status:** accepted
**Date:** 2026-11-16
**Deciders:** Ali Naqi Shaheen

## Context

The mod runs only inside Claude Code: it is built on the mods API (ADR 0001). People also code in Codex, Cursor, OpenCode, Aider, Antigravity, Gemini CLI, Copilot CLI and others, and asked for the same behaviour there: cheap work on cheap models, the heartbeat, Palgu memory.

Research on 2026-11-16 (each tool's docs and changelog, and a live run of Codex 0.163.0):

- **Choosing the model per turn from inside the tool** is possible only in OpenCode (`experimental.model.resolve`, same provider only) and Gemini CLI (`BeforeModel` `llm_request`, Gemini API format only). Codex, Cursor, Copilot CLI, Antigravity, Amp and Cline hooks read the model but cannot change it. Codex's app-server takes `model` on `turn/start`, but only an external client sets it.
- **Adding context to a prompt** works in Codex (`UserPromptSubmit` `additionalContext`), Gemini CLI (`BeforeAgent`), Antigravity (`PreInvocation` `injectSteps`), OpenCode (`context`) and Cline (`beforeRun`). Cursor only adds context at session start and after tools; Copilot CLI at session start and after tools.
- **Continuing a turn that stopped early** works in Codex (`Stop` `decision:"block"`), Cursor (`stop` `followup_message`), Gemini CLI (`AfterAgent` deny), Antigravity (`Stop` continue), Copilot CLI (`agentStop` block, at most 8), Amp (`agent.end` continue) and OpenCode (`session.prompt`).
- **Palgu already routes every request itself.** `GET /v1/routing/effective` shows the tiers (trivial, small, medium, think) and their models; an unpinned request to `POST /v1/responses` with `model: "auto"` is routed. `x-srooter-pin` overrides it with one model.

Checked live in Codex 0.163.0 (`codex exec`, hooks given with `-c hooks.<Event>=[...]`): `UserPromptSubmit` `additionalContext` reached the model, and `Stop` `{"decision":"block","reason":...}` made Codex take another turn with the reason as its prompt, after which `stop_hook_active` was true. A repository's `.codex/hooks.json` did not load for an untrusted folder in `codex exec`, even with `--dangerously-bypass-hook-trust`.

## Decision

1. **Palgu routes; the tool talks to Palgu.** In every tool that takes a custom endpoint, the model is Palgu's router (`auto`), or a pinned model through `x-srooter-pin`. No adapter re-implements classification where the tool cannot switch models; the decision runs once, on Palgu, with the same tiers for every tool.
2. **One small CLI, `mom`, holds what is not routing.** It reuses the mod's pure modules in `hooks/lib` (recall, heartbeat, memory consent, Palgu sign-in) and adds:
   - `mom login`, `logout`, `status`, `token` (prints the key for a tool's token command, never logs it).
   - `mom memory on|off|status` per project folder. Consent is shared by every tool on the machine, kept in `~/.config/mixture-of-models/state.json`.
   - `mom hook <tool> <event>`: reads the tool's hook JSON on stdin and answers in that tool's shape: memory recall on prompt submit, the heartbeat on stop, background indexing on session start.
   - `mom setup <tool>`: writes or prints the tool's provider configuration for Palgu.
3. **One adapter per tool, thin.** Codex first (a plugin with hooks and a skill, and a `palgu` profile), then Cursor (hooks, an MCP server, a rule) and OpenCode (a plugin with full parity), then setup docs for the gateway-only tools (Aider, Goose, Continue) and adapters for Antigravity, Copilot CLI and Gemini CLI.
4. **Zero dependencies.** `mom` is plain Node 20 ESM with `fetch` and `child_process`, installed from this repository (`npm install -g github:alinaqi/mixture-of-models-claude-mod`).

## Consequences

- One codebase: a fix to recall or the heartbeat reaches Claude Code and every adapter.
- In tools without a model-switching hook, routing is Palgu's tiers rather than the mod's classifier and strategies. `/route`-style pins become `MOM_PIN` (a header from the environment) for the session.
- The key lives in `~/.config/mixture-of-models/credentials.json` (mode 0600), or `PALGU_API_KEY`. Tools read it through `mom token` (Codex `auth` command), so it is not copied into each tool's config.
- Codex plugins with hooks cannot be listed in the public plugin directory; ours installs from this repository's marketplace.
