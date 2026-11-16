# Install Mixture of Models (instructions for a coding agent)

You are a coding agent asked to set up Mixture of Models. Follow this file top to bottom. Every step has a command to run and a check that tells you it worked. Do the steps for the agent the user asked for; if they did not say, set it up for yourself (the agent reading this).

What it gives the user: Palgu picks a model for each request (cheaper models for simple work), Palgu memory of the project is recalled into prompts, and a turn that stops mid-task is continued. Repository: https://github.com/alinaqi/mixture-of-models-claude-mod

## Rules

- **Never print, log or commit a Palgu key.** Keys live in `~/.config/mixture-of-models/credentials.json` (written by `mom login`) or in the `PALGU_API_KEY` environment variable. Configs written by these steps reference the key; they never contain it.
- **Signing in needs the user.** `mom login` prints a link and a code and waits up to 10 minutes for the user to approve it in a browser. Show the user the link, tell them to approve it, and wait. Do not try to approve it yourself.
- **Palgu memory uploads the project's source to Palgu.** Turn it on (`mom memory on`) only when the user says yes, in the project they named.
- **Do not edit the user's existing config files by hand** when a `mom setup <agent> --write` command exists: it merges, keeps other entries, and backs the old file up first.
- If a check fails, read **Troubleshooting** at the end before trying something else.

## Step 1. Prerequisites

```bash
node --version        # must be v20 or later
npm --version
```

Check: Node prints `v20` or higher. If not, ask the user to install Node 20+ and stop.

## Step 2. Install `mom` (every agent except Claude Code)

`mom` is a small CLI with no dependencies. The plugin files for every agent ship in the same package.

```bash
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom --help
```

Check: `mom --help` prints `mom — Mixture of Models for Codex, Cursor, OpenCode and other coding agents`. If `mom: command not found`, npm's global bin is not on `PATH`: run `npm prefix -g` and use `<that>/bin/mom`.

For Claude Code alone, skip to **Claude Code** below: it does not use `mom`.

## Step 3. Sign in to Palgu

```bash
mom login
```

It prints `Open https://www.palgu.ai/connect?code=XXXX-XXXX and approve code XXXX-XXXX`. Show that line to the user and wait for `Signed in to Palgu as ...`. New users can sign up on the same page.

If the user already has a Palgu key, they can `export PALGU_API_KEY=...` in their shell instead; do not ask them to paste it into the chat.

Check:

```bash
mom status
```

The first line starts with `Palgu: signed in`.

## Step 4. Set up the agent

### Claude Code

Needs Claude Code 2.1.287 or later (`claude --version`).

```bash
claude plugin marketplace add alinaqi/mixture-of-models-claude-mod
claude plugin install mixture-of-models@mixture-of-models-claude-mod
```

Then the user restarts Claude Code and runs `/palgu login` inside it (same link-and-approve flow as Step 3).

Check: `claude plugin list` shows `mixture-of-models@mixture-of-models-claude-mod`; after restart, `/route` shows the route state and `/palgu status` says `Palgu: signed in`.

### Codex (CLI 0.163 or later)

```bash
mom setup codex --write                                        # writes ~/.codex/palgu.config.toml; config.toml is not touched
codex plugin marketplace add alinaqi/mixture-of-models-claude-mod
codex plugin add mixture-of-models@mixture-of-models
```

The user starts Codex on Palgu with `codex -p palgu`. On first start Codex asks to review the plugin's hooks (`/hooks`); they run `mom hook codex` and nothing else. To pin one model: `MOM_PIN=<model> codex -p palgu -m <model>` (the same model twice).

Check: `codex plugin list` shows `mixture-of-models`, and `~/.codex/palgu.config.toml` exists and contains `model_provider = "palgu"`.

Guide: [integrations/codex](integrations/codex/README.md)

### Cursor

Run in the project folder the user wants it in:

```bash
mom setup cursor --write                                       # merges into .cursor/hooks.json and .cursor/mcp.json (backs them up)
mkdir -p .cursor/rules && cp "$(npm root -g)/mixture-of-models-claude-mod/integrations/cursor/rules/mixture-of-models.mdc" .cursor/rules/
```

The user reloads the Cursor window (**Developer: Reload Window**). To install it for every project instead, the user adds the marketplace in Cursor: **Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo** with `https://github.com/alinaqi/mixture-of-models-claude-mod`, then installs **Mixture of Models**.

