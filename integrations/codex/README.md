# Mixture of Models for Codex

Palgu picks the model for each request, Palgu memory is recalled into each prompt, and a turn that stops mid-task is continued. The same behaviour as the Claude Code mod, built on Codex's own plugins and hooks ([ADR 0005](../../docs/adr/0005-other-coding-agents.md)).

Needs Codex 0.163 or later and Node 20 or later.

## Install

```bash
# 1. The mom CLI (the plugin's hooks call it)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                      # sign in to Palgu in the browser

# 2. Route Codex through Palgu: writes ~/.codex/palgu.config.toml (your config.toml is not touched)
mom setup codex --write

# 3. The plugin: memory recall and the heartbeat
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

Then start Codex on Palgu:

```bash
codex -p palgu
```

Codex asks you to review the plugin's hooks the first time (`/hooks`); they run `mom hook codex` and nothing else.

## What it does

| | How | Codex feature |
| :- | :- | :- |
| **Routing** | `model = "auto"`: Palgu classifies each request and serves it from its tiers (trivial, small, medium, think). `MOM_PIN=<model> codex -p palgu` pins one model for the session. | `-p palgu` profile, `[model_providers.palgu]` with `auth = { command = "mom", args = ["token"] }` |
| **Palgu memory** | `mom memory on` in a project folder indexes it (uploads its source to Palgu) and recalls up to 8 pointers from it into every prompt of four words or more. Off by default; consent is per folder and shared with the other tools `mom` serves. | `UserPromptSubmit` → `additionalContext` |
| **Heartbeat** | A turn that ends mid-task ("Let me check the tests.") is continued, at most 3 times per prompt. Palgu decides (`POST /anthropic/heartbeat`); without a sign-in, the same classifier runs locally. `mom heartbeat off` turns it off. | `Stop` → `decision: "block"` |
| **Indexing** | In a memory-on folder, `palgu memory index .` runs in the background at session start, at most every 10 minutes. | `SessionStart` |

Every hook fails open: if `mom` errors or Palgu is slow, Codex goes on as if there were no hook. Memory search waits at most 3 s, the heartbeat at most 8 s.

## What it sends where

- To `https://api.palgu.ai/v1/responses` (Codex itself, under `-p palgu`): your Codex turns, with the key from `mom token` and the headers `x-srooter-client: mixture-of-models-codex/<version>`, and `x-srooter-pin` / `x-srooter-project` when `MOM_PIN` / `MOM_PROJECT` are set.
- To `https://api.palgu.ai/v1/cortex/search` (`mom`, only in memory-on folders): the prompt (one line, at most 300 characters) and the project's Palgu name.
- To `https://api.palgu.ai/anthropic/heartbeat` (`mom`, unless `mom heartbeat local|off`): the last 600 characters of Codex's answer and a session id.
- The key is in `~/.config/mixture-of-models/credentials.json` (mode 0600) or `PALGU_API_KEY`. It is never written to Codex's config.

## Not like the Claude Code mod

- Routing is Palgu's tiers, not the mod's classifier and strategies: Codex hooks cannot change the model of a turn.
- No `/route` or `/palgu` slash commands (Codex removed custom commands); the skill `mixture-of-models` tells Codex the `mom` commands to suggest.
- Plugins with hooks cannot be listed in Codex's public plugin directory, so it installs from this repository's marketplace.
