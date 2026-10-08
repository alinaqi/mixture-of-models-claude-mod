# 0001 - Delegate routed turns to a child process, never re-point the main session

**Status:** accepted
**Date:** 2026-10-08
**Spec:** https://github.com/alinaqi/maggy (route-task-hook, model_routing.py)
**Deciders:** Ali Naqi Shaheen

## Context

Maggy routes work across models by injecting "delegate this to `~/bin/<model>`" instructions into Claude's context and relying on Claude to follow them. A Claude Code mod can do better: its `turn.step` hook runs before every request to the model.

Two constraints shaped the design:

1. A mod can rewrite the **model name** on a request but not the **endpoint or credentials**. Those are per process: `ANTHROPIC_BASE_URL` and the auth Claude Code resolved at start-up. The transcript, system prompt and tool schemas are not exposed to a hook, so a mod cannot rebuild the request for another endpoint either.
2. The user wants cheap tiers on an Anthropic-compatible gateway (srooter) **and** critical work on the claude.ai subscription. A probe showed Claude Code sends its subscription OAuth token to whatever `ANTHROPIC_BASE_URL` names, so a pass-through proxy could in principle split traffic, but that routes the subscription token through a proxy and was rejected: the main session must not be interfered with.

## Decision

Routing happens only in a **separate child process**. On `turn.step` for a routed turn the mod runs `claude -p --model <routed id>` with `$.process.run`, giving the child its own environment (`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY` read from Maggy's env file, and a `MAGGY_ROUTER_CHILD` marker), the task plus a short brief of recent exchanges on stdin, and returns the child's output as the turn's answer. The main session's request is never modified: no model rename, no base URL, no subagent routing. If the child fails or prints nothing, the hook calls `next(e)` and the main model answers.

## Consequences

- The subscription is untouched; only child processes talk to the gateway.
- Child tool calls are invisible to the main transcript; only the final text lands there. The child does not share the main session's memory beyond the brief.
- No token streaming for routed answers in this version (`$.process.run` returns whole output). `$.process.spawn` may enable streaming on newer builds.
- The child runs `--bare` by default (hooks, plugins and keychain auth off; `--add-dir <cwd>` keeps `CLAUDE.md`), after a test showed an inherited hook polluting its answer. The mod also disables itself inside a child via the marker.
- Two Claude Code processes run during a routed turn.

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|--------|------|------|---------|
| Rename `model` on `turn.step` with the gateway at `ANTHROPIC_BASE_URL` | One process, streaming, full context | Every request, including critical ones, leaves the subscription; gateway must proxy Claude | Loses the subscription |
| Pass-through split proxy forwarding the OAuth token for `claude-*` | Keeps subscription, one process | Subscription token transits a proxy; terms-of-service question; a bug in the proxy breaks every turn | Interferes with the main session; rejected by the user |
| Answer `turn.step` by calling the gateway from the mod with `$.http.fetch` | No child process | Transcript, system prompt and tool schemas are not exposed to hooks; lossy reconstruction; no tools | Not faithful |
| Keep Maggy's prompt-injection delegation | Already exists | Depends on Claude obeying; brittle; wrappers must exist | What this mod replaces |

## Links

- Supersedes: N/A
- Related: Maggy `hooks/route-task-hook`, `scripts/model_routing.py` (`DIRECT` launchers), Claude Code mods reference (`turn.step`, `$.process.run`)
