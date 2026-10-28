# Privacy policy

mixture-of-models is a Claude Code plugin that runs entirely on your machine. There is no server operated by the author, no account, and no telemetry.

## What the plugin sends, and to whom

- **To a local Ollama at `http://localhost:11434`**, if one is running: the text of each prompt you submit, together with a scoring rubric, so the prompt can be scored 1-10. Nothing leaves your machine for this.
- **To Anthropic, through Claude Code's own API client and your own account**, when no Ollama answers: the same prompt text and rubric, for the same score. This is the same channel Claude Code already uses for your session.
- **To the gateway you configure** (`gateway_url`), through a child Claude Code process authenticated with the `gateway_key` you provide: for routed turns only, your prompt plus a short brief of the last few exchanges of your session (text only, truncated), and whatever that child's own agent loop sends while it works. The gateway's handling of that data is governed by the gateway operator's policy, not by this plugin. Each of the child's requests also carries two headers that identify it to the gateway: `x-srooter-client: mixture-of-models/<version>` (the plugin's name and version) and `x-srooter-project: <folder name>` (the last segment of the session's working directory, lowercased and reduced to `a-z 0-9 . _ -`). They hold no path, no prompt text and no other content, and are sent only to the configured gateway. If no gateway is configured, nothing is sent and the plugin is observe-only.

- **To Anthropic, on your own Claude login**, only for routes that name a Claude family member (`claude/sonnet`, `claude/auto`, …): a child Claude Code process sends the same brief, and whatever its agent loop sends while it works, through the same account your main session uses.
- **To Codex's endpoint**, only for `codex` routes: a child `codex exec` process reads the same brief (your prompt plus the truncated recent exchanges), can read and, within its `workspace-write` sandbox, edit files in the session's working directory, and sends what its agent loop needs to either your gateway's `/v1/responses` endpoint (with `codex.auth: "palgu"`, the default, using your `gateway_key`, passed to it in its environment only) or OpenAI (with `codex.auth: "chatgpt"`, on your own Codex login, under OpenAI's policy). Codex may keep its own session files under `~/.codex`, as it does when you run it yourself; the plugin never reads or writes that folder.

The plugin sends nothing to any other party, and nothing to the author.

## What the plugin stores

In Claude Code's plugin store on your machine: your `/route` setting, per-day counts of which model answered, the last verdict, per-kind failure counts, and a log of the last 200 routing decisions (day, model, kind, tier, score, which classifier answered, child duration and exit code). No prompt text, answers or credentials are stored by the plugin. Your gateway key is stored by Claude Code in its secure storage as a sensitive plugin option.

## What the plugin reads

`~/.claude/model-config.json` (routing settings, no credentials) and the environment variables `HOME`, `MAGGY_ROUTER_CHILD` and `ANTHROPIC_CUSTOM_HEADERS` (only so that custom headers you set yourself are kept in the child's requests to the gateway).

## Children

The plugin is not intended for use by anyone under 18.

## Contact

Open an issue at https://github.com/alinaqi/mixture-of-models-claude-mod/issues.
