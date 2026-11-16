# Mixture of Models for OpenCode

The plugin picks the Palgu model for each prompt, adds Palgu memory to each prompt, continues a turn that stops mid-task, and adds `/route` and `/palgu`. OpenCode is the one tool besides Claude Code where the plugin can choose the model for each request, so it matches the Claude Code mod feature for feature ([ADR 0005](../../docs/adr/0005-other-coding-agents.md)).

Requirements:

- OpenCode 1.19 or later. The plugin uses the V1 server plugin API; tested on 1.19.5.
- Node 20 or later for `mom`.
- For Palgu memory, the [palgu CLI](https://www.palgu.ai/install) does the indexing.

## Install

```bash
# 1. mom: sign-in, memory consent and the setup command (the plugin ships in the same package)
npm install -g github:alinaqi/mixture-of-models-claude-mod
mom login                         # sign in to Palgu in the browser

# 2. Palgu as a provider and the plugin in opencode.json
mom setup opencode                # print the block
mom setup opencode --write        # merge it into opencode.json (copies the old file to opencode.json.bak first)
```

`--write` writes to `$OPENCODE_CONFIG` if that is set, otherwise to `~/.config/opencode/opencode.json` (or the same path under `$XDG_CONFIG_HOME`). It changes two keys, `provider.palgu` and the plugin entry, and sets `model` to `palgu/auto` only when you have no default model. It leaves every other key alone. If the file has comments (JSONC), `mom` prints the block and you merge it by hand. The model list comes from Palgu (`GET /v1/models/health`) when you are signed in, otherwise from the built-in list.

What it writes (abridged):

```json
{
  "model": "palgu/auto",
  "provider": {
    "palgu": {
      "npm": "@ai-sdk/anthropic",
      "name": "Palgu",
      "options": {
        "baseURL": "https://api.palgu.ai/anthropic/v1",
        "apiKey": "{env:PALGU_API_KEY}",
        "headers": { "x-srooter-client": "mixture-of-models-opencode/0.28.0" }
      },
      "models": { "auto": { "name": "Palgu router (auto)" }, "deepseek-pro": {}, "gemini-3.8-flash": {} }
    }
  },
  "plugin": ["/usr/local/lib/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"]
}
```

The key is not in the file. The plugin adds mom's key (from `mom login`, or `PALGU_API_KEY`) to requests going to `https://api.palgu.ai/`. If `PALGU_API_KEY` is set, OpenCode also sends it itself.

### Other ways to load the plugin

| Form | `plugin` entry |
| :- | :- |
| The installed package's file (what `mom setup opencode` writes) | `"/…/node_modules/mixture-of-models-claude-mod/integrations/opencode/plugin.js"` |
| The package directory (OpenCode reads `exports["./server"]`) | `"/…/node_modules/mixture-of-models-claude-mod"` |
| A local file in `.opencode/plugin/` (one project) or `~/.config/opencode/plugin/` (every project) | the file `mom.js` containing `export { default } from '/…/integrations/opencode/plugin.js'` |
| From JavaScript | `import plugin from 'mixture-of-models-claude-mod/opencode'` |

Options go in a tuple: `["…/plugin.js", { "critical": "claude-opus" }]`.

| Option | Default | |
| :- | :- | :- |
| `critical` | none | Palgu model for critical work: the mod's rules ("use claude …", "execute the plan", security and verdict prompts) or a classifier score above 7 |
| `routes` | `{}` | `{ "simple": "…", "coding": "…", "critical": "…" }`: a Palgu model for each tier. A tier with no model goes to `auto` |
| `ollama` | `true` | Classify prompts with a local Ollama (`localhost:11434`, 4 s). Used only when a route is set |
| `ollamaModel` | `qwen2.5-coder:3b` | |
| `provider` | `palgu` | The provider id in `opencode.json` that the plugin routes |

## What it does

| | How | OpenCode feature |
| :- | :- | :- |
| **Routing** | Each prompt sent to `palgu/auto` goes out as `auto`, and Palgu picks the tier (trivial, small, medium, think). `/route <model>` pins one model for every session, and `/route auto` removes the pin. With `critical` or `routes` set, the mod's rules and classifier choose the tier, and the tier's model is pinned. A model you choose yourself in OpenCode (a `palgu/<model>` that is not `auto`) is left as it is. The model goes on the user message, and `x-srooter-pin` goes on each request. OpenCode's own title and summary requests are never pinned. | `chat.message` (`output.message.model`), `chat.headers` |
| **Palgu memory** | `mom memory on` or `/palgu memory on` in a project folder indexes the folder (uploads its source to Palgu). After that, up to 8 pointers from it are recalled for every prompt of four words or more and added to that message's system text. Memory is off by default. Consent is per folder and shared with every tool `mom` serves. | `chat.message` (`output.message.system`) |
| **Heartbeat** | When a session goes idle after a turn that ended mid-task ("Let me check the tests next."), the plugin sends the continue prompt, at most 3 times per prompt of yours. Palgu decides (`POST /anthropic/heartbeat`). Without a sign-in, the same classifier runs locally. `/palgu heartbeat off` turns it off. Subagent sessions, aborted turns and failed turns are never continued. | `event` `session.idle` → `client.session.promptAsync` |
| **Indexing** | In a folder with memory on, `palgu memory index .` runs in the background when a session starts, at most every 10 minutes. | `event` `session.created` |
| **Commands** | `/route [auto\|<model>\|<prefix>\|status]`, `/palgu memory on\|off\|status`, `/palgu heartbeat palgu\|local\|off`, `/palgu status`. The plugin runs the command itself and shows the result in a TUI toast. The model then only repeats that one line, under `auto`, so Palgu's cheapest tier answers. | `config` (registers `command.route` and `command.palgu`; a command of yours with the same name wins), `command.execute.before`, `client.tui.showToast` |

Every hook fails open. If something throws or Palgu is slow, OpenCode carries on as if the plugin were not there. The memory search waits at most 3 s, and the heartbeat waits at most 8 s. `MOM_DEBUG=1` writes one JSON line per decision and request to `~/.config/mixture-of-models/opencode.log`: model ids, pins and sizes, never the key, a prompt or recalled text.

## What it sends where

- **To `https://api.palgu.ai/anthropic/v1/messages`** (OpenCode itself, for provider `palgu`): your OpenCode turns. Each request carries `x-srooter-client: mixture-of-models-opencode/<version>` and `x-srooter-project: <folder name>`, `x-srooter-pin: <model>` when a model is pinned, and the key.
- **To `https://api.palgu.ai/v1/cortex/search`** (the plugin, only in folders with memory on): the prompt, as one line of at most 300 characters, and the project's Palgu name.
- **To `https://api.palgu.ai/anthropic/heartbeat`** (the plugin, unless the heartbeat is set to `local` or `off`): the last 600 characters of the answer and a session id.
- **To `http://localhost:11434`** (only when you set `routes` or `critical` and Ollama runs): the prompt, for the classifier.
- **On disk**: the key stays in `~/.config/mixture-of-models/credentials.json` (mode 0600) or `PALGU_API_KEY`. The pin and memory consent are kept in `state.json` in the same folder.

## Different from the Claude Code mod

- Routing stays inside one provider, Palgu. A routed turn runs in the same OpenCode session with full history and tools; there is no child process. Claude models are reachable only through Palgu.
- Without `critical` or `routes`, Palgu's own tiers choose the model, not the mod's classifier, and `/route strategy` does not exist.
- `/route` and `/palgu` cost one short model reply, because an OpenCode command always ends in a prompt.
- `opencode run` exits as soon as the session goes idle, so the heartbeat has no chance to continue there. It works in the TUI and under `opencode serve`.
