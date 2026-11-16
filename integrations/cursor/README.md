# Mixture of Models for Cursor

**English** · [简体中文](../../docs/i18n/zh-CN/integrations/cursor/README.md) · [日本語](../../docs/i18n/ja/integrations/cursor/README.md) · [Deutsch](../../docs/i18n/de/integrations/cursor/README.md) · [Français](../../docs/i18n/fr/integrations/cursor/README.md) · [العربية](../../docs/i18n/ar/integrations/cursor/README.md)

Search Palgu memory, send self-contained subtasks to cheaper models through Palgu, and continue a turn that stops mid-task. It works the way the Claude Code mod does, through what Cursor offers: hooks, an MCP server and a rule ([ADR 0005](../../docs/adr/0005-other-coding-agents.md)).

Needs Node 20 or later and the `mom` CLI on the `PATH` Cursor sees. Palgu memory also needs the [palgu CLI](https://www.palgu.ai/install) for indexing. It uses its own `palgu login` if you have one, else `mom`'s key.

## Install

```bash
# 1. The mom CLI (the hooks and the MCP server run it)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # sign in to Palgu in the browser
```

Then pick one of these:

- **The plugin.** In Cursor, **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** with `https://github.com/alinaqi/mixture-of-models-claude-mod`, then install **Mixture of Models** from **Customize**. To try it locally, copy `integrations/cursor` to `~/.cursor/plugins/local/mixture-of-models` and run **Developer: Reload Window**.
- **Per project, without the plugin.** In the project folder, `mom setup cursor` prints the `.cursor/hooks.json` and `.cursor/mcp.json` entries; `mom setup cursor --write` merges them into the files that are there. It keeps your other hooks and servers and saves a `.bak` of a file it changes. Then reload the window. This way you get the hooks and the MCP server but not the rule. Copy `integrations/cursor/rules/mixture-of-models.mdc` to `.cursor/rules/` if you want it.

If Cursor cannot find `mom` (an app started from the Dock may not see npm's global bin), use the full path from `which mom` in the hooks and in `mcp.json`.

## What it does

| | How | Cursor feature |
| :- | :- | :- |
| **Palgu memory** | `mom memory on` in a project folder indexes it (this uploads its source to Palgu). The agent then searches it with `palgu_memory_search` at the start of a task and gets up to 8 pointers back. At session start, the hook tells the agent that memory is on. Memory is off by default. Consent is per folder and shared with every tool `mom` serves. | MCP tool; `sessionStart` → `additional_context`; the rule |
| **Delegation** | `palgu_delegate {prompt, model?}` sends one self-contained subtask to Palgu (`model: "auto"`, so Palgu picks the tier, or a model you pin) and returns the answer. The rule limits it to low-risk work (tests to draft, boilerplate, docs, lookups) and rules out security-sensitive work and secrets. `palgu_models` lists the models Palgu serves. | MCP tools; the rule |
| **Heartbeat** | When a turn ends mid-task ("Now I'll run the tests." and then nothing), the hook sends a follow-up, at most 3 times per prompt. Palgu decides (`POST /anthropic/heartbeat`). Without a sign-in, the same classifier runs locally. A turn you abort is never continued. `mom heartbeat off` turns it off. | `afterAgentResponse` keeps the answer; `stop` → `followup_message` (`loop_limit: 3`) |
| **Indexing** | In a memory-on folder, `palgu memory index .` runs in the background at session start, at most every 10 minutes. | `sessionStart` |

Every hook fails open. If `mom` errors or Palgu is slow, Cursor goes on as if the hook were not there. The heartbeat waits at most 8 s, memory search 8 s and delegation 120 s.

## What it sends where

- To `https://api.palgu.ai/v1/chat/completions` (`palgu_delegate`, only when the agent calls it): the subtask prompt, with `x-srooter-client: mixture-of-models-cursor/<version>` and, when a model is pinned, `x-srooter-pin`.
- To `https://api.palgu.ai/v1/cortex/search` (`palgu_memory_search`, only in memory-on folders): the query (one line, at most 300 characters) and the project's Palgu name.
- To `https://api.palgu.ai/v1/models/health` (`palgu_models`): only the key.
- To `https://api.palgu.ai/anthropic/heartbeat` (the `stop` hook, unless `mom heartbeat local|off`): the last 600 characters of the agent's answer and a session id.
- The key lives in `~/.config/mixture-of-models/credentials.json` (mode 0600) or comes from `PALGU_API_KEY`. It is never written to Cursor's files or logged. `mom`'s state (each conversation's last prompt and answer, for one day) is kept in `state.json` next to it.

## How it differs from the Claude Code mod

- **No per-turn routing.** Cursor's hooks cannot change the model, and a custom API base URL is not reliable in Agent mode. Cursor's own model does the work, and only what the agent hands to `palgu_delegate` goes to a cheaper model.
- **Memory is pulled, not pushed.** `beforeSubmitPrompt` can only allow or block a prompt; it cannot add context. Memory therefore reaches the agent through the MCP tool, which the rule and the session-start note tell it to call, and not through every prompt.
- **No `/route` or `/palgu` commands.** The rule tells the agent which `mom` commands to suggest.

## `mom mcp` for other tools

`mom mcp [tool]` is a plain MCP server on stdio (JSON-RPC 2.0, protocol `2025-06-18` or the client's version), so any agent that runs MCP servers can use it: `command: "mom", args: ["mcp", "<tool>"]`. `<tool>` only names the client in `x-srooter-client`. It finds the project folder from the tool's `folder` argument, then `MOM_PROJECT_DIR`, then the client's MCP roots, then its working directory.
