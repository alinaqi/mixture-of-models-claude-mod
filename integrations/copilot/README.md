# Mixture of Models for GitHub Copilot CLI

**English** · [简体中文](../../docs/i18n/zh-CN/integrations/copilot/README.md) · [日本語](../../docs/i18n/ja/integrations/copilot/README.md) · [Deutsch](../../docs/i18n/de/integrations/copilot/README.md) · [Français](../../docs/i18n/fr/integrations/copilot/README.md) · [العربية](../../docs/i18n/ar/integrations/copilot/README.md)

The heartbeat that continues a turn that stopped mid-task, Palgu memory, and Palgu's models as tools, in GitHub Copilot CLI ([ADR 0005](../../docs/adr/0005-other-coding-agents.md)).

Checked live with Copilot CLI 1.0.112.

## Install

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod   # installs mom (the plugin's hooks and MCP server run it)
mom login                                                     # sign in to Palgu
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
copilot plugin list                                           # mixture-of-models
```

To try it without installing: `copilot --plugin-dir "$(npm root -g)/mixture-of-models-claude-mod/integrations/copilot"`.

Then, in a project you want in Palgu memory: `mom memory on` (uploads its source to Palgu; off by default, per folder, shared with the other agents `mom` serves).

## What it does

| | How | Copilot feature |
| :- | :- | :- |
| **Heartbeat** | A turn that ends mid-task ("Let me check the tests.") is continued, at most 3 times per prompt. Palgu decides (`POST /anthropic/heartbeat`); without a sign-in the same classifier runs locally. `mom heartbeat off` turns it off. | `agentStop` → `decision: "block"` with the continue prompt as `reason`; the answer is read from the session's `events.jsonl`, since the stop input does not carry it |
| **Palgu memory** | The agent searches the project's Palgu memory with `palgu_memory_search` (the skill tells it when); at session start in a memory-on folder it is told memory is on. | MCP server (`.mcp.json`, `mom mcp copilot`), `sessionStart` → `additionalContext`, skill `mixture-of-models` |
| **Palgu's models as tools** | `palgu_delegate` hands a self-contained subtask to a Palgu model (`auto` or pinned); `palgu_models` lists them. | MCP server |
| **Indexing** | `palgu memory index .` in the background at session start in a memory-on folder, at most every 10 minutes. | `sessionStart` |

Every hook fails open: if `mom` errors or Palgu is slow, Copilot goes on as if there were no hook.

## Not like the Claude Code mod

- **No per-prompt routing of Copilot's own turns.** Copilot's hooks cannot change the model, and a command hook's output on `userPromptSubmitted` is dropped, so memory cannot be added to each prompt either: it comes through the MCP tool. Palgu's routing reaches Copilot through `palgu_delegate`. Copilot can also use Palgu as a BYOK provider of type `anthropic` (`https://api.palgu.ai/anthropic`, model `auto`), one model per session; see GitHub's BYOK docs.
- No `/route` or `/palgu` commands; `mom` in a terminal does that.

## What it sends where

- To `https://api.palgu.ai/anthropic/heartbeat` (unless `mom heartbeat local|off`): the last 600 characters of the answer and a session id.
- To `https://api.palgu.ai/v1/cortex/search` (only when the agent calls `palgu_memory_search` in a memory-on folder): the query (at most 300 characters) and the project's Palgu name.
- To `https://api.palgu.ai/v1/chat/completions` (only when the agent calls `palgu_delegate`): the subtask's prompt.
- The key stays in `~/.config/mixture-of-models/credentials.json` (0600) or `PALGU_API_KEY`; the plugin's files hold none.

## Seen live (Copilot CLI 1.0.112)

- Hooks in a repository's `.github/hooks/` did not run under `copilot -p` in an untrusted folder; the same hooks in a plugin (`--plugin-dir` or installed) did.
- The continue prompt from `agentStop` arrives back as a new `userPromptSubmitted`; `mom` recognises it as its own, so it keeps the person's prompt and the 3-continue budget.
- A plugin's MCP server starts in the plugin's folder; the session's folder is `COPILOT_SESSION_CWD`, which `mom mcp` uses.
- The transcript is `~/.copilot/session-state/<session>/events.jsonl` (or under `$COPILOT_HOME`); the model's answers are `assistant.message` events. `mom` reads only `.jsonl` files under that folder, and only the last 256 KB.
- `copilot` refuses a classic `GITHUB_TOKEN`; sign in with `/login` (run it with `env -u GITHUB_TOKEN -u GH_TOKEN copilot` if one is set).
