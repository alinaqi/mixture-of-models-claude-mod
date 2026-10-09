# Privacy policy

mixture-of-models is a Claude Code plugin that runs entirely on your machine. There is no server operated by the author, no account, and no telemetry.

## What the plugin sends, and to whom

- **To a local Ollama at `http://localhost:11434`**, if one is running: the text of each prompt you submit, together with a scoring rubric, so the prompt can be scored 1-10. Nothing leaves your machine for this.
- **To Anthropic, through Claude Code's own API client and your own account**, when no Ollama answers: the same prompt text and rubric, for the same score. This is the same channel Claude Code already uses for your session.
- **To the gateway you configure** (`gateway_url`), through a child Claude Code process authenticated with the `gateway_key` you provide: for routed turns only, your prompt plus a short brief of the last few exchanges of your session (text only, truncated), and whatever that child's own agent loop sends while it works. The gateway's handling of that data is governed by the gateway operator's policy, not by this plugin. If no gateway is configured, nothing is sent and the plugin is observe-only.

The plugin sends nothing to any other party, and nothing to the author.

## What the plugin stores

In Claude Code's plugin store on your machine: your `/route` setting, per-day counts of which model answered, and the last score. No prompt text, answers or credentials are stored by the plugin. Your gateway key is stored by Claude Code in its secure storage as a sensitive plugin option.

## What the plugin reads

`~/.claude/model-config.json` (routing settings, no credentials) and the environment variables `HOME` and `MAGGY_ROUTER_CHILD`.

## Children

The plugin is not intended for use by anyone under 18.

## Contact

Open an issue at https://github.com/alinaqi/mixture-of-models-claude-mod/issues.