Check: `.cursor/hooks.json` has entries running `mom hook cursor`, and `.cursor/mcp.json` has a server running `mom mcp cursor`. In Cursor, the MCP settings list the server with three tools (`palgu_memory_search`, `palgu_delegate`, `palgu_models`).

Guide: [integrations/cursor](integrations/cursor/README.md)

### OpenCode (1.19 or later)

```bash
mom setup opencode --write                                     # merges Palgu and the plugin into opencode.json (backs it up)
```

It writes to `$OPENCODE_CONFIG` if set, else `~/.config/opencode/opencode.json`. If the file has comments, it prints the block instead: merge it by hand, keeping every other key.

Check: the file now has `provider.palgu`, a `plugin` entry ending in `integrations/opencode/plugin.js`, and (if there was no default model) `"model": "palgu/auto"`. In OpenCode, `/route status` answers.

Guide: [integrations/opencode](integrations/opencode/README.md)

### Antigravity (`agy` 1.0.7 or later)

```bash
agy plugin install "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"
```

Check: `agy plugin list` shows `mixture-of-models` enabled. `agy plugin validate "$(npm root -g)/mixture-of-models-claude-mod/integrations/antigravity"` reports no errors.

If `agy` fails with `PERMISSION_DENIED on resource project <id>`, that is Antigravity's own Google Cloud setting, not this plugin: see [integrations/antigravity](integrations/antigravity/README.md).

### GitHub Copilot CLI (1.0.112 or later)

```bash
copilot plugin install alinaqi/mixture-of-models-claude-mod:integrations/copilot
```

The user must be signed in to Copilot (`/login` inside `copilot`). If `GITHUB_TOKEN` is set to a classic token, Copilot refuses it: start it as `env -u GITHUB_TOKEN -u GH_TOKEN copilot`.

Check: `copilot plugin list` shows `mixture-of-models`. In a session, asking the agent to call `palgu_models` lists Palgu's models.

Guide: [integrations/copilot](integrations/copilot/README.md)

### Aider, Continue, Goose

These have no hooks, so only Palgu's routing applies (no memory, no heartbeat). Follow [integrations/gateway](integrations/gateway/README.md): point the agent at `https://api.palgu.ai/v1` with model `auto` and the key from `mom token`.

Check: one prompt gets an answer; Palgu's dashboard shows the request.

### Not yet supported

- **Gemini CLI**: needs a Gemini-format Palgu endpoint (not available yet).
- **Windsurf**: no way to point it at another model endpoint.

## Step 5 (optional, ask first). Palgu memory

Only if the user agrees to upload the project's source to Palgu. In the project folder:

```bash
mom memory on        # Claude Code users: /palgu memory on inside Claude Code instead
mom memory status
```

Check: `mom memory status` says `Palgu memory: on`; after indexing finishes (a few minutes on a big repo) it says `indexed, N symbols`. Indexing needs the `palgu` CLI (https://www.palgu.ai/install); without it, status says so.

Consent is per folder and shared by every agent that uses `mom`. `mom memory off` stops it.

## Step 6. Tell the user what changed

Report: which agent was set up, the files written (and their `.bak` backups), whether memory is on, and how to start (`codex -p palgu`, reload Cursor, restart Claude Code, and so on). Useful commands for them: `mom status`, `mom memory on|off|status`, `mom heartbeat palgu|local|off`.

## Troubleshooting

| Symptom | Cause | Fix |
| :- | :- | :- |
| `mom: command not found` | npm's global bin is not on `PATH` | Use `$(npm prefix -g)/bin/mom`, or add that folder to `PATH` |
| A hook or MCP server cannot find `mom` (an app started from the Dock) | GUI apps do not see the shell's `PATH` | Put the full path from `which mom` in the hook commands and MCP config |
| `mom status` says `not signed in` | `mom login` not finished, or `PALGU_API_KEY` not exported in this shell | Run `mom login` again and wait for the approval |
| Palgu answers 403 `pin 'auto' not allowed by policy` | A model pin was sent with model `auto` | Pin with the model named too: `MOM_PIN=<m> codex -p palgu -m <m>` |
| Palgu answers 503 for a pinned model | That model is down | Pick another (`palgu_models` tool, or `GET https://api.palgu.ai/v1/models/health`) |
| Codex hooks do not run in `codex exec` | Hooks are not yet trusted | Start `codex -p palgu` once interactively and approve them in `/hooks` |
| `mom memory status`: `could not read the index status` | The `palgu` CLI is missing or not signed in | Install it from https://www.palgu.ai/install; it uses `mom`'s key when it has none of its own |
